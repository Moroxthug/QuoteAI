// The company assistant (AssistantProposals.dc.html, AssistantActivity.dc.html, AssistantPermissions.dc.html): what it suggests, what it did and how
// much it may do alone. Pure, so they are tested (assistant.test.ts). The server's shapes are routes/assistant-company.ts.
import type { IconName, Tone } from "@/ui/Icon";
import type { Locale } from "./format";

export type SuggestionKind = "reminder" | "order" | "move" | "followup";
export type Channel = "sms" | "email";

export type OrderLine = { itemId: string | null; name: string; unit: string; qty: number; unitPriceCents: number | null };
export type Payload = {
  channel?: Channel; to?: string; toName?: string; subject?: string; draft?: string; language?: "en" | "fr";
  invoiceId?: string; number?: string; balanceCents?: number; daysLate?: number;
  quoteId?: string; totalCents?: number; daysSent?: number;
  supplierId?: string; supplierName?: string; lines?: OrderLine[]; destination?: string; overLimit?: boolean;
  blockId?: string; blockTitle?: string; jobName?: string; from?: string; moveTo?: string;
};
export type Suggestion = { id: string; kind: SuggestionKind; payload: Payload; createdAt: string };
export type Decided = {
  id: string; source: "suggestion" | "job"; kind: string; status: "approved" | "dismissed" | "failed"; at: string;
  payload?: Payload; summary?: string; project?: string | null; invoiceId?: string | null;
};
export type ProposalsOverview = { enabled: boolean; requiredPlan?: string; canApprove: boolean; pending: Suggestion[]; recent: Decided[]; spendLimitCents?: number };

export type Undo = "none" | "undo" | "void" | "open";
export type Category = "msg" | "money" | "jobs";
export type ActivityRow = {
  id: string; at: string; kind: string; title: string; detail: string; params: Record<string, string | number>; who: string; whoKind: "you" | "auto"; category: Category;
  undo: Undo; word: string; undone: boolean; invoiceId: string | null;
};
export type ActivityOverview = {
  enabled: boolean; requiredPlan?: string; canUndo: boolean; today: number; todayYou: number; month: number; undoneMonth: number;
  voice: { used: number; included: number; /** YYYY-MM-DD, the first of next month. */ resets: string }; rows: ActivityRow[];
};

export type Level = 0 | 1 | 2;
export type LevelKey = "followups" | "reminders" | "receipts" | "scheduling" | "crew";
export type Quiet = { on: boolean; from: number; until: number; sunday: boolean };
export type Permissions = { enabled: boolean; canEdit: boolean; levels: Record<LevelKey, Level>; spendLimitCents: number; quiet: Quiet; readBack: boolean };

export const RECOMMENDED: Record<LevelKey, Level> = { followups: 0, reminders: 1, receipts: 1, scheduling: 0, crew: 1 };
export const RECOMMENDED_LIMIT_CENTS = 30000;
export const LIMIT_STEP_CENTS = 10000;
export const LIMIT_MAX_CENTS = 500000;
/** The board's quiet hours move by half an hour. */
export const QUIET_STEP = 30;

/** The glyph and tone of a suggestion or an activity row, as the boards draw them. */
export function look(kind: string): { icon: IconName; tone: Tone } {
  switch (kind) {
    case "reminder": return { icon: "bell", tone: "amber" };
    case "order": return { icon: "truck", tone: "clay" };
    case "move": return { icon: "cal", tone: "sky" };
    case "followup": return { icon: "mail", tone: "violet" };
    case "cost": return { icon: "receipt", tone: "amber" };
    case "payment": return { icon: "bank", tone: "gold" };
    case "invoice": return { icon: "receipt", tone: "violet" };
    case "task": return { icon: "list", tone: "indigo" };
    case "job": return { icon: "cal", tone: "sky" };
    case "quote": return { icon: "send", tone: "azure" };
    case "crew": return { icon: "chat", tone: "teal" };
    case "doc": return { icon: "doc", tone: "indigo" };
    default: return { icon: "orb", tone: "violet" };
  }
}

