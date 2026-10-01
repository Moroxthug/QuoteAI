// The Quotes list rules, pure so they are tested (quotes.test.ts).
// The server gives a quote draft / unlocked / pending_payment / accepted, plus sentAt, acceptedAt,
// firstViewedAt (the client opened it), declinedAt (the client said no) and validDays (null: 30).
// Expired and "Expires ..." are worked out from sentAt and validDays.
export type QuoteLike = {
  id: string;
  status: string;
  sentAt?: string | null;
  acceptedAt?: string | null;
  firstViewedAt?: string | null;
  declinedAt?: string | null;
  declinedReason?: string | null;
  validDays?: number | null;
  totale: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  clientData: { nome: string; indirizzo?: string };
  title?: string | null;
  descrizioneGenerale?: string;
  numeroPreventivoData?: string | null;
};

export type QuoteState = "draft" | "sent" | "viewed" | "expiring" | "accepted" | "declined" | "expired";
export type QuoteFilter = "all" | "draft" | "waiting" | "accepted" | "closed";

export const VALID_DAYS = 30;
/** "Expires Fri": the last 3 days of a quote's validity. */
export const EXPIRING_DAYS = 3;
const DAY = 86_400_000;

export function validUntil(sentAt: string, validDays?: number | null): Date {
  return new Date(new Date(sentAt).getTime() + (validDays ?? VALID_DAYS) * DAY);
}

export function quoteState(q: Pick<QuoteLike, "status" | "sentAt" | "acceptedAt" | "firstViewedAt" | "declinedAt" | "validDays">, now: Date): QuoteState {
  if (q.status === "accepted" || q.acceptedAt) return "accepted";
  if (q.declinedAt) return "declined";
  if (!q.sentAt) return "draft";
  const left = validUntil(q.sentAt, q.validDays).getTime() - now.getTime();
  if (left < 0) return "expired";
  if (left <= EXPIRING_DAYS * DAY) return "expiring";
  return q.firstViewedAt ? "viewed" : "sent";
}

const FILTERS: Record<QuoteFilter, (s: QuoteState) => boolean> = {
  all: () => true,
  draft: (s) => s === "draft",
  waiting: (s) => s === "sent" || s === "viewed" || s === "expiring",
  accepted: (s) => s === "accepted",
  closed: (s) => s === "declined" || s === "expired",
};
export const FILTER_ORDER: QuoteFilter[] = ["all", "draft", "waiting", "accepted", "closed"];

export function matchesFilter(s: QuoteState, f: QuoteFilter): boolean {
  return FILTERS[f](s);
}

/** The date a row is about: accepted or declined, else sent, else last edited. */
export function activityAt(q: Pick<QuoteLike, "sentAt" | "acceptedAt" | "declinedAt" | "updatedAt">): Date {
  return new Date(q.acceptedAt ?? q.declinedAt ?? q.sentAt ?? q.updatedAt);
}

/** "Q-2026-119": the quote's own number when it has one, else nothing (never an invented one). */
export function quoteNumber(q: Pick<QuoteLike, "numeroPreventivoData">): string {
  return (q.numeroPreventivoData ?? "").trim();
}

export function matchesSearch(q: QuoteLike, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return [q.clientData.nome, q.title ?? "", q.descrizioneGenerale ?? "", quoteNumber(q), q.clientData.indirizzo ?? ""].join(" ").toLowerCase().includes(t);
}

/** What a row calls the job: the heading, else the first line of the description. */
export function jobLine(q: Pick<QuoteLike, "title" | "descrizioneGenerale">): string {
  const t = (q.title ?? "").trim();
  if (t && t !== "Project Quote & Itemized Estimate") return t;
  return (q.descrizioneGenerale ?? "").trim().split(/\n/)[0].slice(0, 80);
}

export type QuoteGroup = "week" | "earlier";
export function groupOf(q: Pick<QuoteLike, "sentAt" | "acceptedAt" | "declinedAt" | "updatedAt">, now: Date): QuoteGroup {
  return now.getTime() - activityAt(q).getTime() < 7 * DAY ? "week" : "earlier";
}

export type Glance = { waitingTotal: number; waitingCount: number; wonTotal: number; wonCount: number; winRate: number | null; sentThisMonth: number; expiring: number };

/** The three figures at the top. Win rate is accepted / (accepted + declined + expired) over the last 90 days. */
export function glance(quotes: QuoteLike[], now: Date): Glance {
  let waitingTotal = 0, waitingCount = 0, wonTotal = 0, wonCount = 0, sentThisMonth = 0, expiring = 0, won90 = 0, lost90 = 0;
  for (const q of quotes) {
    const s = quoteState(q, now);
    if (s === "sent" || s === "viewed" || s === "expiring") { waitingTotal += q.totale; waitingCount++; }
    if (s === "expiring") expiring++;
    const acc = q.acceptedAt ? new Date(q.acceptedAt) : null;
    if (acc && acc.getFullYear() === now.getFullYear() && acc.getMonth() === now.getMonth()) { wonTotal += q.totale; wonCount++; }
    if (q.sentAt) { const d = new Date(q.sentAt); if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) sentThisMonth++; }
    const at = activityAt(q).getTime();
    if (now.getTime() - at <= 90 * DAY) { if (s === "accepted") won90++; else if (s === "expired" || s === "declined") lost90++; }
  }
  return { waitingTotal, waitingCount, wonTotal, wonCount, winRate: won90 + lost90 > 0 ? won90 / (won90 + lost90) : null, sentThisMonth, expiring };
}

/** Whole days from `now` to `at` (rounded up), never below 0. */
export function daysLeft(at: Date, now: Date): number {
  return Math.max(0, Math.ceil((at.getTime() - now.getTime()) / DAY));
}
