// Job setup (JobSetup.dc.html): the AI's plan as a draft the contractor edits, then confirms. Pure, so it is tested without a
// screen. Milestones keep their order, each with a length in working days; "shift everything to start on" lays them out again
// one after another, weekends skipped. The budget is one amount per cost category; the margin follows it.
import { COST_CATEGORIES, type CostCategory, type JobDetail, type JobMilestone } from "./jobDetail.ts";

/** The board names a 30 % margin as the target. There is no setting for it yet (see the build log). */
export const TARGET_MARGIN_PCT = 30;

export type DraftMilestone = {
  /** The server's id; absent on a milestone added here. */
  id?: string;
  /** Local key for lists. */
  key: string;
  title: string;
  tasks: number;
  valueCents: number;
  /** Length in working days (at least 1). */
  days: number;
  start: string | null;
  end: string | null;
  term: { id: string; label: string; amountCents: number } | null;
};

export const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDay = (s: string): Date => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y!, m! - 1, d!, 12); };
const weekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** The same day, or the Monday after when it falls on a weekend. */
export function nextWork(d: Date): Date {
  const x = new Date(d);
  while (weekend(x)) x.setDate(x.getDate() + 1);
  return x;
}

/** `n` working days after `d`. */
export function addWork(d: Date, n: number): Date {
  const x = new Date(d);
  while (n > 0) { x.setDate(x.getDate() + 1); if (!weekend(x)) n--; }
  return x;
}

/** Working days from `a` to `b`, both counted (a single day is 1). */
export function workDays(a: Date, b: Date): number {
  let n = 0;
  const x = new Date(a);
  while (x <= b) { if (!weekend(x)) n++; x.setDate(x.getDate() + 1); }
  return Math.max(1, n);
}

export function draftFrom(detail: JobDetail): DraftMilestone[] {
  return detail.milestones.map((m) => draftOf(m));
}

function draftOf(m: JobMilestone): DraftMilestone {
  const days = m.plannedStart && m.plannedEnd ? workDays(parseDay(m.plannedStart), parseDay(m.plannedEnd)) : 1;
  return {
    id: m.id, key: m.id, title: m.title, tasks: m.tasks.length, valueCents: m.valueCents, days,
    start: m.plannedStart, end: m.plannedEnd,
    term: m.paymentTermId ? { id: m.paymentTermId, label: m.paymentTermLabel ?? "", amountCents: m.paymentAmountCents ?? 0 } : null,
  };
}

export function newMilestone(title: string, key: string): DraftMilestone {
  return { key, title, tasks: 0, valueCents: 0, days: 1, start: null, end: null, term: null };
}

/** Lays the milestones out one after another from `start` (a weekend moves to Monday), keeping each one's length. */
export function layout(list: DraftMilestone[], start: Date): DraftMilestone[] {
  let cur = nextWork(start);
  return list.map((m) => {
    const s = cur;
    const e = addWork(s, Math.max(1, m.days) - 1);
    cur = addWork(e, 1);
    return { ...m, start: isoDay(s), end: isoDay(e) };
  });
}

/** Each milestone's share of the work, in whole percent; equal shares when no value is set. Shares add up to 100. */
export function shares(list: DraftMilestone[]): number[] {
  if (!list.length) return [];
  const total = list.reduce((n, m) => n + m.valueCents, 0);
  const raw = total > 0 ? list.map((m) => (m.valueCents / total) * 100) : list.map(() => 100 / list.length);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((n, v) => n + v, 0);
  const order = raw.map((v, i) => ({ i, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f);
  for (const o of order) { if (left <= 0) break; out[o.i]!++; left--; }
  return out;
}

/** The window the plan covers and its working days; null until there are dates. */
export function window(list: DraftMilestone[]): { from: Date; to: Date; days: number } | null {
  const starts = list.map((m) => m.start).filter((x): x is string => !!x).sort();
  const ends = list.map((m) => m.end).filter((x): x is string => !!x).sort();
  if (!starts.length || !ends.length) return null;
  return { from: parseDay(starts[0]!), to: parseDay(ends[ends.length - 1]!), days: list.reduce((n, m) => n + m.days, 0) };
}

/** The next four Mondays and Wednesdays after `today`, for the "start on" chips. */
export function startOptions(today: Date): Date[] {
  const out: Date[] = [];
  const x = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  while (out.length < 4) {
    x.setDate(x.getDate() + 1);
    if (x.getDay() === 1 || x.getDay() === 3) out.push(new Date(x));
  }
  return out;
}

export type BudgetRow = { category: CostCategory; cents: number; note: string };

/** One row per category: the planned amount and the labels of the lines it came from. */
export function budgetRows(detail: JobDetail): BudgetRow[] {
  return COST_CATEGORIES.map((category) => {
    const lines = detail.budget.filter((b) => b.category === category);
    return { category, cents: lines.reduce((n, b) => n + b.plannedCents, 0), note: lines.map((b) => b.label.trim()).filter(Boolean).slice(0, 2).join(", ") };
  });
}

/** How much one tap on + or − moves a category: about 1 % of the contract, on a round number. */
export function stepCents(contractCents: number): number {
  const steps = [2500, 5000, 10_000, 25_000, 50_000, 100_000];
  const want = contractCents * 0.01;
  return steps.find((s) => s >= want) ?? steps[steps.length - 1]!;
}

export function margin(valueCents: number, costCents: number): { cents: number; pct: number } {
  const cents = valueCents - costCents;
  return { cents, pct: valueCents > 0 ? Math.round((cents / valueCents) * 1000) / 10 : 0 };
}

/** The request body for PUT / POST /api/jobs/:id/setup(/confirm). Empty categories are left out. */
export function setupBody(p: { name: string; plannedStart: string | null; milestones: DraftMilestone[]; budget: BudgetRow[] }) {
  return {
    name: p.name.trim(),
    plannedStart: p.plannedStart,
    milestones: p.milestones.map((m) => ({
      ...(m.id ? { id: m.id } : null),
      title: m.title.trim(),
      plannedStart: m.start,
      plannedEnd: m.end,
      paymentTermId: m.term ? m.term.id : null,
      valueCents: m.valueCents,
    })),
    budget: p.budget.filter((b) => b.cents > 0).map((b) => ({ category: b.category, label: b.note.slice(0, 200), plannedCents: b.cents })),
  };
}
