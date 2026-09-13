// Phase 5 — assistant tool set. Read tools answer from the DB; propose_*
// tools never write: they validate the arguments and hand back a proposal
// the user confirms from a card (see apply.ts).
import { z } from "zod";
import type { OpenAI } from "@workspace/integrations-openai-ai-server";
import {
  db,
  projectsTable,
  milestonesTable,
  projectTasksTable,
  costBudgetLinesTable,
  costEntriesTable,
  invoicesTable,
  timeEntriesTable,
  collaboratorsTable,
  clientsTable,
  COST_CATEGORIES,
  PAYMENT_METHODS,
  computeTax,
  type Project,
  type ProposalKind,
} from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { balanceCents } from "../invoices/math.js";
import { toIsoDate } from "../jobs/dates.js";
import { companyAnalytics, jobAnalytics } from "../analytics/service.js";

export type ToolContext = { userId: string; projectId: string | null; province: string | null; now: Date };

const dollars = (cents: number) => Math.round(cents) / 100;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

// ── Definitions (OpenAI function-calling schema) ─────────────────────────────

const jobIdProp = { job_id: { type: "string", description: "Job id. Omit to use the current job." } } as const;

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  { type: "function", function: { name: "get_job_summary", description: "Value, progress, schedule, budget vs actual costs, invoicing status and milestones (with ids) of a job.", parameters: { type: "object", properties: { ...jobIdProp }, additionalProperties: false } } },
  { type: "function", function: { name: "list_jobs", description: "All jobs of the company with status, value, progress and next milestone.", parameters: { type: "object", properties: { status: { type: "string", enum: ["planning", "active", "suspended", "completed"] } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_costs", description: "Cost entries of a job (or all jobs), newest first, with ids.", parameters: { type: "object", properties: { ...jobIdProp, category: { type: "string", enum: [...COST_CATEGORIES] }, status: { type: "string", enum: ["pending_review", "confirmed"] }, limit: { type: "integer", minimum: 1, maximum: 100 } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_invoices", description: "Invoices of a job (or all jobs) with ids, status, totals, balances and due dates.", parameters: { type: "object", properties: { ...jobIdProp, status: { type: "string", enum: ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "void", "open"] } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_time_entries", description: "Hours logged by workers on a job (or all jobs), with approval status.", parameters: { type: "object", properties: { ...jobIdProp, status: { type: "string", enum: ["submitted", "approved", "rejected"] }, limit: { type: "integer", minimum: 1, maximum: 100 } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_schedule_risks", description: "Late milestones and forecast end date of a job; without a job: every job's risk flags (over budget, behind schedule, overdue invoices, unbilled work).", parameters: { type: "object", properties: { ...jobIdProp }, additionalProperties: false } } },
  { type: "function", function: { name: "get_company_overview", description: "Company-wide invoiced / collected / costs / margin for recent months, accounts receivable aging and the 8-week cash-flow forecast.", parameters: { type: "object", properties: { months: { type: "integer", minimum: 3, maximum: 12 } }, additionalProperties: false } } },
  {
    type: "function",
    function: {
      name: "propose_cost_entry",
      description: "Propose adding a cost (material purchase, subcontractor bill, permit…) to a job. The user must confirm before anything is saved.",
      parameters: {
        type: "object",
        properties: { ...jobIdProp, category: { type: "string", enum: [...COST_CATEGORIES] }, vendor: { type: "string" }, description: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD, defaults to today" }, amount: { type: "number", description: "Amount in CAD dollars" }, tax_included: { type: "boolean", description: "true when the amount already includes sales tax (default true)" }, milestone_id: { type: "string" } },
        required: ["category", "amount"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_milestone_update",
      description: "Propose starting, completing, reopening, renaming or re-dating a milestone. Completing a milestone releases its payment term (an invoice gets drafted). The user must confirm.",
      parameters: {
        type: "object",
        properties: { ...jobIdProp, milestone_id: { type: "string" }, status: { type: "string", enum: ["planned", "in_progress", "completed", "skipped"] }, planned_start: { type: "string", description: "YYYY-MM-DD" }, planned_end: { type: "string", description: "YYYY-MM-DD" }, title: { type: "string" } },
        required: ["milestone_id"],
        additionalProperties: false,
      },
    },
  },
  { type: "function", function: { name: "propose_task", description: "Propose adding a to-do task to a job, optionally under a milestone. The user must confirm.", parameters: { type: "object", properties: { ...jobIdProp, title: { type: "string" }, milestone_id: { type: "string" }, due_date: { type: "string", description: "YYYY-MM-DD" } }, required: ["title"], additionalProperties: false } } },
  {
    type: "function",
    function: {
      name: "propose_invoice",
      description: "Propose drafting an invoice for a job: the deposit, a milestone's payment term, the final balance or the holdback release. Nothing is sent; the user confirms and then reviews the draft.",
      parameters: { type: "object", properties: { ...jobIdProp, kind: { type: "string", enum: ["deposit", "term", "final", "holdback_release"] }, milestone_id: { type: "string", description: "Required for kind = term" } }, required: ["kind"], additionalProperties: false },
    },
  },
  { type: "function", function: { name: "propose_send_invoice", description: "Propose emailing a draft (or re-sending a sent) invoice to the customer. The user must confirm.", parameters: { type: "object", properties: { invoice_id: { type: "string" }, message: { type: "string", description: "Optional note in the email" } }, required: ["invoice_id"], additionalProperties: false } } },
  {
    type: "function",
    function: {
      name: "propose_record_payment",
      description: "Propose recording a payment received against a sent invoice. The user must confirm.",
      parameters: { type: "object", properties: { invoice_id: { type: "string" }, amount: { type: "number", description: "CAD dollars; defaults to the balance" }, method: { type: "string", enum: PAYMENT_METHODS.filter((m) => m !== "credit_note") }, date: { type: "string", description: "YYYY-MM-DD" }, reference: { type: "string" } }, required: ["invoice_id"], additionalProperties: false },
    },
  },
];

export const PROPOSAL_TOOLS: Record<string, ProposalKind> = {
  propose_cost_entry: "cost_entry",
  propose_milestone_update: "milestone_update",
  propose_task: "task",
  propose_invoice: "invoice",
  propose_send_invoice: "send_invoice",
  propose_record_payment: "record_payment",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resolveProject(ctx: ToolContext, jobId?: string | null): Promise<Project | null> {
  const id = jobId || ctx.projectId;
  if (!id) return null;
  const [p] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, ctx.userId)));
  return p ?? null;
}

async function projectNames(userId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const clean = [...new Set(ids.filter((x): x is string => !!x))];
  if (!clean.length) return new Map();
  const rows = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(and(eq(projectsTable.userId, userId), inArray(projectsTable.id, clean)));
  return new Map(rows.map((r) => [r.id, r.name]));
}

function invoiceBrief(i: typeof invoicesTable.$inferSelect, projectName?: string | null) {
  return { id: i.id, number: i.number, type: i.type, status: i.status, job: projectName ?? null, customer: i.customer.name, issue_date: toIsoDate(i.issueDate), due_date: toIsoDate(i.dueDate), total: dollars(i.totalCents), paid: dollars(i.paidCents), balance: dollars(balanceCents(i)), payment_term: i.paymentTermLabel };
}

// ── Read tools ───────────────────────────────────────────────────────────────

const ReadArgs = {
  get_job_summary: z.object({ job_id: z.string().optional() }),
  list_jobs: z.object({ status: z.enum(["planning", "active", "suspended", "completed"]).optional() }),
  list_costs: z.object({ job_id: z.string().optional(), category: z.enum(COST_CATEGORIES).optional(), status: z.enum(["pending_review", "confirmed"]).optional(), limit: z.number().int().min(1).max(100).optional() }),
  list_invoices: z.object({ job_id: z.string().optional(), status: z.enum(["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "void", "open"]).optional() }),
  list_time_entries: z.object({ job_id: z.string().optional(), status: z.enum(["submitted", "approved", "rejected"]).optional(), limit: z.number().int().min(1).max(100).optional() }),
  get_schedule_risks: z.object({ job_id: z.string().optional() }),
  get_company_overview: z.object({ months: z.number().int().min(3).max(12).optional() }),
};

export async function runReadTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case "get_job_summary": {
      const a = ReadArgs.get_job_summary.parse(rawArgs);
      const p = await resolveProject(ctx, a.job_id);
      if (!p) return { error: "No job selected. Pass job_id (see list_jobs)." };
      const [ms, tasks, client, an] = await Promise.all([
        db.select().from(milestonesTable).where(eq(milestonesTable.projectId, p.id)).orderBy(asc(milestonesTable.sortOrder)),
        db.select().from(projectTasksTable).where(eq(projectTasksTable.projectId, p.id)),
        p.clientId ? db.select({ name: clientsTable.name, email: clientsTable.email }).from(clientsTable).where(eq(clientsTable.id, p.clientId)).then((r) => r[0] ?? null) : Promise.resolve(null),
        jobAnalytics(p, ctx.now),
      ]);
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        client: client?.name ?? null,
        address: p.address,
        province: p.province,
        value_incl_tax: dollars(p.contractValueCents + p.changeOrdersCents),
        value_pre_tax: dollars(an.subtotalCents),
        change_orders_incl_tax: dollars(p.changeOrdersCents),
        progress_percent: p.progressPercent,
        planned_start: toIsoDate(p.plannedStart ?? p.startDate),
        planned_end: an.schedule.plannedEnd,
        forecast_end: an.schedule.forecastEnd,
        days_behind: an.schedule.daysBehind,
        budget: { planned: dollars(an.budgetCents), actual_confirmed: dollars(an.costCents), pending_review: dollars(an.pendingCostCents), by_category: an.categories.map((c) => ({ category: c.category, planned: dollars(c.plannedCents), actual: dollars(c.actualCents), used_percent: c.usedPercent })) },
        earned_value: { work_done_value: dollars(an.earned.earnedCents), invoiced_pre_tax: dollars(an.earned.invoicedSubtotalCents), unbilled_work: dollars(an.earned.billingGapCents), projected_final_cost: an.earned.projectedFinalCostCents === null ? null : dollars(an.earned.projectedFinalCostCents), projected_margin_percent: an.earned.projectedMarginPercent },
        invoicing: { invoiced: dollars(an.invoices.invoicedCents), collected: dollars(an.invoices.collectedCents), outstanding: dollars(an.invoices.outstandingCents), overdue: dollars(an.invoices.overdueCents), drafts: an.invoices.draftCount, upcoming_terms: dollars(an.invoices.upcomingCents) },
        milestones: ms.map((m) => ({ id: m.id, title: m.title, status: m.status, planned_start: toIsoDate(m.plannedStart), planned_end: toIsoDate(m.plannedEnd), actual_end: toIsoDate(m.actualEnd), payment_term: m.paymentTermLabel, payment_amount: m.paymentAmountCents ? dollars(m.paymentAmountCents) : null, open_tasks: tasks.filter((t) => t.milestoneId === m.id && t.status !== "done").length })),
        open_tasks: tasks.filter((t) => t.status !== "done").slice(0, 30).map((t) => ({ id: t.id, title: t.title, milestone_id: t.milestoneId, due: toIsoDate(t.dueDate) })),
      };
    }
    case "list_jobs": {
      const a = ReadArgs.list_jobs.parse(rawArgs);
      const rows = await db.select().from(projectsTable).where(a.status ? and(eq(projectsTable.userId, ctx.userId), eq(projectsTable.status, a.status)) : eq(projectsTable.userId, ctx.userId)).orderBy(desc(projectsTable.createdAt)).limit(100);
      const ids = rows.map((r) => r.id);
      const ms = ids.length ? await db.select().from(milestonesTable).where(inArray(milestonesTable.projectId, ids)).orderBy(asc(milestonesTable.sortOrder)) : [];
      const clientIds = [...new Set(rows.map((r) => r.clientId).filter((x): x is string => !!x))];
      const clients = clientIds.length ? await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, clientIds)) : [];
      const cname = new Map(clients.map((c) => [c.id, c.name]));
      return rows.map((p) => {
        const next = ms.find((m) => m.projectId === p.id && (m.status === "planned" || m.status === "in_progress"));
        return { id: p.id, name: p.name, status: p.status, client: p.clientId ? (cname.get(p.clientId) ?? null) : null, value_incl_tax: dollars(p.contractValueCents + p.changeOrdersCents), progress_percent: p.progressPercent, planned_end: toIsoDate(p.plannedEnd ?? p.endDate), next_milestone: next ? { id: next.id, title: next.title, planned_end: toIsoDate(next.plannedEnd) } : null };
      });
    }
    case "list_costs": {
      const a = ReadArgs.list_costs.parse(rawArgs);
      const p = a.job_id || ctx.projectId ? await resolveProject(ctx, a.job_id) : null;
      if ((a.job_id || ctx.projectId) && !p) return { error: "Job not found" };
      const conds = [eq(costEntriesTable.userId, ctx.userId)];
      if (p) conds.push(eq(costEntriesTable.projectId, p.id));
      if (a.category) conds.push(eq(costEntriesTable.category, a.category));
      if (a.status) conds.push(eq(costEntriesTable.status, a.status));
      const rows = await db.select().from(costEntriesTable).where(and(...conds)).orderBy(desc(costEntriesTable.date)).limit(a.limit ?? 40);
      const names = await projectNames(ctx.userId, rows.map((r) => r.projectId));
      return rows.map((c) => ({ id: c.id, job: c.projectId ? (names.get(c.projectId) ?? null) : null, date: toIsoDate(c.date), category: c.category, vendor: c.vendor, description: c.description, total_incl_tax: dollars(c.totalCents), pre_tax: dollars(c.subtotalCents), status: c.status, source: c.source }));
    }
    case "list_invoices": {
      const a = ReadArgs.list_invoices.parse(rawArgs);
      const p = a.job_id || ctx.projectId ? await resolveProject(ctx, a.job_id) : null;
      if ((a.job_id || ctx.projectId) && !p) return { error: "Job not found" };
      const conds = [eq(invoicesTable.userId, ctx.userId)];
      if (p) conds.push(eq(invoicesTable.projectId, p.id));
      if (a.status === "open") conds.push(inArray(invoicesTable.status, ["sent", "viewed", "partially_paid", "overdue"]));
      else if (a.status) conds.push(eq(invoicesTable.status, a.status));
      const rows = await db.select().from(invoicesTable).where(and(...conds)).orderBy(desc(invoicesTable.issueDate)).limit(60);
      const names = await projectNames(ctx.userId, rows.map((r) => r.projectId));
      return rows.map((i) => invoiceBrief(i, i.projectId ? names.get(i.projectId) : null));
    }
    case "list_time_entries": {
      const a = ReadArgs.list_time_entries.parse(rawArgs);
      const p = a.job_id || ctx.projectId ? await resolveProject(ctx, a.job_id) : null;
      if ((a.job_id || ctx.projectId) && !p) return { error: "Job not found" };
      const conds = [eq(timeEntriesTable.userId, ctx.userId)];
      if (p) conds.push(eq(timeEntriesTable.projectId, p.id));
      if (a.status) conds.push(eq(timeEntriesTable.status, a.status));
      const rows = await db.select({ e: timeEntriesTable, worker: collaboratorsTable.name }).from(timeEntriesTable).innerJoin(collaboratorsTable, eq(collaboratorsTable.id, timeEntriesTable.workerId)).where(and(...conds)).orderBy(desc(timeEntriesTable.date)).limit(a.limit ?? 40);
      const names = await projectNames(ctx.userId, rows.map((r) => r.e.projectId));
      return rows.map((r) => ({ id: r.e.id, worker: r.worker, job: names.get(r.e.projectId) ?? null, date: toIsoDate(r.e.date), hours: Number(r.e.hours), status: r.e.status, labour_cost: dollars(Math.round(Number(r.e.hours) * r.e.rateCentsSnapshot * (1 + Number(r.e.burdenPercentSnapshot) / 100))), note: r.e.note }));
    }
    case "get_schedule_risks": {
      const a = ReadArgs.get_schedule_risks.parse(rawArgs);
      const p = a.job_id || ctx.projectId ? await resolveProject(ctx, a.job_id) : null;
      if (p) {
        const an = await jobAnalytics(p, ctx.now);
        return { job: p.name, planned_end: an.schedule.plannedEnd, forecast_end: an.schedule.forecastEnd, days_behind: an.schedule.daysBehind, late_milestones: an.schedule.rows.filter((r) => r.slipDays > 0).map((r) => ({ id: r.id, title: r.title, status: r.status, slip_days: r.slipDays, state: r.state })), over_budget_categories: an.categories.filter((c) => c.plannedCents > 0 && c.actualCents > c.plannedCents).map((c) => ({ category: c.category, over_by: dollars(c.actualCents - c.plannedCents) })), unbilled_work: dollars(an.earned.billingGapCents), overdue_invoices: dollars(an.invoices.overdueCents) };
      }
      const ca = await companyAnalytics(ctx.userId, { months: 3, now: ctx.now });
      return ca.jobs.risks.map((r) => ({ job_id: r.id, job: r.name, flags: r.flags, over_budget_by: dollars(r.detail.overBudgetCents), days_behind: r.detail.daysBehind, overdue_invoices: dollars(r.detail.overdueCents), unbilled_work: dollars(r.detail.billingGapCents) }));
    }
    case "get_company_overview": {
      const a = ReadArgs.get_company_overview.parse(rawArgs);
      const ca = await companyAnalytics(ctx.userId, { months: a.months ?? 6, now: ctx.now });
      return {
        months: ca.months.map((m) => ({ month: m.month, invoiced: dollars(m.invoicedCents), collected: dollars(m.collectedCents), costs: dollars(m.costCents), margin_percent: m.marginPercent })),
        totals: { invoiced: dollars(ca.totals.invoicedCents), collected: dollars(ca.totals.collectedCents), costs: dollars(ca.totals.costCents), margin_percent: ca.totals.marginPercent, outstanding: dollars(ca.totals.outstandingCents), overdue: dollars(ca.totals.overdueCents), upcoming_billings: dollars(ca.totals.pipelineCents) },
        ar_aging: { not_due: dollars(ca.aging.current), d1_30: dollars(ca.aging.d1_30), d31_60: dollars(ca.aging.d31_60), d61_90: dollars(ca.aging.d61_90), d90_plus: dollars(ca.aging.d90_plus) },
        cash_flow_weeks: ca.cashFlow.map((w) => ({ week_of: w.week, invoices_due: dollars(w.dueCents + w.overdueCents), expected_billings: dollars(w.expectedCents), planned_costs: dollars(w.outflowCents), net: dollars(w.netCents) })),
        jobs_by_status: ca.jobs.byStatus,
        risks: ca.jobs.risks.slice(0, 8).map((r) => ({ job_id: r.id, job: r.name, flags: r.flags })),
      };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

// ── Proposal validation ──────────────────────────────────────────────────────

export type ValidatedProposal = { kind: ProposalKind; projectId: string | null; summary: string; payload: Record<string, unknown> };

const ProposeArgs = {
  propose_cost_entry: z.object({ job_id: z.string().optional(), category: z.enum(COST_CATEGORIES), vendor: z.string().max(200).optional(), description: z.string().max(500).optional(), date: z.string().regex(dateRe).optional(), amount: z.number().positive().max(10_000_000), tax_included: z.boolean().optional(), milestone_id: z.string().optional() }),
  propose_milestone_update: z.object({ job_id: z.string().optional(), milestone_id: z.string(), status: z.enum(["planned", "in_progress", "completed", "skipped"]).optional(), planned_start: z.string().regex(dateRe).optional(), planned_end: z.string().regex(dateRe).optional(), title: z.string().min(1).max(200).optional() }),
  propose_task: z.object({ job_id: z.string().optional(), title: z.string().min(1).max(300), milestone_id: z.string().optional(), due_date: z.string().regex(dateRe).optional() }),
  propose_invoice: z.object({ job_id: z.string().optional(), kind: z.enum(["deposit", "term", "final", "holdback_release"]), milestone_id: z.string().optional() }),
  propose_send_invoice: z.object({ invoice_id: z.string(), message: z.string().max(2000).optional() }),
  propose_record_payment: z.object({ invoice_id: z.string(), amount: z.number().positive().optional(), method: z.enum(PAYMENT_METHODS.filter((m) => m !== "credit_note") as [string, ...string[]]).optional(), date: z.string().regex(dateRe).optional(), reference: z.string().max(200).optional() }),
};

const money = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

/** Validates propose_* arguments against the user's data and returns the proposal to store, or an error string for the model. */
export async function validateProposal(name: string, rawArgs: unknown, ctx: ToolContext): Promise<{ ok: true; proposal: ValidatedProposal } | { ok: false; error: string }> {
  try {
    switch (name) {
      case "propose_cost_entry": {
        const a = ProposeArgs.propose_cost_entry.parse(rawArgs);
        const p = await resolveProject(ctx, a.job_id);
        if (!p) return { ok: false, error: "Job not found — pass job_id." };
        const province = p.province ?? ctx.province;
        const taxIncluded = a.tax_included ?? true;
        let subtotalCents: number, taxCents: number, totalCents: number;
        const breakdown: Record<string, number> = {};
        if (taxIncluded) {
          totalCents = Math.round(a.amount * 100);
          const { profile } = computeTax(1, province);
          const rate = profile.components.reduce((s, c) => s + c.rate, 0) / 100;
          subtotalCents = Math.round(totalCents / (1 + rate));
          taxCents = totalCents - subtotalCents;
          for (const c of profile.components) breakdown[c.code] = Math.round(subtotalCents * (c.rate / 100));
        } else {
          subtotalCents = Math.round(a.amount * 100);
          const tax = computeTax(a.amount, province);
          for (const l of tax.lines) breakdown[l.code] = Math.round(l.amount * 100);
          taxCents = Math.round(tax.total * 100);
          totalCents = subtotalCents + taxCents;
        }
        let milestoneId: string | null = null;
        if (a.milestone_id) {
          const [m] = await db.select({ id: milestonesTable.id }).from(milestonesTable).where(and(eq(milestonesTable.id, a.milestone_id), eq(milestonesTable.projectId, p.id)));
          milestoneId = m?.id ?? null;
        }
        const payload = { projectId: p.id, category: a.category, vendor: a.vendor ?? "", description: a.description ?? "", date: a.date ?? toIsoDate(ctx.now), subtotalCents, taxCents, taxBreakdown: breakdown, totalCents, milestoneId };
        return { ok: true, proposal: { kind: "cost_entry", projectId: p.id, summary: `${money(totalCents)} ${a.category}${a.vendor ? ` — ${a.vendor}` : ""} on ${p.name}`, payload } };
      }
      case "propose_milestone_update": {
        const a = ProposeArgs.propose_milestone_update.parse(rawArgs);
        const p = await resolveProject(ctx, a.job_id);
        if (!p) return { ok: false, error: "Job not found — pass job_id." };
        const [m] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, a.milestone_id), eq(milestonesTable.projectId, p.id)));
        if (!m) return { ok: false, error: "Milestone not found on that job (use the ids from get_job_summary)." };
        if (!a.status && !a.planned_start && !a.planned_end && !a.title) return { ok: false, error: "Nothing to change." };
        const parts: string[] = [];
        if (a.status) parts.push(a.status === "completed" ? "mark completed" : a.status === "in_progress" ? "start" : a.status === "skipped" ? "skip" : "reopen");
        if (a.planned_start || a.planned_end) parts.push(`re-date ${a.planned_start ?? toIsoDate(m.plannedStart) ?? "?"} → ${a.planned_end ?? toIsoDate(m.plannedEnd) ?? "?"}`);
        if (a.title) parts.push(`rename to "${a.title}"`);
        const payload = { projectId: p.id, milestoneId: m.id, status: a.status ?? null, plannedStart: a.planned_start ?? null, plannedEnd: a.planned_end ?? null, title: a.title ?? null, releasesPaymentTerm: a.status === "completed" && m.paymentTermLabel ? m.paymentTermLabel : null };
        return { ok: true, proposal: { kind: "milestone_update", projectId: p.id, summary: `${parts.join(", ")}: ${m.title}${payload.releasesPaymentTerm ? ` (releases "${payload.releasesPaymentTerm}")` : ""}`, payload } };
      }
      case "propose_task": {
        const a = ProposeArgs.propose_task.parse(rawArgs);
        const p = await resolveProject(ctx, a.job_id);
        if (!p) return { ok: false, error: "Job not found — pass job_id." };
        let milestoneId: string | null = null;
        if (a.milestone_id) {
          const [m] = await db.select({ id: milestonesTable.id }).from(milestonesTable).where(and(eq(milestonesTable.id, a.milestone_id), eq(milestonesTable.projectId, p.id)));
          milestoneId = m?.id ?? null;
        }
        return { ok: true, proposal: { kind: "task", projectId: p.id, summary: `Task "${a.title}"${a.due_date ? ` due ${a.due_date}` : ""} on ${p.name}`, payload: { projectId: p.id, title: a.title, milestoneId, dueDate: a.due_date ?? null } } };
      }
      case "propose_invoice": {
        const a = ProposeArgs.propose_invoice.parse(rawArgs);
        const p = await resolveProject(ctx, a.job_id);
        if (!p) return { ok: false, error: "Job not found — pass job_id." };
        if (a.kind === "deposit" && !p.contractId) return { ok: false, error: "This job has no signed contract, so there is no deposit term. Propose a manual cost or ask the user to create a manual invoice." };
        let milestoneTitle: string | null = null;
        if (a.kind === "term") {
          if (!a.milestone_id) return { ok: false, error: "kind = term needs milestone_id." };
          const [m] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, a.milestone_id), eq(milestonesTable.projectId, p.id)));
          if (!m) return { ok: false, error: "Milestone not found on that job." };
          if (!m.paymentTermId) return { ok: false, error: `Milestone "${m.title}" has no payment term linked; nothing to invoice for it.` };
          milestoneTitle = m.title;
        }
        const label = a.kind === "deposit" ? "deposit invoice" : a.kind === "final" ? "final invoice" : a.kind === "holdback_release" ? "holdback release invoice" : `progress invoice for "${milestoneTitle}"`;
        return { ok: true, proposal: { kind: "invoice", projectId: p.id, summary: `Draft the ${label} on ${p.name}`, payload: { projectId: p.id, kind: a.kind, milestoneId: a.milestone_id ?? null } } };
      }
      case "propose_send_invoice": {
        const a = ProposeArgs.propose_send_invoice.parse(rawArgs);
        const [inv] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, a.invoice_id), eq(invoicesTable.userId, ctx.userId)));
        if (!inv) return { ok: false, error: "Invoice not found." };
        if (inv.status === "void" || inv.status === "paid") return { ok: false, error: `Invoice ${inv.number} is ${inv.status}; it cannot be sent.` };
        if (!inv.customer.email) return { ok: false, error: `Invoice ${inv.number} has no customer email; ask the user to add one on the invoice page.` };
        return { ok: true, proposal: { kind: "send_invoice", projectId: inv.projectId, summary: `${inv.status === "draft" ? "Send" : "Re-send"} ${inv.number} (${money(inv.totalCents)}) to ${inv.customer.email}`, payload: { invoiceId: inv.id, message: a.message ?? "" } } };
      }
      case "propose_record_payment": {
        const a = ProposeArgs.propose_record_payment.parse(rawArgs);
        const [inv] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, a.invoice_id), eq(invoicesTable.userId, ctx.userId)));
        if (!inv) return { ok: false, error: "Invoice not found." };
        if (inv.status === "draft") return { ok: false, error: `Invoice ${inv.number} is still a draft; send it first.` };
        if (inv.status === "void" || inv.type === "credit_note") return { ok: false, error: `Invoice ${inv.number} cannot take payments.` };
        const balance = balanceCents(inv);
        const amountCents = a.amount ? Math.round(a.amount * 100) : balance;
        if (amountCents <= 0) return { ok: false, error: `Invoice ${inv.number} has no balance.` };
        return { ok: true, proposal: { kind: "record_payment", projectId: inv.projectId, summary: `Record ${money(amountCents)} ${a.method ?? "etransfer"} on ${inv.number}${amountCents < balance ? ` (partial, balance ${money(balance)})` : ""}`, payload: { invoiceId: inv.id, amountCents, method: a.method ?? "etransfer", date: a.date ?? toIsoDate(ctx.now), reference: a.reference ?? "" } } };
      }
      default:
        return { ok: false, error: `Unknown tool ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof z.ZodError ? `Invalid arguments: ${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` : (err as Error).message };
  }
}
