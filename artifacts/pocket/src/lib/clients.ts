// The Clients tab and the Client screen: what the server's overview sends (routes/clients.ts, clients/overview.ts)
// and the rules that turn it into what the boards show (clients.test.ts).
import { quoteState, type QuoteState } from "./quotes.ts";

export type ActivityKind = "quote_drafted" | "quote_sent" | "quote_viewed" | "quote_accepted" | "quote_declined" | "invoice_sent" | "invoice_reminded" | "invoice_paid" | "job_started";
export type LastActivity = { kind: ActivityKind; at: string; ref: string | null };

export type ClientRow = {
  id: string; name: string; type: string; email: string | null; phone: string | null; address: string | null; city: string | null; province: string | null;
  status: "active" | "prospect"; createdAt: string; quoteCount: number; jobCount: number; activeJobs: number; lifetimeCents: number;
  owedCents: number | null; overdueCount: number | null; overdueCents: number | null; lastActivity: LastActivity | null;
};

export type ClientsStats = {
  total: number; active: number; activeJobs: number; lifetimeCents: number; lifetimeThisYearCents: number; lifetimeLastYearCents: number;
  owedCents: number | null; overdueCount: number | null;
};

export type ClientQuote = { id: string; number: string | null; title: string | null; description: string; totalCents: number; status: string; createdAt: string; sentAt: string | null; firstViewedAt: string | null; acceptedAt: string | null; declinedAt: string | null; validDays: number | null };
export type ClientInvoice = { id: string; number: string; type: string; status: string; totalCents: number; paidCents: number; balanceCents: number; issueDate: string; dueDate: string; projectName: string | null; daysLate: number };
export type ClientJob = { id: string; name: string; status: string; address: string; progressPercent: number; contractValueCents: number; plannedStart: string | null; plannedEnd: string | null; completedAt: string | null };

export type ClientDetail = {
  client: ClientRow & { notes: string; preferredLanguage: string; businessNumber: string | null; postalCode: string | null };
  quotes: ClientQuote[];
  invoices: ClientInvoice[] | null;
  jobs: ClientJob[] | null;
  invoicedCents: number | null;
  worstOverdue: { id: string; number: string; balanceCents: number; daysLate: number; canRemind: boolean } | null;
};

export type ClientFilter = "all" | "active" | "prospect";
export const CLIENT_FILTERS: ClientFilter[] = ["all", "active", "prospect"];

export function matchesClientFilter(c: Pick<ClientRow, "status">, f: ClientFilter): boolean {
  return f === "all" || c.status === f;
}

/** "Search by name, phone or area": name, email, phone digits, address and city. */
export function matchesClientSearch(c: Pick<ClientRow, "name" | "email" | "phone" | "address" | "city">, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)) return true;
  return [c.name, c.email ?? "", c.address ?? "", c.city ?? ""].join(" ").toLowerCase().includes(t);
}

/** The line under a client's name in the list: email or phone, then the area. */
export function contactLine(c: Pick<ClientRow, "email" | "phone" | "city" | "address">, formatPhone: (p: string) => string): string {
  const first = c.phone ? formatPhone(c.phone) : c.email ?? "";
  const area = c.city ?? (c.address ? c.address.split(",")[0]!.trim() : "");
  return [first, area].filter(Boolean).join(" · ");
}

/** "(416) 555-0148" for a 10 or 11 digit North American number; anything else as typed. */
export function formatPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  const n = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : p.trim();
}

export type Contact = "call" | "text" | "email" | "map";

/** Which of the four quick actions this client can have, with the link each opens. */
export function contactLinks(c: Pick<ClientRow, "phone" | "email" | "address" | "city" | "province">): Partial<Record<Contact, string>> {
  const out: Partial<Record<Contact, string>> = {};
  const digits = (c.phone ?? "").replace(/[^\d+]/g, "");
  if (digits) { out.call = `tel:${digits}`; out.text = `sms:${digits}`; }
  if ((c.email ?? "").includes("@")) out.email = `mailto:${c.email!.trim()}`;
  const place = [c.address, c.city, c.province].filter(Boolean).join(", ");
  if (place) out.map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  return out;
}

/** The five tints the avatars rotate through, picked from the name so a client keeps theirs. */
export function tintFor(name: string): 1 | 2 | 3 | 4 | 5 {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ((h % 5) + 1) as 1 | 2 | 3 | 4 | 5;
}

