// Invoices as the phone reads them (routes/invoices.ts), and the rules the Home widgets and the
// Invoices screens share (invoices.test.ts).
export type InvoiceStatus = "draft" | "sent" | "viewed" | "pending_confirmation" | "partially_paid" | "paid" | "overdue" | "void";
export type InvoiceType = "manual" | "deposit" | "progress" | "final" | "credit_note" | string;

export type InvoiceDto = {
  id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  title: string | null;
  projectName: string | null;
  clientName: string | null;
  issueDate: string;
  dueDate: string;
  customer: { name?: string | null; email?: string | null };
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  archivedAt: string | null;
  // The list also carries these (routes/invoices.ts serializeInvoice); the Invoices screens read them.
  scheduledFor?: string | null;
  autoSendAt?: string | null;
  holdbackPercent?: number | null;
  paymentTermLabel?: string | null;
  createdAt?: string;
  voidedAt?: string | null;
};

export type InvoiceList = {
  items: InvoiceDto[];
  stats: { drafts: number; outstandingCents: number; overdueCents: number; overdueCount: number; paidThisMonthCents: number };
};

const DAY = 86_400_000;

export const OPEN: readonly InvoiceStatus[] = ["sent", "viewed", "pending_confirmation", "partially_paid", "overdue"];

export const isOpen = (i: Pick<InvoiceDto, "status">) => OPEN.includes(i.status);

/** Whole days past the due date (0 when it is not due yet). The server marks the status; the date is what counts on screen. */
export function daysLate(dueDate: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(dueDate).getTime()) / DAY));
}

/** Whole days until the due date (0 when it is due today or late). */
export function daysUntilDue(dueDate: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(dueDate).getTime() - now.getTime()) / DAY));
}

/** Open invoices, the most overdue first, then the soonest due. */
export function openByUrgency(items: InvoiceDto[], now: Date): InvoiceDto[] {
  return items
    .filter(isOpen)
    .slice()
    .sort((a, b) => {
      const la = daysLate(a.dueDate, now), lb = daysLate(b.dueDate, now);
      if (la !== lb) return lb - la;
      return +new Date(a.dueDate) - +new Date(b.dueDate);
    });
}

/** Whether a reminder can go out: an email to send it to, and none in the last 3 days. */
export function canRemind(i: InvoiceDto, now: Date): boolean {
  if (!(i.customer.email ?? "").includes("@")) return false;
  if (!i.lastReminderAt) return true;
  return now.getTime() - new Date(i.lastReminderAt).getTime() >= 3 * DAY;
}

export type InvoiceTone = { tone: "ok" | "warn" | "bad" | "acc" | "info" | "mute"; shape: "check" | "alert" | "draft" | "q1" | "q2" | "q3" | "clock" | "off" };

/** The word, colour and shape an invoice shows: late wins over its stored status, because the date is what counts on screen. */
export function invoiceLook(status: InvoiceStatus, daysLateNow: number): { word: InvoiceStatus | "late"; look: InvoiceTone } {
  if (status === "paid") return { word: "paid", look: { tone: "ok", shape: "check" } };
  if (status === "void") return { word: "void", look: { tone: "mute", shape: "off" } };
  if (status === "draft") return { word: "draft", look: { tone: "mute", shape: "draft" } };
  if (daysLateNow > 0 || status === "overdue") return { word: "late", look: { tone: "bad", shape: "alert" } };
  if (status === "partially_paid") return { word: "partially_paid", look: { tone: "warn", shape: "q3" } };
  if (status === "pending_confirmation") return { word: "pending_confirmation", look: { tone: "warn", shape: "clock" } };
  if (status === "viewed") return { word: "viewed", look: { tone: "acc", shape: "q2" } };
  return { word: "sent", look: { tone: "info", shape: "q1" } };
}

// ── The Invoices list and the Invoice screen ─────────────────────────────────────────────────

/** What an invoice is to the list: late, waiting on payment, a draft, a scheduled draft, paid, or void. */
export type InvoiceKind = "late" | "open" | "draft" | "scheduled" | "paid" | "void";
export type InvoiceFilter = "all" | "overdue" | "unpaid" | "draft" | "scheduled" | "paid";
export type InvoiceGroup = "overdue" | "open" | "draft" | "paid" | "paidEarlier" | "void";
export type AgingBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

