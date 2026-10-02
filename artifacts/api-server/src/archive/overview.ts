import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, quotesTable, clientsTable, invoicesTable, contractsTable, projectsTable, type QuoteClientData } from "@workspace/db";

// Pocket 128.5 (Archive): everything archived across the five kinds, with what a row shows: whose it is, what it was, how it ended and what it was worth.

export type ArchiveKind = "quote" | "client" | "invoice" | "job" | "contract";
export type ArchiveRow = {
  id: string;
  type: ArchiveKind;
  /** The client's name (the quote's, the invoice's...), or the job's own name when there is none. */
  title: string;
  /** What it was: the job, the invoice number, the contract number. */
  detail: string;
  /** How it ended, as a key the app words: declined, accepted, expired, finished, paused, paid, sent, draft, not_signed, signed, client... */
  state: string;
  amountCents: number | null;
  archivedAt: string;
  archivedByName: string | null;
};

const clip = (s: string, n = 48): string => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** How a quote ended: declined by the client, accepted, expired after its days, or what it was. */
export function quoteState(q: { declinedAt: Date | null; acceptedAt: Date | null; status: string; sentAt: Date | null; validDays: number | null }, now: Date): string {
  if (q.declinedAt) return "declined";
  if (q.acceptedAt || q.status === "accepted") return "accepted";
  if (q.sentAt && q.validDays && now.getTime() > q.sentAt.getTime() + q.validDays * 86_400_000) return "expired";
  return q.sentAt ? "sent" : "draft";
}

export async function archiveOverview(orgId: string, now = new Date()): Promise<ArchiveRow[]> {
  const [quotes, clients, invoices, jobs, contracts] = await Promise.all([
    db.select({ id: quotesTable.id, clientData: quotesTable.clientData, desc: quotesTable.descrizioneGenerale, total: quotesTable.totale, declinedAt: quotesTable.declinedAt, acceptedAt: quotesTable.acceptedAt, status: quotesTable.status, sentAt: quotesTable.sentAt, validDays: quotesTable.validDays, archivedAt: quotesTable.archivedAt, archivedByName: quotesTable.archivedByName })
      .from(quotesTable).where(and(eq(quotesTable.userId, orgId), isNotNull(quotesTable.archivedAt))),
    db.select({ id: clientsTable.id, name: clientsTable.name, archivedAt: clientsTable.archivedAt, archivedByName: clientsTable.archivedByName })
      .from(clientsTable).where(and(eq(clientsTable.userId, orgId), isNotNull(clientsTable.archivedAt))),
    db.select({ id: invoicesTable.id, number: invoicesTable.number, title: invoicesTable.title, clientId: invoicesTable.clientId, status: invoicesTable.status, totalCents: invoicesTable.totalCents, archivedAt: invoicesTable.archivedAt, archivedByName: invoicesTable.archivedByName })
      .from(invoicesTable).where(and(eq(invoicesTable.userId, orgId), isNotNull(invoicesTable.archivedAt))),
    db.select({ id: projectsTable.id, name: projectsTable.name, clientId: projectsTable.clientId, status: projectsTable.status, completedAt: projectsTable.completedAt, archivedAt: projectsTable.archivedAt, archivedByName: projectsTable.archivedByName })
      .from(projectsTable).where(and(eq(projectsTable.userId, orgId), isNotNull(projectsTable.archivedAt))),
    db.select({ id: contractsTable.id, number: contractsTable.contractNumber, clientId: contractsTable.clientId, status: contractsTable.status, valueCents: contractsTable.contractValueCents, archivedAt: contractsTable.archivedAt, archivedByName: contractsTable.archivedByName })
      .from(contractsTable).where(and(eq(contractsTable.userId, orgId), isNotNull(contractsTable.archivedAt))),
  ]);

  const ids = [...new Set([...invoices, ...jobs, ...contracts].map((r) => r.clientId).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (ids.length) for (const c of await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, ids))) names.set(c.id, c.name);

  const rows: ArchiveRow[] = [
    ...quotes.map((q) => ({ id: q.id, type: "quote" as const, title: (q.clientData as QuoteClientData | null)?.nome || "", detail: clip(q.desc), state: quoteState(q, now), amountCents: Math.round(Number(q.total) * 100) || null, archivedAt: q.archivedAt!.toISOString(), archivedByName: q.archivedByName })),
    ...clients.map((c) => ({ id: c.id, type: "client" as const, title: c.name, detail: "", state: "client", amountCents: null, archivedAt: c.archivedAt!.toISOString(), archivedByName: c.archivedByName })),
    ...invoices.map((i) => ({ id: i.id, type: "invoice" as const, title: (i.clientId && names.get(i.clientId)) || i.title, detail: i.number, state: i.status, amountCents: i.totalCents, archivedAt: i.archivedAt!.toISOString(), archivedByName: i.archivedByName })),
    ...jobs.map((j) => ({ id: j.id, type: "job" as const, title: (j.clientId && names.get(j.clientId)) || j.name, detail: j.clientId && names.get(j.clientId) ? j.name : "", state: j.completedAt || j.status === "completed" ? "finished" : j.status === "suspended" ? "paused" : "open", amountCents: null, archivedAt: j.archivedAt!.toISOString(), archivedByName: j.archivedByName })),
    ...contracts.map((c) => ({ id: c.id, type: "contract" as const, title: (c.clientId && names.get(c.clientId)) || c.number, detail: c.number, state: c.status === "signed" ? "signed" : "not_signed", amountCents: c.valueCents || null, archivedAt: c.archivedAt!.toISOString(), archivedByName: c.archivedByName })),
  ];
  return rows.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}
