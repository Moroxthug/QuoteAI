// Phase 5 — data loaders for the job overview charts and the company
// analytics page. The maths lives in ./math.ts (pure); this file only
// gathers rows and shapes the JSON the frontend and the assistant consume.
import {
  db,
  projectsTable,
  milestonesTable,
  costBudgetLinesTable,
  costEntriesTable,
  invoicesTable,
  invoicePaymentsTable,
  contractsTable,
  clientsTable,
  COST_CATEGORIES,
  timeEntriesTable,
  labourCostCents,
  type Project,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, gte, isNull } from "drizzle-orm";
import { arAging, balanceCents } from "../invoices/math.js";
import { projectInvoiceTotals } from "../invoices/service.js";
import { toIsoDate } from "../jobs/dates.js";
import {
  budgetAlertLevel,
  budgetVsActual,
  cashFlowForecast,
  costCurve,
  earnedValue,
  jobRisks,
  monthlySeries,
  scheduleVariance,
  startOfWeekUtc,
  daysBetween,
  type CashWeek,
  type CategoryPoint,
  type CurvePoint,
  type EarnedValue,
  type JobRisk,
  type JobRiskInput,
  type MilestoneVariance,
  type MonthPoint,
  type RemainingBudgetLike,
  type UpcomingTermLike,
} from "./math.js";

const OPEN_INVOICE = ["sent", "viewed", "partially_paid", "overdue"] as const;

/** Pre-tax value of a job: the contract subtotal (+ signed change orders, pre-tax) or the stored value backed out of tax. */
export async function jobSubtotalCentsFor(project: Project): Promise<number> {
  if (project.contractId) {
    const [contract] = await db.select({ variables: contractsTable.variables }).from(contractsTable).where(eq(contractsTable.id, project.contractId));
    if (contract) {
      const v = contract.variables as { subtotal?: number; total?: number };
      const subtotal = Math.round((v.subtotal ?? 0) * 100);
      const total = Math.round((v.total ?? 0) * 100);
      const rate = total > 0 ? subtotal / total : 1;
      return subtotal + Math.round(project.changeOrdersCents * rate);
    }
  }
  // No contract: the stored value is all we have.
  return project.contractValueCents + project.changeOrdersCents;
}

// ── Job analytics ────────────────────────────────────────────────────────────

export type JobAnalytics = {
  subtotalCents: number;
  budgetCents: number;
  costCents: number;
  pendingCostCents: number;
  categories: CategoryPoint[];
  curve: CurvePoint[];
  schedule: { rows: MilestoneVariance[]; daysBehind: number; lateCount: number; plannedEnd: string | null; forecastEnd: string | null };
  earned: EarnedValue;
  invoices: { invoicedCents: number; collectedCents: number; outstandingCents: number; overdueCents: number; draftCount: number; upcomingCents: number };
};

export async function jobAnalytics(project: Project, now = new Date()): Promise<JobAnalytics> {
  const [milestones, budget, costs, invoices, subtotalCents] = await Promise.all([
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, project.id)).orderBy(asc(milestonesTable.sortOrder)),
    db.select().from(costBudgetLinesTable).where(eq(costBudgetLinesTable.projectId, project.id)),
    db.select().from(costEntriesTable).where(eq(costEntriesTable.projectId, project.id)),
    db.select().from(invoicesTable).where(eq(invoicesTable.projectId, project.id)),
    jobSubtotalCentsFor(project),
  ]);
  const invoiceIds = invoices.map((i) => i.id);
  const payments = invoiceIds.length ? await db.select().from(invoicePaymentsTable).where(inArray(invoicePaymentsTable.invoiceId, invoiceIds)) : [];
  const budgetCents = budget.reduce((s, b) => s + b.plannedCents, 0);
  const costLike = costs.map((c) => ({ totalCents: c.totalCents, date: c.date, status: c.status, category: c.category }));
  const costCents = costLike.filter((c) => c.status === "confirmed").reduce((s, c) => s + c.totalCents, 0);
  const pendingCostCents = costLike.filter((c) => c.status !== "confirmed").reduce((s, c) => s + c.totalCents, 0);
  const invLike = invoices.map((i) => ({ type: i.type, status: i.status, totalCents: i.totalCents, issueDate: i.issueDate }));
  const payLike = payments.map((p) => ({ amountCents: p.amountCents, date: p.date, creditNoteId: p.creditNoteId }));
  const invoicedSubtotalCents = invoices.filter((i) => i.status !== "void" && i.status !== "draft").reduce((s, i) => s + (i.type === "credit_note" ? -Math.abs(i.subtotalCents) : i.subtotalCents), 0);
  const plannedStart = project.plannedStart ?? project.startDate;
  const plannedEnd = project.plannedEnd ?? project.endDate;
  const schedule = scheduleVariance(milestones, now);
  const forecastEnd = plannedEnd && schedule.daysBehind > 0 && project.status !== "completed" ? new Date(plannedEnd.getTime() + schedule.daysBehind * 86_400_000) : plannedEnd;
  const totals = projectInvoiceTotals(invoices);
  const upcomingCents = milestones.filter((m) => m.status !== "completed" && m.status !== "skipped" && m.paymentAmountCents && !invoices.some((i) => i.milestoneId === m.id && i.status !== "void")).reduce((s, m) => s + (m.paymentAmountCents ?? 0), 0);
  return {
    subtotalCents,
    budgetCents,
    costCents,
    pendingCostCents,
    categories: budgetVsActual(budget, costLike, COST_CATEGORIES),
    curve: costCurve({ costs: costLike, invoices: invLike, payments: payLike, budgetCents, plannedStart, plannedEnd, now }),
    schedule: { ...schedule, plannedEnd: toIsoDate(plannedEnd), forecastEnd: toIsoDate(forecastEnd) },
    earned: earnedValue({ subtotalCents, progressPercent: project.progressPercent, invoicedSubtotalCents, budgetCents, costCents }),
    invoices: { ...totals, upcomingCents },
  };
}