export const FILTER_ORDER: InvoiceFilter[] = ["all", "overdue", "unpaid", "draft", "scheduled", "paid"];
export const GROUP_ORDER: InvoiceGroup[] = ["overdue", "open", "draft", "paid", "paidEarlier", "void"];
export const BUCKET_ORDER: AgingBucket[] = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"];

const cents = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

/** The date a draft goes out on its own: an auto-send, or a release date still ahead. Null for a plain draft. */
export function scheduledAt(i: Pick<InvoiceDto, "status" | "scheduledFor" | "autoSendAt">, now: Date): Date | null {
  if (i.status !== "draft") return null;
  if (i.autoSendAt) return new Date(i.autoSendAt);
  if (i.scheduledFor && new Date(i.scheduledFor).getTime() > now.getTime()) return new Date(i.scheduledFor);
  return null;
}

export function kindOf(i: InvoiceDto, now: Date): InvoiceKind {
  if (i.status === "paid") return "paid";
  if (i.status === "void") return "void";
  if (i.status === "draft") return scheduledAt(i, now) ? "scheduled" : "draft";
  return invoiceLook(i.status, daysLate(i.dueDate, now)).word === "late" ? "late" : "open";
}

const FILTERS: Record<InvoiceFilter, (k: InvoiceKind) => boolean> = {
  all: () => true,
  overdue: (k) => k === "late",
  unpaid: (k) => k === "late" || k === "open",
  draft: (k) => k === "draft",
  scheduled: (k) => k === "scheduled",
  paid: (k) => k === "paid",
};
export const matchesFilter = (k: InvoiceKind, f: InvoiceFilter): boolean => FILTERS[f](k);

export function matchesSearch(i: Pick<InvoiceDto, "number" | "clientName" | "customer" | "projectName" | "title">, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return [i.number, i.clientName ?? "", i.customer.name ?? "", i.projectName ?? "", i.title ?? ""].join(" ").toLowerCase().includes(t);
}

const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export function groupOf(i: InvoiceDto, now: Date): InvoiceGroup {
  const k = kindOf(i, now);
  if (k === "late") return "overdue";
  if (k === "open") return "open";
  if (k === "draft" || k === "scheduled") return "draft";
  if (k === "void") return "void";
  return i.paidAt && sameMonth(new Date(i.paidAt), now) ? "paid" : "paidEarlier";
}

/** What a group's total adds up: the balance for the two owed groups, the invoice totals for the rest. */
export function groupTotal(group: InvoiceGroup, items: InvoiceDto[]): number {
  const owed = group === "overdue" || group === "open";
  return items.reduce((n, i) => n + (owed ? cents(i.balanceCents) : cents(i.totalCents)), 0);
}

/** Money still owed on open invoices (the server's own figure leaves out "awaiting confirmation"). */
export function outstandingCents(items: InvoiceDto[]): number {
  return items.filter(isOpen).reduce((n, i) => n + cents(i.balanceCents), 0);
}

export function overdueCents(items: InvoiceDto[], now: Date): number {
  return items.filter((i) => kindOf(i, now) === "late").reduce((n, i) => n + cents(i.balanceCents), 0);
}

export function bucketOf(late: number): AgingBucket {
  if (late <= 0) return "current";
  if (late <= 30) return "d1_30";
  if (late <= 60) return "d31_60";
  if (late <= 90) return "d61_90";
  return "d90_plus";
}

/** The balance owed in each aging bucket, by due date (the server's arAging, worked out on the phone's clock). */
export function aging(items: InvoiceDto[], now: Date): Record<AgingBucket, number> {
  const out: Record<AgingBucket, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  for (const i of items) if (isOpen(i) && cents(i.balanceCents) > 0) out[bucketOf(daysLate(i.dueDate, now))] += cents(i.balanceCents);
  return out;
}

