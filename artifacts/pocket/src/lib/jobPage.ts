// The Job screen's logic (Job.dc.html): the progress card, the figures, budget against actual, what is next. Pure, so it is
// tested without a screen.
import { COST_CATEGORIES, type CostCategory, type JobDetail, type JobMilestone } from "./jobDetail.ts";
import { TARGET_MARGIN_PCT } from "./jobSetup.ts";

export type JobTab = "overview" | "schedule" | "co" | "costs" | "inv" | "team" | "photos" | "msg" | "docs" | "ask";
export const TAB_ORDER: JobTab[] = ["overview", "schedule", "co", "costs", "inv", "team", "photos", "msg", "docs", "ask"];

export const taskDone = (status: string): boolean => status === "done";

export function milestoneCounts(ms: JobMilestone[]): { done: number; total: number } {
  return { done: ms.filter((m) => m.status === "completed").length, total: ms.length };
}

/** The share of a milestone's tasks that are done; null when it has none. */
export function tasksDoneShare(m: JobMilestone): number | null {
  return m.tasks.length ? m.tasks.filter((t) => taskDone(t.status)).length / m.tasks.length : null;
}

/** The milestone being worked on: the one in progress, else the first not done. */
export function currentMilestone(ms: JobMilestone[]): JobMilestone | null {
  return ms.find((m) => m.status === "in_progress") ?? ms.find((m) => m.status === "planned") ?? null;
}

export type Segment = { state: "done" | "current" | "todo"; fill: number };

/** One segment per milestone: done, the current one filled by its tasks (half when it has none), the rest empty. */
export function segments(ms: JobMilestone[]): Segment[] {
  const cur = currentMilestone(ms);
  return ms.map((m) => {
    if (m.status === "completed" || m.status === "skipped") return { state: "done", fill: 1 };
    if (cur && m.id === cur.id) return { state: "current", fill: tasksDoneShare(m) ?? 0.5 };
    return { state: "todo", fill: 0 };
  });
}

export type Figures = {
  contractCents: number;
  changeOrdersCents: number;
  invoicedCents: number;
  collectedCents: number;
  overdueCents: number;
  costCents: number;
  budgetCents: number;
  /** Costs as a whole percent of the budget; null without a budget. */
  costPct: number | null;
  pendingReceipts: number;
  marginCents: number;
  marginPct: number;
  onTarget: boolean;
};

/** Projected margin takes the larger of the budget and what has been spent as the cost of the job. */
export function figures(d: JobDetail): Figures {
  const contract = d.job.totalValueCents;
  const cost = d.costs.totalCents;
  const projected = Math.max(d.budgetTotalCents, cost);
  const marginCents = contract - projected;
  const marginPct = contract > 0 ? Math.round((marginCents / contract) * 100) : 0;
  return {
    contractCents: contract,
    changeOrdersCents: d.job.changeOrdersCents,
    invoicedCents: d.invoiceTotals.invoicedCents,
    collectedCents: d.invoiceTotals.collectedCents,
    overdueCents: d.invoiceTotals.overdueCents,
    costCents: cost,
    budgetCents: d.budgetTotalCents,
    costPct: d.budgetTotalCents > 0 ? Math.round((cost / d.budgetTotalCents) * 100) : null,
    pendingReceipts: d.costs.pendingCount,
    marginCents,
    marginPct,
    onTarget: marginPct >= TARGET_MARGIN_PCT,
  };
}

export type BudgetBar = { category: CostCategory; spentCents: number; plannedCents: number; ratio: number; tone: "ok" | "warn" | "bad" };

/** Budget against what is confirmed, by category. Over budget is `bad`; past 85 % is `warn` (permits are a fixed fee, so never). */
export function budgetBars(d: JobDetail): BudgetBar[] {
  return COST_CATEGORIES.map((category) => {
    const plannedCents = d.budget.filter((b) => b.category === category).reduce((n, b) => n + b.plannedCents, 0);
    const spentCents = d.costs.byCategory[category] ?? 0;
    const ratio = plannedCents > 0 ? spentCents / plannedCents : spentCents > 0 ? 1.01 : 0;
    const tone: BudgetBar["tone"] = ratio > 1 ? "bad" : ratio > 0.85 && category !== "permits_fees" ? "warn" : "ok";
    return { category, spentCents, plannedCents, ratio, tone };
  }).filter((b) => b.plannedCents > 0 || b.spentCents > 0);
}

export type UpNext = {
  milestone: JobMilestone;
  tasksLeft: number;
  tasksTotal: number;
  /** The payment released when it is done, with its share of the contract in whole percent. */
  payment: { label: string; cents: number; pct: number | null } | null;
  invoiced: boolean;
};

export function upNext(d: JobDetail): UpNext | null {
  const m = currentMilestone(d.milestones);
  if (!m) return null;
  const left = m.tasks.filter((t) => !taskDone(t.status)).length;
  const term = m.paymentTermId ? d.job.contract?.paymentSchedule.terms.find((t) => t.id === m.paymentTermId) : undefined;
  const cents = m.paymentAmountCents ?? 0;
  const total = d.job.contractValueCents;
  return {
    milestone: m,
    tasksLeft: left,
    tasksTotal: m.tasks.length,
    payment: m.paymentTermId ? { label: m.paymentTermLabel ?? term?.label ?? "", cents, pct: term?.amountType === "percent" ? term.value : total > 0 && cents > 0 ? Math.round((cents / total) * 100) : null } : null,
    invoiced: d.invoices.some((i) => i.paymentTermId === m.paymentTermId && i.status !== "void"),
  };
}

/** "Sep 8 – Oct 30" needs both ends; the job's own window, else the milestones'. */
export function jobWindow(d: JobDetail): { from: string; to: string } | null {
  const from = d.job.plannedStart ?? d.milestones.map((m) => m.plannedStart).filter((x): x is string => !!x).sort()[0] ?? null;
  const to = d.job.plannedEnd ?? d.milestones.map((m) => m.plannedEnd).filter((x): x is string => !!x).sort().slice(-1)[0] ?? null;
  return from && to ? { from, to } : null;
}
