// Compliance.dc.html: the filing calendar made of the server's derived deadlines (GST/HST or GST/QST, PST, T5018) and the company's own
// reminders (licences, insurance, workers' compensation), sorted into Late / Next 90 days / Later / Filed, the 90-day strip, the numbers
// at the top and the "how you file" rows. Pure, so the rules are tested (compliance.test.ts). The server's shapes (routes/compliance.ts,
// compliance/deadlines.ts) are typed here.

export type FilingKind = "sales_tax" | "sales_tax_payment" | "gst_instalment" | "pst" | "t5018";
export type DeadlineDto = {
  key: string; kind: FilingKind; periodKey: string; periodStart: string; periodEnd: string; dueDate: string; tax: string; authority: string;
  frequency: "monthly" | "quarterly" | "semiannual" | "annual"; hasWorksheet: boolean;
  filedAt: string | null; filedByName: string | null; note: string; daysLeft: number; state: "filed" | "overdue" | "due_soon" | "upcoming"; url?: string;
};
export type ReminderKind = "workers_comp" | "licence" | "insurance" | "other";
export type ReminderDto = {
  id: string; kind: ReminderKind; preset: string | null; title: string; authority: string; reference: string; url: string | null; dueDate: string;
  recurrence: "none" | "monthly" | "quarterly" | "annual"; remindDaysBefore: number; notes: string; lastDoneAt: string | null; daysLeft: number; state: "overdue" | "due_soon" | "upcoming";
};
export type PresetDto = { id: string; kind: ReminderKind; provinces: string[] | "all"; title: { en: string; fr: string }; authority: string; url: string | null; recurrence: ReminderDto["recurrence"]; usualDate: string | null };
export type ComplianceSettings = {
  salesTaxFrequency?: "monthly" | "quarterly" | "annual" | null; fiscalYearEnd?: string | null; structure?: "sole_proprietor" | "partnership" | "corporation" | null;
  instalments?: boolean; pstFrequency?: "monthly" | "quarterly" | "semiannual" | "annual" | null; t5018?: boolean; configuredAt?: string;
};
export type ComplianceOverview =
  | { enabled: false; requiredPlan?: string }
  | {
    enabled: true; today: string; settings: ComplianceSettings; registrations: { province: string | null; pstNumber: string | null };
    deadlines: DeadlineDto[]; filed: DeadlineDto[]; filedThisYear: { count: number; onTime: number }; reminders: ReminderDto[]; presets: PresetDto[];
  };

/** The worksheet of one period (GET /api/compliance/remittance): the figures the HST card shows. */
export type Worksheet = {
  from: string; to: string;
  summary: { invoiceCount: number; gstHst: { collectedCents: number; creditsCents: number; netCents: number }; qst: { collectedCents: number; creditsCents: number; netCents: number } };
};

// ── Days ────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const utc = (day: string): number => Date.parse(`${day}T00:00:00Z`);
export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / DAY_MS);
export const addDays = (day: string, n: number): string => new Date(utc(day) + n * DAY_MS).toISOString().slice(0, 10);
/** A calendar day as a date at noon on the phone's clock (so a short date prints the right day). */
export function dayDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

// ── Items ───────────────────────────────────────────────────────────────────

export type Look = "overdue" | "due" | "later" | "filed";
export type ItemIcon = { icon: "percent" | "receipt" | "users" | "shield" | "doc" | "cal"; tone: "violet" | "amber" | "indigo" | "teal" | "azure" | "sky" };
export type Item = {
  id: string;
  source: "deadline" | "reminder";
  kind: FilingKind | ReminderKind;
  /** The server's own title for a reminder; a deadline's title is made from its kind. */
  title: string;
  tax: string;
  due: string;
  daysLeft: number;
  look: Look;
  /** Filed or paid on this day (deadlines only). */
  filedOn: string | null;
  filedToday: boolean;
  note: string;
  period: { start: string; end: string; key: string; frequency: DeadlineDto["frequency"] } | null;
  authority: string;
  recurrence: ReminderDto["recurrence"] | null;
  icon: ItemIcon;
};

/** How far ahead "Next 90 days" looks. */
export const HORIZON = 90;
/** Open ones further off than this stay out of the list (the server derives more than a year ahead, and a date with no year would read as this year's). */
export const LATER_MAX = 300;

export function lookOf(daysLeft: number, filed: boolean): Look {
  if (filed) return "filed";
  if (daysLeft < 0) return "overdue";
  return daysLeft <= HORIZON ? "due" : "later";
}