/** Paid this month: the invoice totals paid since the 1st, and how many. */
export function paidThisMonth(items: InvoiceDto[], now: Date): { cents: number; count: number } {
  const paid = items.filter((i) => i.status === "paid" && i.paidAt && sameMonth(new Date(i.paidAt), now) && i.type !== "credit_note");
  return { cents: paid.reduce((n, i) => n + cents(i.totalCents), 0), count: paid.length };
}

/** Drafts not sent yet (a scheduled one has its own filter) and what they come to. */
export function draftsTotal(items: InvoiceDto[], now: Date): { cents: number; count: number } {
  const d = items.filter((i) => kindOf(i, now) === "draft");
  return { cents: d.reduce((n, i) => n + cents(i.totalCents), 0), count: d.length };
}

/** How the company gets paid: the average days from issue to payment, the share paid by the due date, and how many are late. */
export function payStats(items: InvoiceDto[], now: Date): { avgDays: number | null; onTime: number | null; late: number } {
  const paid = items.filter((i) => i.status === "paid" && i.paidAt && i.type !== "credit_note");
  const days = paid.map((i) => Math.max(0, Math.round((new Date(i.paidAt!).getTime() - new Date(i.issueDate).getTime()) / DAY)));
  const onTime = paid.filter((i) => new Date(i.paidAt!).getTime() <= new Date(i.dueDate).getTime() + DAY).length;
  return {
    avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
    onTime: paid.length ? onTime / paid.length : null,
    late: items.filter((i) => kindOf(i, now) === "late").length,
  };
}

/** Why a reminder cannot go: no email address, or one went within the last 3 days. */
export function remindBlock(i: InvoiceDto, now: Date): "noEmail" | "recent" | null {
  if (!(i.customer.email ?? "").includes("@")) return "noEmail";
  return canRemind(i, now) ? null : "recent";
}

/** The late invoices a "remind all" can reach, the most late first. */
export function remindable(items: InvoiceDto[], now: Date): InvoiceDto[] {
  return openByUrgency(items, now).filter((i) => kindOf(i, now) === "late" && canRemind(i, now));
}

export type InvoiceAction = "remind" | "gotPaid" | "send" | "delete" | "sendNow" | "edit" | "sendReceipt" | "archive";

/** The swipe actions of a row, by kind (the board's IA). */
export function swipeActions(k: InvoiceKind): InvoiceAction[] {
  switch (k) {
    case "late": case "open": return ["remind", "gotPaid"];
    case "draft": return ["send", "delete"];
    case "scheduled": return ["sendNow", "edit"];
    case "paid": return ["sendReceipt", "archive"];
    case "void": return ["archive"];
  }
}

/** The one primary action of an expanded row: remind what is late, record a payment on what is open. */
export function mainAction(k: InvoiceKind): InvoiceAction | null {
  switch (k) {
    case "late": return "remind";
    case "open": return "gotPaid";
    case "draft": return "send";
    case "scheduled": return "sendNow";
    case "paid": return "sendReceipt";
    case "void": return null;
  }
}

/** The kind, word and look a row shows; a scheduled draft says "Sends Nov 14" in the info colour. */
export function stateOf(i: InvoiceDto, now: Date): { kind: InvoiceKind; word: InvoiceStatus | "late" | "scheduled"; look: InvoiceTone; late: number } {
  const kind = kindOf(i, now);
  const late = daysLate(i.dueDate, now);
  if (kind === "scheduled") return { kind, word: "scheduled", look: { tone: "info", shape: "clock" }, late };
  const { word, look } = invoiceLook(i.status, late);
  return { kind, word, look, late };
}

export function typeKey(type: InvoiceType): "deposit" | "progress" | "final" | "holdback" | "change" | "manual" | "credit" {
  switch (type) {
    case "deposit": return "deposit";
    case "progress": return "progress";
    case "final": return "final";
    case "holdback_release": return "holdback";
    case "change_order": return "change";
    case "credit_note": return "credit";
    default: return "manual";
  }
}

// ── Payments ──