// ── Company analytics ────────────────────────────────────────────────────────

export type CompanyAnalytics = {
  months: MonthPoint[];
  totals: { invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null; outstandingCents: number; overdueCents: number; pipelineCents: number };
  aging: ReturnType<typeof arAging>;
  cashFlow: CashWeek[];
  jobs: { byStatus: Record<string, number>; active: number; risks: JobRisk[]; margins: { id: string; name: string; clientName: string | null; status: string; subtotalCents: number; costCents: number; marginPercent: number | null; progressPercent: number }[] };
};

export async function companyAnalytics(userId: string, opts: { months?: number; now?: Date } = {}): Promise<CompanyAnalytics> {
  const now = opts.now ?? new Date();
  const months = Math.min(24, Math.max(3, opts.months ?? 6));
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
  const [projects, invoices, costs] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.userId, userId)).orderBy(desc(projectsTable.createdAt)).limit(500),
    db.select().from(invoicesTable).where(eq(invoicesTable.userId, userId)).orderBy(desc(invoicesTable.issueDate)).limit(2000),
    db.select().from(costEntriesTable).where(and(eq(costEntriesTable.userId, userId), gte(costEntriesTable.date, since))),
  ]);
  const projectIds = projects.map((p) => p.id);
  const contractIds = projects.map((p) => p.contractId).filter((x): x is string => !!x);
  // Phase 68: contracts ride in this round (they only need the project rows above) — two round trips instead of three.
  const [payments, milestones, budgetLines, allCosts, clients, contracts] = await Promise.all([
    db.select().from(invoicePaymentsTable).where(and(eq(invoicePaymentsTable.userId, userId), gte(invoicePaymentsTable.date, since))),
    projectIds.length ? db.select().from(milestonesTable).where(inArray(milestonesTable.projectId, projectIds)) : Promise.resolve([] as (typeof milestonesTable.$inferSelect)[]),
    projectIds.length ? db.select().from(costBudgetLinesTable).where(inArray(costBudgetLinesTable.projectId, projectIds)) : Promise.resolve([] as (typeof costBudgetLinesTable.$inferSelect)[]),
    projectIds.length ? db.select({ projectId: costEntriesTable.projectId, totalCents: costEntriesTable.totalCents, status: costEntriesTable.status }).from(costEntriesTable).where(inArray(costEntriesTable.projectId, projectIds)) : Promise.resolve([] as { projectId: string | null; totalCents: number; status: string }[]),
    db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.userId, userId)),
    contractIds.length ? db.select({ id: contractsTable.id, variables: contractsTable.variables }).from(contractsTable).where(inArray(contractsTable.id, contractIds)) : Promise.resolve([] as { id: string; variables: unknown }[]),
  ]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));

  const series = monthlySeries({
    invoices: invoices.map((i) => ({ type: i.type, status: i.status, totalCents: i.totalCents, issueDate: i.issueDate })),
    payments: payments.map((p) => ({ amountCents: p.amountCents, date: p.date, creditNoteId: p.creditNoteId, invoiceType: invoiceById.get(p.invoiceId)?.type })),
    costs: costs.map((c) => ({ totalCents: c.totalCents, date: c.date, status: c.status })),
    months,
    now,
  });
  const sum = (k: keyof MonthPoint) => series.reduce((s, m) => s + (m[k] as number), 0);
  const invoicedCents = sum("invoicedCents");
  const costCents = sum("costCents");

  const open = invoices.filter((i) => (OPEN_INVOICE as readonly string[]).includes(i.status));
  const aging = arAging(invoices, now);

  // Per-job figures (subtotal via contract when available).
  const contractById = new Map(contracts.map((c) => [c.id, c.variables as { subtotal?: number; total?: number }]));
  const subtotalOf = (p: Project) => {
    const v = p.contractId ? contractById.get(p.contractId) : undefined;
    if (v) {
      const subtotal = Math.round((v.subtotal ?? 0) * 100);
      const total = Math.round((v.total ?? 0) * 100);
      return subtotal + Math.round(p.changeOrdersCents * (total > 0 ? subtotal / total : 1));
    }
    return p.contractValueCents + p.changeOrdersCents;
  };

  const riskInputs: JobRiskInput[] = [];
  const margins: CompanyAnalytics["jobs"]["margins"] = [];
  const upcomingTerms: UpcomingTermLike[] = [];
  const remainingBudgets: RemainingBudgetLike[] = [];
  const byStatus: Record<string, number> = {};
  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    const mine = allCosts.filter((c) => c.projectId === p.id && c.status === "confirmed");
    const jobCost = mine.reduce((s, c) => s + c.totalCents, 0);
    const budgetCents = budgetLines.filter((b) => b.projectId === p.id).reduce((s, b) => s + b.plannedCents, 0);
    const jobInvoices = invoices.filter((i) => i.projectId === p.id);
    const invoicedSubtotalCents = jobInvoices.filter((i) => i.status !== "void" && i.status !== "draft").reduce((s, i) => s + (i.type === "credit_note" ? -Math.abs(i.subtotalCents) : i.subtotalCents), 0);
    const overdueCents = jobInvoices.filter((i) => i.status === "overdue").reduce((s, i) => s + balanceCents(i), 0);
    const ms = milestones.filter((m) => m.projectId === p.id);
    const sched = scheduleVariance(ms, now);
    const subtotalCents = subtotalOf(p);
    riskInputs.push({ id: p.id, name: p.name, status: p.status, subtotalCents, budgetCents, costCents: jobCost, progressPercent: p.progressPercent, invoicedSubtotalCents, overdueCents, daysBehind: p.status === "active" || p.status === "planning" ? sched.daysBehind : 0, plannedEnd: p.plannedEnd, completedAt: p.completedAt });
    if (p.status !== "planning" || jobCost > 0) {
      margins.push({ id: p.id, name: p.name, clientName: p.clientId ? (clientName.get(p.clientId) ?? null) : null, status: p.status, subtotalCents, costCents: jobCost, marginPercent: subtotalCents > 0 ? Math.round(((subtotalCents - jobCost) / subtotalCents) * 1000) / 10 : null, progressPercent: p.progressPercent });
    }
    if (p.status === "active" || p.status === "planning") {
      for (const m of ms) {
        if (m.status === "completed" || m.status === "skipped" || !m.paymentAmountCents) continue;
        if (jobInvoices.some((i) => i.milestoneId === m.id && i.status !== "void")) continue;
        upcomingTerms.push({ amountCents: m.paymentAmountCents, expectedDate: m.plannedEnd ? new Date(m.plannedEnd.getTime() + sched.daysBehind * 86_400_000) : null });
      }
      const remaining = budgetCents - jobCost;
      if (remaining > 0) remainingBudgets.push({ remainingCents: remaining, from: now, to: p.plannedEnd && p.plannedEnd > now ? p.plannedEnd : null });
    }
  }
  const pipelineCents = upcomingTerms.reduce((s, t) => s + t.amountCents, 0);

  return {
    months: series,
    totals: {
      invoicedCents,
      collectedCents: sum("collectedCents"),
      costCents,
      marginCents: invoicedCents - costCents,
      marginPercent: invoicedCents > 0 ? Math.round(((invoicedCents - costCents) / invoicedCents) * 1000) / 10 : null,
      outstandingCents: open.reduce((s, i) => s + balanceCents(i), 0),
      overdueCents: aging.overdueCents,
      pipelineCents,
    },
    aging,
    cashFlow: cashFlowForecast({ openInvoices: open.map((i) => ({ balanceCents: balanceCents(i), dueDate: i.dueDate, status: i.status })), upcomingTerms, remainingBudgets, weeks: 8, now }),
    jobs: { byStatus, active: byStatus.active ?? 0, risks: jobRisks(riskInputs), margins: margins.sort((a, b) => (b.subtotalCents - b.costCents) - (a.subtotalCents - a.costCents)).slice(0, 12) },
  };
}


