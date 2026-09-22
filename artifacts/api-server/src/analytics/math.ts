// Pure analytics maths for Phase 5 dashboards — no DB access, unit-run in
// math.test.ts. Everything is integer cents; dates are JS Dates (UTC days).

export type MonthKey = string; // "2026-09"

export function monthKey(d: Date): MonthKey {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The last `n` month keys ending with the month of `now`, oldest first. */
export function lastMonths(n: number, now = new Date()): MonthKey[] {
  const out: MonthKey[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  return out;
}

export function startOfWeekUtc(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

export function addDaysUtc(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ── Company: monthly P&L ─────────────────────────────────────────────────────

export type InvoiceLike = { type: string; status: string; totalCents: number; issueDate: Date; projectId?: string | null };
export type PaymentLike = { amountCents: number; date: Date; creditNoteId?: string | null; invoiceType?: string };
export type CostLike = { totalCents: number; subtotalCents?: number; date: Date; status: string; category?: string; projectId?: string | null };

export type MonthPoint = { month: MonthKey; invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null };

/**
 * Per month: invoiced (non-void, non-draft, credit notes subtract), collected
 * (real payments — credit-note applications are not cash), confirmed costs
 * (pre-tax when known; input taxes are recoverable), margin = invoiced − costs.
 */
export function monthlySeries(params: { invoices: InvoiceLike[]; payments: PaymentLike[]; costs: CostLike[]; months: number; now?: Date }): MonthPoint[] {
  const keys = lastMonths(params.months, params.now);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const rows: MonthPoint[] = keys.map((month) => ({ month, invoicedCents: 0, collectedCents: 0, costCents: 0, marginCents: 0, marginPercent: null }));
  for (const inv of params.invoices) {
    if (inv.status === "void" || inv.status === "draft") continue;
    const i = idx.get(monthKey(inv.issueDate));
    if (i === undefined) continue;
    rows[i]!.invoicedCents += inv.type === "credit_note" ? -Math.abs(inv.totalCents) : inv.totalCents;
  }
  for (const p of params.payments) {
    if (p.creditNoteId) continue;
    if (p.invoiceType === "credit_note") continue;
    const i = idx.get(monthKey(p.date));
    if (i === undefined) continue;
    rows[i]!.collectedCents += p.amountCents;
  }
  for (const c of params.costs) {
    if (c.status !== "confirmed") continue;
    const i = idx.get(monthKey(c.date));
    if (i === undefined) continue;
    rows[i]!.costCents += c.subtotalCents ?? c.totalCents;
  }
  for (const r of rows) {
    r.marginCents = r.invoicedCents - r.costCents;
    r.marginPercent = r.invoicedCents > 0 ? Math.round((r.marginCents / r.invoicedCents) * 1000) / 10 : null;
  }
  return rows;
}

// ── Job: budget vs actual ────────────────────────────────────────────────────

export type BudgetLineLike = { category: string; plannedCents: number };
export type CategoryPoint = { category: string; plannedCents: number; actualCents: number; pendingCents: number; varianceCents: number; usedPercent: number | null };

export function budgetVsActual(budget: BudgetLineLike[], costs: CostLike[], categories: readonly string[]): CategoryPoint[] {
  return categories.map((category) => {
    const plannedCents = budget.filter((b) => b.category === category).reduce((s, b) => s + b.plannedCents, 0);
    const mine = costs.filter((c) => (c.category ?? "misc") === category);
    const actualCents = mine.filter((c) => c.status === "confirmed").reduce((s, c) => s + (c.subtotalCents ?? c.totalCents), 0);
    const pendingCents = mine.filter((c) => c.status !== "confirmed").reduce((s, c) => s + (c.subtotalCents ?? c.totalCents), 0);
    return { category, plannedCents, actualCents, pendingCents, varianceCents: plannedCents - actualCents, usedPercent: plannedCents > 0 ? Math.round((actualCents / plannedCents) * 100) : null };
  });
}

// ── Job: cumulative cost curve ───────────────────────────────────────────────

export type CurvePoint = { week: string; actualCents: number; plannedCents: number; invoicedCents: number; collectedCents: number };

/**
 * Weekly cumulative actual costs against a straight-line planned spend from
 * the job's planned start to planned end. Weeks run from the earliest of
 * (planned start, first cost) to the latest of (planned end, today).
 */
export function costCurve(params: { costs: CostLike[]; invoices?: InvoiceLike[]; payments?: PaymentLike[]; budgetCents: number; plannedStart: Date | null; plannedEnd: Date | null; now?: Date }): CurvePoint[] {
  const now = params.now ?? new Date();
  const confirmed = params.costs.filter((c) => c.status === "confirmed");
  const dates: Date[] = [now, ...confirmed.map((c) => c.date)];
  if (params.plannedStart) dates.push(params.plannedStart);
  if (params.plannedEnd) dates.push(params.plannedEnd);
  const first = startOfWeekUtc(new Date(Math.min(...dates.map((d) => d.getTime()))));
  const last = startOfWeekUtc(new Date(Math.max(...dates.map((d) => d.getTime()))));
  const weeks: Date[] = [];
  for (let w = first; w <= last && weeks.length < 120; w = addDaysUtc(w, 7)) weeks.push(w);
  const span = params.plannedStart && params.plannedEnd ? Math.max(1, params.plannedEnd.getTime() - params.plannedStart.getTime()) : null;
  const sumUpTo = <T extends { date: Date }>(rows: T[], end: Date, pick: (r: T) => number) => rows.filter((r) => r.date < end).reduce((s, r) => s + pick(r), 0);
  const liveInvoices = (params.invoices ?? []).filter((i) => i.status !== "void" && i.status !== "draft").map((i) => ({ date: i.issueDate, cents: i.type === "credit_note" ? -Math.abs(i.totalCents) : i.totalCents }));
  const cash = (params.payments ?? []).filter((p) => !p.creditNoteId);
  return weeks.map((w) => {
    const end = addDaysUtc(w, 7);
    const actualCents = sumUpTo(confirmed, end, (c) => c.subtotalCents ?? c.totalCents);
    let plannedCents = 0;
    if (span && params.plannedStart) {
      const ratio = Math.min(1, Math.max(0, (end.getTime() - params.plannedStart.getTime()) / span));
      plannedCents = Math.round(params.budgetCents * ratio);
    }
    return { week: isoDay(w), actualCents, plannedCents, invoicedCents: sumUpTo(liveInvoices, end, (i) => i.cents), collectedCents: sumUpTo(cash, end, (p) => p.amountCents) };
  });
}

// ── Job: schedule variance ───────────────────────────────────────────────────

export type MilestoneLike = { id: string; title: string; status: string; plannedStart: Date | null; plannedEnd: Date | null; actualStart: Date | null; actualEnd: Date | null; paymentAmountCents?: number | null; valueCents?: number };
export type MilestoneVariance = { id: string; title: string; status: string; plannedDays: number | null; slipDays: number; state: "done_on_time" | "done_late" | "on_track" | "late" | "not_started_late" | "pending" };

/** Slip in days per milestone: finished late, running past its planned end, or not started after its planned start. */
export function scheduleVariance(milestones: MilestoneLike[], now = new Date()): { rows: MilestoneVariance[]; daysBehind: number; lateCount: number } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const rows: MilestoneVariance[] = milestones.map((m) => {
    const plannedDays = m.plannedStart && m.plannedEnd ? daysBetween(m.plannedStart, m.plannedEnd) + 1 : null;
    if (m.status === "skipped") return { id: m.id, title: m.title, status: m.status, plannedDays, slipDays: 0, state: "pending" };
    if (m.status === "completed") {
      const slip = m.plannedEnd && m.actualEnd ? Math.max(0, daysBetween(m.plannedEnd, m.actualEnd)) : 0;
      return { id: m.id, title: m.title, status: m.status, plannedDays, slipDays: slip, state: slip > 0 ? "done_late" : "done_on_time" };
    }
    if (m.status === "in_progress") {
      const slip = m.plannedEnd ? Math.max(0, daysBetween(m.plannedEnd, today)) : 0;
      return { id: m.id, title: m.title, status: m.status, plannedDays, slipDays: slip, state: slip > 0 ? "late" : "on_track" };
    }
    const slip = m.plannedStart ? Math.max(0, daysBetween(m.plannedStart, today)) : 0;
    return { id: m.id, title: m.title, status: m.status, plannedDays, slipDays: slip, state: slip > 0 ? "not_started_late" : "pending" };
  });
  const open = rows.filter((r) => r.state === "late" || r.state === "not_started_late");
  return { rows, daysBehind: open.length ? Math.max(...open.map((r) => r.slipDays)) : 0, lateCount: open.length };
}

// ── Job: earned value & billing gap ──────────────────────────────────────────

export type EarnedValue = {
  earnedCents: number; // progress% × pre-tax job value
  invoicedSubtotalCents: number;
  billingGapCents: number; // earned − invoiced (positive = work done not yet billed)
  budgetEarnedCents: number; // progress% × budget
  costCents: number;
  costPerformance: number | null; // budgetEarned ÷ actual cost (>1 good)
  projectedFinalCostCents: number | null; // actual ÷ progress
  projectedMarginPercent: number | null;
};

export function earnedValue(params: { subtotalCents: number; progressPercent: number; invoicedSubtotalCents: number; budgetCents: number; costCents: number }): EarnedValue {
  const p = Math.min(100, Math.max(0, params.progressPercent)) / 100;
  const earnedCents = Math.round(params.subtotalCents * p);
  const budgetEarnedCents = Math.round(params.budgetCents * p);
  const costPerformance = params.costCents > 0 && budgetEarnedCents > 0 ? Math.round((budgetEarnedCents / params.costCents) * 100) / 100 : null;
  const projectedFinalCostCents = p >= 0.1 && params.costCents > 0 ? Math.round(params.costCents / p) : params.budgetCents > 0 ? params.budgetCents : null;
  const projectedMarginPercent = projectedFinalCostCents !== null && params.subtotalCents > 0 ? Math.round(((params.subtotalCents - projectedFinalCostCents) / params.subtotalCents) * 1000) / 10 : null;
  return { earnedCents, invoicedSubtotalCents: params.invoicedSubtotalCents, billingGapCents: earnedCents - params.invoicedSubtotalCents, budgetEarnedCents, costCents: params.costCents, costPerformance, projectedFinalCostCents, projectedMarginPercent };
}

// ── Company: cash-flow forecast ──────────────────────────────────────────────

export type OpenInvoiceLike = { balanceCents: number; dueDate: Date; status: string };
export type UpcomingTermLike = { amountCents: number; expectedDate: Date | null };
export type RemainingBudgetLike = { remainingCents: number; from: Date; to: Date | null };
/** Phase 79: a draft waiting for its send date (holdback release or review-then-auto-send) — cash expected at send + payment terms. */
export type ScheduledInvoiceLike = { totalCents: number; sendAt: Date; termDays: number };
/** Phase 79: payroll — the last four weeks' approved labour as a weekly run-rate, plus hours approved/submitted but not yet in a payroll export. */
export type PayrollLike = { weeklyRunRateCents: number; pendingCents: number; untilWeek: number | null };
export type CashWeek = { week: string; dueCents: number; overdueCents: number; scheduledCents: number; expectedCents: number; outflowCents: number; payrollCents: number; netCents: number; cumulativeCents: number };

/**
 * Next `weeks` weeks: invoices falling due (overdue balances land in week 0),
 * scheduled drafts (expected at their send date + terms), expected billings
 * from upcoming milestone payment terms, planned spend from remaining job
 * budgets spread evenly over each job's remaining schedule, and the payroll
 * run-rate (Phase 79). Callers that pass `payroll` should leave the labour
 * category out of `remainingBudgets` so wages are not counted twice.
 */
export function cashFlowForecast(params: { openInvoices: OpenInvoiceLike[]; upcomingTerms: UpcomingTermLike[]; remainingBudgets: RemainingBudgetLike[]; scheduledInvoices?: ScheduledInvoiceLike[]; payroll?: PayrollLike | null; weeks?: number; now?: Date }): CashWeek[] {
  const now = params.now ?? new Date();
  const weeks = params.weeks ?? 8;
  const w0 = startOfWeekUtc(now);
  const rows: CashWeek[] = Array.from({ length: weeks }, (_, i) => ({ week: isoDay(addDaysUtc(w0, i * 7)), dueCents: 0, overdueCents: 0, scheduledCents: 0, expectedCents: 0, outflowCents: 0, payrollCents: 0, netCents: 0, cumulativeCents: 0 }));
  const bucket = (d: Date) => Math.floor(daysBetween(w0, startOfWeekUtc(d)) / 7);
  for (const inv of params.openInvoices) {
    if (inv.balanceCents <= 0) continue;
    const b = bucket(inv.dueDate);
    if (b < 0) rows[0]!.overdueCents += inv.balanceCents;
    else if (b < weeks) rows[b]!.dueCents += inv.balanceCents;
  }
  for (const s of params.scheduledInvoices ?? []) {
    if (s.totalCents <= 0) continue;
    const expected = addDaysUtc(s.sendAt, Math.max(0, s.termDays));
    const b = Math.max(0, bucket(expected));
    if (b < weeks) rows[b]!.scheduledCents += s.totalCents;
  }
  for (const t of params.upcomingTerms) {
    if (!t.expectedDate || t.amountCents <= 0) continue;
    const b = Math.max(0, bucket(t.expectedDate));
    if (b < weeks) rows[b]!.expectedCents += t.amountCents;
  }
  for (const rb of params.remainingBudgets) {
    if (rb.remainingCents <= 0) continue;
    const from = Math.max(0, bucket(rb.from));
    const to = rb.to ? Math.max(from, bucket(rb.to)) : from + 3;
    const span = to - from + 1;
    const per = Math.round(rb.remainingCents / span);
    for (let b = from; b <= to && b < weeks; b++) rows[b]!.outflowCents += per;
  }
  if (params.payroll) {
    const p = params.payroll;
    if (p.pendingCents > 0) rows[0]!.payrollCents += p.pendingCents;
    if (p.weeklyRunRateCents > 0) {
      const last = p.untilWeek === null ? weeks - 1 : Math.min(weeks - 1, Math.max(0, p.untilWeek));
      for (let b = 0; b <= last; b++) rows[b]!.payrollCents += p.weeklyRunRateCents;
    }
  }
  let cum = 0;
  for (const r of rows) {
    r.netCents = r.dueCents + r.overdueCents + r.scheduledCents + r.expectedCents - r.outflowCents - r.payrollCents;
    cum += r.netCents;
    r.cumulativeCents = cum;
  }
  return rows;
}

// ── Job: budget alert level (Phase 79) ───────────────────────────────────────

export type BudgetAlertLevel = 0 | 90 | 100;

/** 100 once confirmed costs reach the budget, 90 from 90 % of it, else 0. A job with no budget never alerts. */
export function budgetAlertLevel(costCents: number, budgetCents: number): BudgetAlertLevel {
  if (budgetCents <= 0 || costCents <= 0) return 0;
  if (costCents >= budgetCents) return 100;
  if (costCents >= Math.ceil(budgetCents * 0.9)) return 90;
  return 0;
}

// ── Company: job risk flags ──────────────────────────────────────────────────

export type RiskFlag = "over_budget" | "budget_burn" | "behind_schedule" | "overdue_invoices" | "billing_gap" | "unbilled_completion";
export type JobRiskInput = { id: string; name: string; status: string; subtotalCents: number; budgetCents: number; costCents: number; progressPercent: number; invoicedSubtotalCents: number; overdueCents: number; daysBehind: number; plannedEnd: Date | null; completedAt: Date | null };
export type JobRisk = { id: string; name: string; flags: RiskFlag[]; score: number; detail: { overBudgetCents: number; burnPercent: number | null; daysBehind: number; overdueCents: number; billingGapCents: number } };

export function jobRisks(jobs: JobRiskInput[]): JobRisk[] {
  const out: JobRisk[] = [];
  for (const j of jobs) {
    if (j.status === "completed" && j.overdueCents <= 0 && j.invoicedSubtotalCents >= j.subtotalCents * 0.99) continue;
    const flags: RiskFlag[] = [];
    const overBudgetCents = j.budgetCents > 0 ? Math.max(0, j.costCents - j.budgetCents) : 0;
    const burnPercent = j.budgetCents > 0 && j.progressPercent > 0 ? Math.round((j.costCents / j.budgetCents) * 100) : null;
    const ev = earnedValue({ subtotalCents: j.subtotalCents, progressPercent: j.progressPercent, invoicedSubtotalCents: j.invoicedSubtotalCents, budgetCents: j.budgetCents, costCents: j.costCents });
    if (overBudgetCents > 0) flags.push("over_budget");
    else if (burnPercent !== null && burnPercent > j.progressPercent + 15 && j.costCents > 0) flags.push("budget_burn");
    if (j.daysBehind >= 3) flags.push("behind_schedule");
    if (j.overdueCents > 0) flags.push("overdue_invoices");
    if (j.status === "completed" && ev.billingGapCents > 100) flags.push("unbilled_completion");
    else if (ev.billingGapCents > Math.max(50_000, j.subtotalCents * 0.15)) flags.push("billing_gap");
    if (flags.length === 0) continue;
    const score = (flags.includes("over_budget") ? 40 : flags.includes("budget_burn") ? 20 : 0) + (flags.includes("behind_schedule") ? Math.min(30, j.daysBehind * 3) : 0) + (j.overdueCents > 0 ? 25 : 0) + (flags.includes("unbilled_completion") ? 30 : flags.includes("billing_gap") ? 15 : 0);
    out.push({ id: j.id, name: j.name, flags, score, detail: { overBudgetCents, burnPercent, daysBehind: j.daysBehind, overdueCents: j.overdueCents, billingGapCents: ev.billingGapCents } });
  }
  return out.sort((a, b) => b.score - a.score);
}