export const PAY_METHODS = ["etransfer", "cheque", "cash", "card", "bank_transfer", "other"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export const METHOD_ICON: Record<string, { name: "send" | "doc" | "card" | "bank" | "dot"; tone: "violet" | "stone" | "sage" | "azure" | "teal" | "slate" }> = {
  etransfer: { name: "send", tone: "violet" },
  cheque: { name: "doc", tone: "stone" },
  cash: { name: "card", tone: "sage" },
  card: { name: "card", tone: "azure" },
  bank_transfer: { name: "bank", tone: "teal" },
  other: { name: "dot", tone: "slate" },
};

/** An amount as typed ("2,340.00", "2 340,50", "$1.200", "12,5") into cents; 0 when it is not a number. */
export function parseCents(text: string): number {
  const raw = text.replace(/[\s $]/g, "");
  if (!/^[0-9.,]+$/.test(raw)) return 0;
  const at = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  let whole = raw, frac = "";
  if (at >= 0) {
    const tail = raw.slice(at + 1);
    const both = raw.includes(".") && raw.includes(",");
    // the last separator is the decimal one when both kinds appear, or when 1 or 2 digits follow it
    if (both || tail.length <= 2) { whole = raw.slice(0, at); frac = tail; }
  }
  const digits = whole.replace(/[.,]/g, "");
  if (!digits && !frac) return 0;
  const n = Number(`${digits || "0"}.${frac || "0"}`);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** How much a payment is above the balance (0 when it is not). */
export function overpaidBy(balance: number, amount: number): number {
  return Math.max(0, amount - balance);
}

// ── Reminders ──

export type ReminderState = "sent" | "scheduled" | "off" | "cancelled";
export type ReminderRow = { days: number; at: Date; state: ReminderState };

/** The automatic reminders: one per entry of `days` after the due date. The first `reminderCount` have gone out. */
export function reminderRows(i: Pick<InvoiceDto, "dueDate" | "reminderCount" | "status">, days: readonly number[], on: boolean): ReminderRow[] {
  const closed = i.status === "paid" || i.status === "void";
  return days.map((n, idx) => ({
    days: n,
    at: new Date(new Date(i.dueDate).getTime() + n * DAY),
    state: idx < i.reminderCount ? "sent" : closed ? "cancelled" : on ? "scheduled" : "off",
  }));
}

/** What sits by the Reminders heading: the next date, "paused", "all sent" or "all stopped". */
export function reminderSummary(rows: ReminderRow[], status: InvoiceStatus): { kind: "next"; at: Date } | { kind: "paused" | "stopped" | "done" } {
  if (status === "paid" || status === "void") return { kind: "stopped" };
  const next = rows.find((r) => r.state === "scheduled");
  if (next) return { kind: "next", at: next.at };
  return rows.some((r) => r.state === "off") ? { kind: "paused" } : { kind: "done" };
}

// ── Activity ──

export type InvoiceEventDto = { id: string; type: string; actor: string; detail: Record<string, unknown> | null; createdAt: string };

const EVENT_TYPES = ["created", "edited", "sent", "resent", "auto_sent", "viewed", "reminder_sent", "payment_recorded", "payment_removed", "paid", "overdue", "voided", "credit_note_issued", "etransfer_reported", "etransfer_rejected", "receipt_sent"];

/** The i18n key and the figures for an activity line. */
export function eventLine(e: InvoiceEventDto): { key: string; amountCents?: number; method?: string; to?: string; number?: string; manual: boolean } {
  const d = e.detail ?? {};
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  return {
    key: EVENT_TYPES.includes(e.type) ? e.type : "other",
    amountCents: num(d.amountCents),
    method: str(d.method),
    to: str(d.to),
    number: str(d.number),
    manual: d.manual === true,
  };
}

/** Newest first. */
export function newestFirst<T extends { createdAt: string }>(list: T[]): T[] {
  return list.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/** When the customer last said they had paid (the claim banner's line). */
export function claimedAt(events: InvoiceEventDto[]): Date | null {
  const e = newestFirst(events).find((x) => x.type === "etransfer_reported");
  return e ? new Date(e.createdAt) : null;
}

/** A draft has no client link yet and a void one is closed. */
export const hasLink = (i: Pick<InvoiceDto, "status">) => i.status !== "draft" && i.status !== "void";