// ── Phase 79: 60-day cash-flow outlook (dashboard card) ─────────────────────
// Same engine as the analytics page chart, wider window and two more sources:
// scheduled drafts (holdback releases waiting for the lien period, drafts in
// the review-then-auto-send window) and payroll. Payroll = the last four
// weeks of approved labour as a weekly run-rate while jobs are active, plus
// what is approved/submitted but not yet in a payroll export (lands in week 0).
// The labour category is left out of the budget spread when a run-rate
// exists so wages are not counted twice.

const OUTLOOK_DAYS = 60;
// Day 60 counted from the start of the current week falls in week index 8 → nine week buckets.
const OUTLOOK_WEEKS = Math.floor(OUTLOOK_DAYS / 7) + 1;

export type CashFlowOutlook = {
  days: number;
  weeks: CashWeek[];
  totals: { inCents: number; outCents: number; netCents: number; lowestCumulativeCents: number; lowestWeek: string | null };
  sources: { openInvoices: number; overdueInvoices: number; scheduledInvoices: number; upcomingTerms: number; activeJobs: number; payrollWeeklyCents: number; payrollPendingCents: number };
  /** Open jobs at or past 90 % of their cost budget (the same rule as the margin alerts). */
  budgetAlerts: { id: string; name: string; pct: number; level: 90 | 100 }[];
};