/** "2 of 3": won over the quotes that left the building (sent, or accepted). Null when none did. */
export function wonOf(quotes: Pick<ClientQuote, "sentAt" | "acceptedAt" | "declinedAt">[]): { won: number; of: number; percent: number } | null {
  const decided = quotes.filter((q) => q.sentAt || q.acceptedAt || q.declinedAt);
  if (decided.length === 0) return null;
  const won = decided.filter((q) => q.acceptedAt).length;
  return { won, of: decided.length, percent: Math.round((won / decided.length) * 100) };
}

/** Percent change of this year against last, or null when last year has nothing to compare. */
export function yearTrend(stats: Pick<ClientsStats, "lifetimeThisYearCents" | "lifetimeLastYearCents">): number | null {
  if (stats.lifetimeLastYearCents <= 0) return null;
  return Math.round(((stats.lifetimeThisYearCents - stats.lifetimeLastYearCents) / stats.lifetimeLastYearCents) * 100);
}

/** The clients who owe the most, overdue first (the Clients card's "Owed to you"). */
export function owingClients(items: ClientRow[], n = 3): ClientRow[] {
  return items.filter((c) => (c.owedCents ?? 0) > 0).sort((a, b) => (b.overdueCents ?? 0) - (a.overdueCents ?? 0) || (b.owedCents ?? 0) - (a.owedCents ?? 0)).slice(0, n);
}

/** The biggest clients this year by what they bought. */
export function topClients(items: ClientRow[], n = 3): ClientRow[] {
  return items.filter((c) => c.lifetimeCents > 0).sort((a, b) => b.lifetimeCents - a.lifetimeCents).slice(0, n);
}

export type Details = { name: string; email: string; phone: string; address: string; city: string; province: string; postalCode: string; notes: string };

/** The edit form → the server's body, sending only what changed (empty text clears a field). */
export function changedDetails(before: Details, after: Details): Partial<Record<keyof Details, string | null>> {
  const out: Partial<Record<keyof Details, string | null>> = {};
  (Object.keys(after) as (keyof Details)[]).forEach((k) => {
    if (after[k].trim() !== before[k].trim()) out[k] = k === "notes" ? after[k] : after[k].trim() === "" && k !== "name" ? null : after[k].trim();
  });
  return out;
}

export function canSaveDetails(d: Details): boolean {
  return d.name.trim().length > 0 && (d.email.trim() === "" || d.email.includes("@"));
}

export type PeekRow =
  | { type: "invoice"; id: string; number: string; amountCents: number; daysLate: number; canRemind: boolean }
  | { type: "job"; id: string; name: string; progressPercent: number; valueCents: number }
  | { type: "quote"; id: string; number: string | null; title: string; amountCents: number; state: QuoteState };

/** What a client's open card shows: the late invoice first, the running job, then the latest quotes (4 rows at most). */
export function peekRows(d: Pick<ClientDetail, "quotes" | "invoices" | "jobs" | "worstOverdue">, now: Date): PeekRow[] {
  const rows: PeekRow[] = [];
  for (const i of (d.invoices ?? []).filter((x) => x.daysLate > 0 && x.balanceCents > 0 && x.status !== "paid" && x.status !== "void" && x.type !== "credit_note").slice(0, 2)) {
    rows.push({ type: "invoice", id: i.id, number: i.number, amountCents: i.balanceCents, daysLate: i.daysLate, canRemind: d.worstOverdue?.id === i.id && d.worstOverdue.canRemind });
  }
  for (const j of (d.jobs ?? []).filter((x) => !x.completedAt && x.status !== "completed" && x.status !== "cancelled").slice(0, 1)) {
    rows.push({ type: "job", id: j.id, name: j.name, progressPercent: j.progressPercent, valueCents: j.contractValueCents });
  }
  for (const q of d.quotes.slice(0, 2)) {
    rows.push({ type: "quote", id: q.id, number: q.number, title: q.title && q.title !== "Project Quote & Itemized Estimate" ? q.title : q.description.split("\n")[0]!.slice(0, 60), amountCents: q.totalCents, state: quoteState({ status: q.acceptedAt ? "accepted" : "draft", sentAt: q.sentAt, acceptedAt: q.acceptedAt, firstViewedAt: q.firstViewedAt, declinedAt: q.declinedAt, validDays: q.validDays }, now) });
  }
  return rows.slice(0, 4);
}