const DEADLINE_ICON: Record<FilingKind, ItemIcon> = {
  sales_tax: { icon: "percent", tone: "violet" }, sales_tax_payment: { icon: "percent", tone: "violet" }, pst: { icon: "percent", tone: "violet" },
  gst_instalment: { icon: "receipt", tone: "amber" }, t5018: { icon: "users", tone: "indigo" },
};
const REMINDER_ICON: Record<ReminderKind, ItemIcon> = {
  workers_comp: { icon: "shield", tone: "teal" }, licence: { icon: "doc", tone: "amber" }, insurance: { icon: "shield", tone: "azure" }, other: { icon: "cal", tone: "sky" },
};

export function deadlineItem(d: DeadlineDto, today: string): Item {
  const filed = d.state === "filed" || !!d.filedAt;
  const filedOn = d.filedAt ? d.filedAt.slice(0, 10) : null;
  return {
    id: d.key, source: "deadline", kind: d.kind, title: "", tax: d.tax, due: d.dueDate, daysLeft: daysBetween(today, d.dueDate), look: lookOf(daysBetween(today, d.dueDate), filed),
    filedOn, filedToday: filed && filedOn === today, note: d.note, period: { start: d.periodStart, end: d.periodEnd, key: d.periodKey, frequency: d.frequency },
    authority: d.authority, recurrence: null, icon: DEADLINE_ICON[d.kind],
  };
}

export function reminderItem(r: ReminderDto, today: string): Item {
  const daysLeft = daysBetween(today, r.dueDate);
  return {
    id: `reminder:${r.id}`, source: "reminder", kind: r.kind, title: r.title, tax: "", due: r.dueDate, daysLeft, look: lookOf(daysLeft, false), filedOn: null, filedToday: false,
    note: r.notes, period: null, authority: r.authority, recurrence: r.recurrence, icon: REMINDER_ICON[r.kind],
  };
}

/** Every deadline and reminder of the overview as one list: open ones by date, then the filed ones, latest first. */
export function buildItems(ov: Extract<ComplianceOverview, { enabled: true }>): Item[] {
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const d of [...ov.deadlines, ...ov.filed]) {
    if (seen.has(d.key)) continue;
    seen.add(d.key);
    items.push(deadlineItem(d, ov.today));
  }
  for (const r of ov.reminders) items.push(reminderItem(r, ov.today));
  const open = items.filter((i) => i.look !== "filed" && i.daysLeft <= LATER_MAX).sort((a, b) => (a.due === b.due ? a.id.localeCompare(b.id) : a.due < b.due ? -1 : 1));
  const done = items.filter((i) => i.look === "filed").sort((a, b) => ((b.filedOn ?? b.due) < (a.filedOn ?? a.due) ? -1 : (b.filedOn ?? b.due) > (a.filedOn ?? a.due) ? 1 : 0));
  return [...open, ...done];
}

export const isOpen = (i: Item): boolean => i.look !== "filed";

/** The button's verb: a payment is paid, a licence or insurance is renewed, the rest is filed or just done. */
export type DoneVerb = "markFiled" | "markPaid" | "markRenewed" | "markDone";
export function doneVerb(i: Pick<Item, "source" | "kind">): DoneVerb {
  if (i.source === "deadline") return i.kind === "sales_tax_payment" || i.kind === "gst_instalment" ? "markPaid" : "markFiled";
  if (i.kind === "licence" || i.kind === "insurance") return "markRenewed";
  if (i.kind === "workers_comp") return "markFiled";
  return "markDone";
}

/** What the status word says for an item, as the board's word(): "3 days late", "Due Oct 31", "Renews Nov 14", "Filed", "Paid today". */
export type Word =
  | { kind: "late"; days: number } | { kind: "due"; verb: "due" | "renews" } | { kind: "filed" } | { kind: "paid" }
  | { kind: "filedToday" } | { kind: "paidToday" } | { kind: "renewedToday" };
export function wordOf(i: Item): Word {
  if (i.look === "overdue") return { kind: "late", days: -i.daysLeft };
  if (i.look === "filed") {
    const paid = i.source === "deadline" && doneVerb(i) === "markPaid";
    if (i.filedToday) return paid ? { kind: "paidToday" } : { kind: "filedToday" };
    return paid ? { kind: "paid" } : { kind: "filed" };
  }
  return { kind: "due", verb: i.source === "reminder" && i.kind === "insurance" ? "renews" : "due" };
}

export type StatusLook = { tone: "bad" | "warn" | "mute" | "ok"; shape: "alert" | "clock" | "check" };
export const statusOf = (look: Look): StatusLook => (look === "overdue" ? { tone: "bad", shape: "alert" } : look === "due" ? { tone: "warn", shape: "clock" } : look === "later" ? { tone: "mute", shape: "clock" } : { tone: "ok", shape: "check" });