export async function cashFlowOutlook(userId: string, now = new Date()): Promise<CashFlowOutlook> {
  const fourWeeksAgo = new Date(now.getTime() - 28 * 86_400_000);
  const [projects, invoices, payrollRows] = await Promise.all([
    db.select().from(projectsTable).where(and(eq(projectsTable.userId, userId), inArray(projectsTable.status, ["planning", "active"]), isNull(projectsTable.archivedAt))).limit(500),
    db.select().from(invoicesTable).where(and(eq(invoicesTable.userId, userId), isNull(invoicesTable.archivedAt), inArray(invoicesTable.status, [...OPEN_INVOICE, "draft"]))).limit(2000),
    db
      .select({ hours: timeEntriesTable.hours, rate: timeEntriesTable.rateCentsSnapshot, burden: timeEntriesTable.burdenPercentSnapshot, status: timeEntriesTable.status, date: timeEntriesTable.date })
      .from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.userId, userId), inArray(timeEntriesTable.status, ["approved", "submitted"]), gte(timeEntriesTable.date, fourWeeksAgo))),
  ]);
  const projectIds = projects.map((p) => p.id);
  const [milestones, budgetLines, costs] = await Promise.all([
    projectIds.length ? db.select().from(milestonesTable).where(inArray(milestonesTable.projectId, projectIds)) : Promise.resolve([] as (typeof milestonesTable.$inferSelect)[]),
    projectIds.length ? db.select().from(costBudgetLinesTable).where(inArray(costBudgetLinesTable.projectId, projectIds)) : Promise.resolve([] as (typeof costBudgetLinesTable.$inferSelect)[]),
    projectIds.length ? db.select({ projectId: costEntriesTable.projectId, category: costEntriesTable.category, totalCents: costEntriesTable.totalCents }).from(costEntriesTable).where(and(inArray(costEntriesTable.projectId, projectIds), eq(costEntriesTable.status, "confirmed"))) : Promise.resolve([] as { projectId: string | null; category: string; totalCents: number }[]),
  ]);

  // Payroll: approved labour in the last 28 days → weekly run-rate; submitted (not yet approved) hours are owed now.
  let approvedCents = 0;
  let pendingCents = 0;
  for (const r of payrollRows) {
    const cents = labourCostCents(Number(r.hours), r.rate, Number(r.burden));
    if (r.status === "approved") approvedCents += cents;
    else pendingCents += cents;
  }
  const weeklyRunRateCents = Math.round(approvedCents / 4);
  const hasPayroll = weeklyRunRateCents > 0;
  const w0 = startOfWeekUtc(now);
  const weekOf = (d: Date) => Math.floor(daysBetween(w0, startOfWeekUtc(d)) / 7);
  // Wages keep flowing while a job is scheduled to run; without a planned end assume the whole window.
  let untilWeek: number | null = null;
  for (const p of projects) {
    if (!p.plannedEnd) { untilWeek = null; break; }
    const w = weekOf(p.plannedEnd);
    untilWeek = untilWeek === null ? w : Math.max(untilWeek, w);
  }
  if (projects.length === 0) untilWeek = -1;

  const open = invoices.filter((i) => (OPEN_INVOICE as readonly string[]).includes(i.status));
  const scheduled = invoices.filter((i) => i.status === "draft" && i.type !== "credit_note" && (i.scheduledFor || i.autoSendAt));
  const upcomingTerms: UpcomingTermLike[] = [];
  const remainingBudgets: RemainingBudgetLike[] = [];
  const budgetAlerts: CashFlowOutlook["budgetAlerts"] = [];
  for (const p of projects) {
    const fullBudget = budgetLines.filter((b) => b.projectId === p.id).reduce((s, b) => s + b.plannedCents, 0);
    const fullCost = costs.filter((c) => c.projectId === p.id).reduce((s, c) => s + c.totalCents, 0);
    const level = budgetAlertLevel(fullCost, fullBudget);
    if (level) budgetAlerts.push({ id: p.id, name: p.name, pct: Math.round((fullCost / fullBudget) * 100), level });
    const ms = milestones.filter((m) => m.projectId === p.id);
    const sched = scheduleVariance(ms, now);
    for (const m of ms) {
      if (m.status === "completed" || m.status === "skipped" || !m.paymentAmountCents) continue;
      if (invoices.some((i) => i.milestoneId === m.id && i.status !== "void")) continue;
      upcomingTerms.push({ amountCents: m.paymentAmountCents, expectedDate: m.plannedEnd ? new Date(m.plannedEnd.getTime() + sched.daysBehind * 86_400_000) : null });
    }
    const lines = budgetLines.filter((b) => b.projectId === p.id && !(hasPayroll && b.category === "labour"));
    const budgetCents = lines.reduce((s, b) => s + b.plannedCents, 0);
    const spent = costs.filter((c) => c.projectId === p.id && !(hasPayroll && c.category === "labour")).reduce((s, c) => s + c.totalCents, 0);
    const remaining = budgetCents - spent;
    if (remaining > 0) remainingBudgets.push({ remainingCents: remaining, from: now, to: p.plannedEnd && p.plannedEnd > now ? p.plannedEnd : null });
  }

  const weeks = cashFlowForecast({
    openInvoices: open.map((i) => ({ balanceCents: balanceCents(i), dueDate: i.dueDate, status: i.status })),
    scheduledInvoices: scheduled.map((i) => ({ totalCents: i.totalCents, sendAt: (i.scheduledFor ?? i.autoSendAt)!, termDays: Math.max(0, Math.round((i.dueDate.getTime() - i.issueDate.getTime()) / 86_400_000)) })),
    upcomingTerms,
    remainingBudgets,
    payroll: hasPayroll || pendingCents > 0 ? { weeklyRunRateCents, pendingCents, untilWeek } : null,
    weeks: OUTLOOK_WEEKS,
    now,
  });
  const inCents = weeks.reduce((s, w) => s + w.dueCents + w.overdueCents + w.scheduledCents + w.expectedCents, 0);
  const outCents = weeks.reduce((s, w) => s + w.outflowCents + w.payrollCents, 0);
  let lowest = weeks[0] ?? null;
  for (const w of weeks) if (lowest && w.cumulativeCents < lowest.cumulativeCents) lowest = w;
  return {
    days: OUTLOOK_DAYS,
    weeks,
    totals: { inCents, outCents, netCents: inCents - outCents, lowestCumulativeCents: lowest?.cumulativeCents ?? 0, lowestWeek: lowest?.week ?? null },
    sources: { openInvoices: open.length, overdueInvoices: open.filter((i) => i.status === "overdue").length, scheduledInvoices: scheduled.length, upcomingTerms: upcomingTerms.length, activeJobs: projects.length, payrollWeeklyCents: weeklyRunRateCents, payrollPendingCents: pendingCents },
    budgetAlerts: budgetAlerts.sort((a, b) => b.pct - a.pct),
  };
}