/** What a "Recently decided" row of the job assistant (a cost, a change order, a payment) looks like. */
export function jobLook(kind: string): { icon: IconName; tone: Tone } {
  switch (kind) {
    case "cost_entry": return { icon: "receipt", tone: "amber" };
    case "record_payment": return { icon: "bank", tone: "gold" };
    case "change_order": return { icon: "doc", tone: "indigo" };
    case "invoice": case "send_invoice": return { icon: "receipt", tone: "violet" };
    case "task": return { icon: "list", tone: "indigo" };
    case "milestone_update": return { icon: "cal", tone: "sky" };
    default: return { icon: "orb", tone: "violet" };
  }
}

/** The calendar day of an instant, in the phone's own zone. */
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Rows newest first, grouped by day: Today, Yesterday, then each earlier day. */
export function groupByDay(rows: ActivityRow[], now: Date): { key: "today" | "yesterday" | string; day: Date; rows: ActivityRow[] }[] {
  const today = dayKey(now);
  const yd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const out: { key: string; day: Date; rows: ActivityRow[] }[] = [];
  for (const r of [...rows].sort((a, b) => b.at.localeCompare(a.at))) {
    const d = new Date(r.at);
    const k = dayKey(d);
    let g = out.find((x) => x.key === (k === today ? "today" : k === dayKey(yd) ? "yesterday" : k));
    if (!g) {
      g = { key: k === today ? "today" : k === dayKey(yd) ? "yesterday" : k, day: d, rows: [] };
      out.push(g);
    }
    g.rows.push(r);
  }
  return out;
}

export type FilterKey = "all" | "you" | "auto" | "msg" | "money" | "jobs";
export const FILTERS: FilterKey[] = ["all", "you", "auto", "msg", "money", "jobs"];
export const matches = (f: FilterKey, r: ActivityRow): boolean => f === "all" || (f === "you" ? r.whoKind === "you" : f === "auto" ? r.whoKind === "auto" : r.category === f);

/** "Voice minutes": how much of the month's allowance is used (never over 100 %), and whether the 80 % notice is due. */
export function voiceShare(used: number, included: number): { pct: number; near: boolean } {
  const pct = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 0;
  return { pct, near: pct >= 80 };
}

/** Quiet hours as the board writes them: "8:00 pm" / "20 h", with no minutes in French on the hour. */
export function clockLabel(minute: number, locale: Locale): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const d = new Date(2026, 0, 1, h, m);
  if (locale === "fr-CA") return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** A quiet-hours time moved by `by` minutes, around the clock. */
export const moveMinute = (minute: number, by: number): number => (((minute + by) % 1440) + 1440) % 1440;

/** Which of the three voices the person chose, as the Permissions board draws them (the colours are the board's). */
export const VOICES = ["ember", "tide", "stone"] as const;
export type Voice = (typeof VOICES)[number];

/** The segment's three stops: its thumb sits under the chosen one; the middle stop is the widest. */
export const SEG_FRACTIONS: [number, number, number] = [1, 1.3, 0.7];
export function thumbBox(i: number): { left: number; width: number } {
  const total = SEG_FRACTIONS.reduce((a, b) => a + b, 0);
  let before = 0;
  for (let k = 0; k < i; k++) before += SEG_FRACTIONS[k]!;
  return { left: before / total, width: SEG_FRACTIONS[i]! / total };
}

/** The order's total, from its lines (a line with no price counts nothing). */
export const orderTotal = (lines: OrderLine[]): number => lines.reduce((n, l) => n + Math.round(l.qty * (l.unitPriceCents ?? 0)), 0);

/** The message box's channel: who it goes to and how. */
export const channelOf = (p: Payload): "sms" | "email" => (p.channel === "sms" ? "sms" : "email");

/** A calendar day the server names as YYYY-MM-DD, as that day on the phone's own calendar (never shifted by a time zone). */
export function dayFromKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** How many proposals wait, for the tab's badge and the title (nothing past nine reads as 9+). */
export const badge = (n: number): string => (n > 9 ? "9+" : String(n));