// ── The period a deadline covers ─────────────────────────────────────────────

export type PeriodLabel =
  | { kind: "month"; month: string } | { kind: "quarter"; quarter: 1 | 2 | 3 | 4 } | { kind: "range"; start: string; end: string } | { kind: "year"; end: string };
/** "September", "Q3", "Jul 1 – Sep 30" (a quarter that is not a calendar one) or "year ending Dec 31". */
export function periodLabel(p: { start: string; end: string; frequency: DeadlineDto["frequency"] }): PeriodLabel {
  if (p.frequency === "monthly") return { kind: "month", month: p.end.slice(0, 7) };
  if (p.frequency === "quarterly") {
    const m = Number(p.end.slice(5, 7));
    if (m % 3 === 0 && p.start.slice(5, 7) === String(m - 2).padStart(2, "0") && p.start.slice(8) === "01") return { kind: "quarter", quarter: (m / 3) as 1 | 2 | 3 | 4 };
    return { kind: "range", start: p.start, end: p.end };
  }
  if (p.frequency === "annual") return { kind: "year", end: p.end };
  return { kind: "range", start: p.start, end: p.end };
}

// ── The numbers, the groups, the filters ────────────────────────────────────

export type Kpis = { late: number; next30: number; filedYear: number; onTimeYear: number; lateFirst: Item | null; nextTwo: Item[] };
export function kpis(items: Item[], filedThisYear: { count: number; onTime: number }): Kpis {
  const open = items.filter(isOpen);
  const late = open.filter((i) => i.look === "overdue");
  const next = open.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 30);
  return { late: late.length, next30: next.length, filedYear: filedThisYear.count, onTimeYear: filedThisYear.onTime, lateFirst: late[0] ?? null, nextTwo: next.slice(0, 2) };
}

export type FilterKey = "all" | "due" | "overdue" | "filed";
export const FILTERS: FilterKey[] = ["all", "due", "overdue", "filed"];
export type GroupKey = "late" | "next" | "later" | "filed";
export type Group = { key: GroupKey; items: Item[] };

const FILED_SHOWN = 6;

/** The list under the chips: Late, Next 90 days, Later, Filed (the most recent), narrowed by the chosen chip; empty groups drop out. */
export function groups(items: Item[], filter: FilterKey): Group[] {
  const by = (look: Look) => items.filter((i) => i.look === look);
  const all: Group[] = [
    ...(filter === "all" || filter === "overdue" ? [{ key: "late" as const, items: by("overdue") }] : []),
    ...(filter === "all" || filter === "due" ? [{ key: "next" as const, items: by("due") }, { key: "later" as const, items: by("later") }] : []),
    ...(filter === "all" || filter === "filed" ? [{ key: "filed" as const, items: by("filed").slice(0, FILED_SHOWN) }] : []),
  ];
  return all.filter((g) => g.items.length > 0);
}

export function filterCounts(items: Item[]): Record<FilterKey, number> {
  const n = (look: Look) => items.filter((i) => i.look === look).length;
  return { all: Math.min(items.length, items.filter(isOpen).length + Math.min(n("filed"), FILED_SHOWN)), due: n("due") + n("later"), overdue: n("overdue"), filed: Math.min(n("filed"), FILED_SHOWN) };
}

/** The item selected first: the first late one, else the first one coming, else the first. */
export function defaultSelection(items: Item[]): string | null {
  return (items.find((i) => i.look === "overdue") ?? items.find((i) => i.look === "due") ?? items[0])?.id ?? null;
}

// ── The 90-day strip ────────────────────────────────────────────────────────

export type Mark = { id: string; pct: number; lane: "up" | "dn"; look: Look; due: string };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** Open items due within the horizon (late ones sit at the left edge), alternating above and below the line. */
export function marks(items: Item[]): Mark[] {
  return items.filter((i) => isOpen(i) && i.daysLeft <= HORIZON).map((i, n) => ({ id: i.id, pct: Math.round(clamp((i.daysLeft / HORIZON) * 100, 3.5, 96) * 10) / 10, lane: n % 2 ? "dn" : "up", look: i.look, due: i.due }));
}
/** The first of each month inside the horizon, as a place on the strip. */
export function monthTicks(today: string): { month: string; pct: number }[] {
  const out: { month: string; pct: number }[] = [];
  let [y, m] = today.split("-").map(Number) as [number, number];
  for (let guard = 0; guard < 5; guard++) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const d = daysBetween(today, first);
    if (d > HORIZON) break;
    out.push({ month: first.slice(0, 7), pct: Math.round((d / HORIZON) * 1000) / 10 });
  }
  return out;
}

// ── The featured sales tax return ───────────────────────────────────────────

