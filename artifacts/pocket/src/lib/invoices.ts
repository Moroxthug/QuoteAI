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

export type InvoiceTone = { tone: "ok" | "warn" | "bad" | "acc" | "info" | "mute"; shape: "check" | "alert" | "draft" | "q1" | "q2" | "clock" | "off" };

/** The word, colour and shape an invoice shows: late wins over its stored status, because the date is what counts on screen. */
export function invoiceLook(status: InvoiceStatus, daysLateNow: number): { word: InvoiceStatus | "late"; look: InvoiceTone } {
  if (status === "paid") return { word: "paid", look: { tone: "ok", shape: "check" } };
  if (status === "void") return { word: "void", look: { tone: "mute", shape: "off" } };
  if (status === "draft") return { word: "draft", look: { tone: "mute", shape: "draft" } };
  if (daysLateNow > 0 || status === "overdue") return { word: "late", look: { tone: "bad", shape: "alert" } };
  if (status === "partially_paid") return { word: "partially_paid", look: { tone: "warn", shape: "clock" } };
  if (status === "pending_confirmation") return { word: "pending_confirmation", look: { tone: "warn", shape: "clock" } };
  if (status === "viewed") return { word: "viewed", look: { tone: "acc", shape: "q2" } };
  return { word: "sent", look: { tone: "info", shape: "q1" } };
}