/** The return the HST card is about: the next one not yet filed, else the latest filed. */
export function featuredReturn(items: Item[]): Item | null {
  const returns = items.filter((i) => i.source === "deadline" && i.kind === "sales_tax");
  return returns.find(isOpen) ?? returns[0] ?? null;
}
/** The one filed before it, for the "Q2 · filed Jul 28" line. */
export function previousReturn(items: Item[], featured: Item | null): Item | null {
  return items.find((i) => i.source === "deadline" && i.kind === "sales_tax" && i.look === "filed" && i.id !== featured?.id) ?? null;
}
/** The net tax of a worksheet: GST/HST, plus QST in Québec. */
export function netOf(w: Worksheet, tax: string): { netCents: number; collectedCents: number; creditsCents: number } {
  const g = w.summary.gstHst;
  if (tax === "GST/QST") return { netCents: g.netCents + w.summary.qst.netCents, collectedCents: g.collectedCents + w.summary.qst.collectedCents, creditsCents: g.creditsCents + w.summary.qst.creditsCents };
  return { netCents: g.netCents, collectedCents: g.collectedCents, creditsCents: g.creditsCents };
}

/** The file for an item: the worksheet's CSV for a tax return, the T5018 summary for its slips. */
export function filePath(i: Item): string | null {
  if (i.source !== "deadline" || !i.period) return null;
  if (i.kind === "t5018") return `/api/compliance/t5018.csv?year=${encodeURIComponent(i.period.key)}`;
  if (i.kind === "gst_instalment") return null;
  return `/api/compliance/remittance.csv?from=${encodeURIComponent(i.period.start)}&to=${encodeURIComponent(i.period.end)}`;
}

/** A short name for the number cards: "HST", "T5018", "WSIB". */
export function shortName(i: Item): string {
  if (i.source === "deadline") return i.kind === "t5018" ? "T5018" : i.tax.replace(/^GST\//, "") || i.tax;
  return i.authority || i.title.split(/\s+/)[0] || i.title;
}

// ── How you file ────────────────────────────────────────────────────────────

export const FREQUENCIES = ["quarterly", "monthly", "annual"] as const;
export const FISCAL_ENDS = ["12-31", "03-31", "06-30"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** Whether the company has told us anything about how it files (else the screen asks). */
export function isEmptyCalendar(ov: Extract<ComplianceOverview, { enabled: true }>): boolean {
  const s = ov.settings;
  return !s.salesTaxFrequency && !s.pstFrequency && !s.t5018 && ov.reminders.length === 0 && ov.deadlines.length === 0 && ov.filed.length === 0;
}

export type Setup = { frequency: Frequency; fiscalYearEnd: (typeof FISCAL_ENDS)[number]; instalments: boolean; t5018: boolean };
export const DEFAULT_SETUP: Setup = { frequency: "quarterly", fiscalYearEnd: "12-31", instalments: false, t5018: false };
export function setupOf(s: ComplianceSettings): Setup {
  return {
    frequency: s.salesTaxFrequency ?? DEFAULT_SETUP.frequency,
    fiscalYearEnd: (FISCAL_ENDS as readonly string[]).includes(s.fiscalYearEnd ?? "") ? (s.fiscalYearEnd as Setup["fiscalYearEnd"]) : DEFAULT_SETUP.fiscalYearEnd,
    instalments: !!s.instalments,
    t5018: !!s.t5018,
  };
}
/** The settings the server stores for a setup (a fiscal year end it doesn't offer stays as it is). */
export const settingsFor = (s: Setup): ComplianceSettings => ({ salesTaxFrequency: s.frequency, fiscalYearEnd: s.fiscalYearEnd, instalments: s.instalments, t5018: s.t5018 });
export const cycle = <T,>(list: readonly T[], current: T): T => list[(list.indexOf(current) + 1) % list.length]!;

/** "MM-DD" as a date to print ("Dec 31"). */
export const fiscalDate = (mmdd: string): Date => new Date(2026, Number(mmdd.slice(0, 2)) - 1, Number(mmdd.slice(3, 5)), 12);

/** The sales tax of the company's province: GST/QST in Québec, else GST/HST. */
export const taxName = (province: string | null | undefined): "GST/HST" | "GST/QST" => ((province ?? "").toUpperCase() === "QC" ? "GST/QST" : "GST/HST");

/** Roles that may change what is filed: the same people who run the books (invoicing: full). */
export const canEditBooks = (role: string | null | undefined): boolean => role === "owner" || role === "admin" || role === "office";

/** The reminder presets of the company's province, in the language shown. */
export function presetTitle(p: PresetDto, lang: "en" | "fr"): string {
  return p.title[lang] || p.title.en;
}
