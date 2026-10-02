// Pocket 127.9 (Analytics): the month-by-month numbers behind the Win rate, Average quote, Quote to cash, Top clients and Where leads come from
// cards. The app adds them up for the period the person picks (month, quarter, year), so the server only buckets by month.
import { db, quotesTable, contractsTable, projectsTable, invoicesTable, clientsTable, leadsTable } from "@workspace/db";
import { and, eq, gte, inArray, or } from "drizzle-orm";

const ym = (d: Date): string => d.toISOString().slice(0, 7);
const days = (a: Date, b: Date): number => Math.max(0, (b.getTime() - a.getTime()) / 86_400_000);

export type QuoteMonth = { month: string; sent: number; sentCents: number; won: number; wonCents: number; lost: number };
export type CycleMonth = { month: string; acceptDays: number; acceptN: number; invoiceDays: number; invoiceN: number; paidDays: number; paidN: number };
export type ClientMonth = { clientId: string; name: string; month: string; cents: number; invoices: number };
export type LeadMonth = { month: string; source: string; leads: number; won: number };
export type Insights = { months: number; quotes: QuoteMonth[]; cycle: CycleMonth[]; clients: ClientMonth[]; leads: LeadMonth[] };

const upsert = <T extends { month: string }>(map: Map<string, T>, month: string, make: () => T): T => {
  let v = map.get(month);
  if (!v) { v = make(); map.set(month, v); }
  return v;
};

export async function companyInsights(userId: string, opts: { months?: number; now?: Date } = {}): Promise<Insights> {
  const now = opts.now ?? new Date();
  const months = Math.min(48, Math.max(3, opts.months ?? 24));
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));

  const [quotes, invoices, leads] = await Promise.all([
    db.select({ id: quotesTable.id, sentAt: quotesTable.sentAt, acceptedAt: quotesTable.acceptedAt, declinedAt: quotesTable.declinedAt, total: quotesTable.totale })
      .from(quotesTable).where(and(eq(quotesTable.userId, userId), or(gte(quotesTable.sentAt, since), gte(quotesTable.acceptedAt, since), gte(quotesTable.declinedAt, since)))).limit(5000),
    db.select({ id: invoicesTable.id, clientId: invoicesTable.clientId, projectId: invoicesTable.projectId, type: invoicesTable.type, status: invoicesTable.status, totalCents: invoicesTable.totalCents, issueDate: invoicesTable.issueDate, paidAt: invoicesTable.paidAt })
      .from(invoicesTable).where(and(eq(invoicesTable.userId, userId), gte(invoicesTable.issueDate, since))).limit(5000),
    db.select({ source: leadsTable.source, status: leadsTable.status, createdAt: leadsTable.createdAt }).from(leadsTable).where(and(eq(leadsTable.userId, userId), gte(leadsTable.createdAt, since))).limit(5000),
  ]);

  const qm = new Map<string, QuoteMonth>();
  const q = (m: string) => upsert(qm, m, () => ({ month: m, sent: 0, sentCents: 0, won: 0, wonCents: 0, lost: 0 }));
  for (const r of quotes) {
    const cents = Math.round(Number(r.total ?? 0) * 100);
    if (r.sentAt && r.sentAt >= since) { const x = q(ym(r.sentAt)); x.sent++; x.sentCents += cents; }
    if (r.acceptedAt && r.acceptedAt >= since) { const x = q(ym(r.acceptedAt)); x.won++; x.wonCents += cents; }
    if (r.declinedAt && r.declinedAt >= since && !r.acceptedAt) q(ym(r.declinedAt)).lost++;
  }

  // Quote to cash: sent to accepted, accepted to the first invoice (the quote's contract, its job, that job's invoices), and invoiced to paid.
  const cm = new Map<string, CycleMonth>();
  const c = (m: string) => upsert(cm, m, () => ({ month: m, acceptDays: 0, acceptN: 0, invoiceDays: 0, invoiceN: 0, paidDays: 0, paidN: 0 }));
  const accepted = quotes.filter((r) => r.sentAt && r.acceptedAt && r.acceptedAt >= since);
  for (const r of accepted) { const x = c(ym(r.acceptedAt!)); x.acceptDays += days(r.sentAt!, r.acceptedAt!); x.acceptN++; }
  const live = invoices.filter((i) => i.status !== "void" && i.status !== "draft" && i.type !== "credit_note");
  if (accepted.length) {
    const contracts = await db.select({ id: contractsTable.id, quoteId: contractsTable.quoteId }).from(contractsTable).where(and(eq(contractsTable.userId, userId), inArray(contractsTable.quoteId, accepted.map((a) => a.id))));
    const projects = contracts.length ? await db.select({ id: projectsTable.id, contractId: projectsTable.contractId }).from(projectsTable).where(and(eq(projectsTable.userId, userId), inArray(projectsTable.contractId, contracts.map((k) => k.id)))) : [];
    for (const r of accepted) {
      const ids = new Set(projects.filter((p) => contracts.some((k) => k.id === p.contractId && k.quoteId === r.id)).map((p) => p.id));
      const first = live.filter((i) => i.projectId && ids.has(i.projectId)).map((i) => i.issueDate).sort((a, b) => a.getTime() - b.getTime())[0];
      if (first && first >= r.acceptedAt!) { const x = c(ym(first)); x.invoiceDays += days(r.acceptedAt!, first); x.invoiceN++; }
    }
  }
  for (const i of live) if (i.paidAt && i.paidAt >= since) { const x = c(ym(i.paidAt)); x.paidDays += days(i.issueDate, i.paidAt); x.paidN++; }

  // Top clients: the twelve who were invoiced the most over the whole window, by month.
  const byClient = new Map<string, { cents: number; rows: Map<string, { cents: number; invoices: number }> }>();
  for (const i of live) {
    if (!i.clientId) continue;
    const b = byClient.get(i.clientId) ?? { cents: 0, rows: new Map() };
    b.cents += i.totalCents;
    const r = b.rows.get(ym(i.issueDate)) ?? { cents: 0, invoices: 0 };
    r.cents += i.totalCents; r.invoices++;
    b.rows.set(ym(i.issueDate), r);
    byClient.set(i.clientId, b);
  }
  const top = [...byClient.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 12);
  const names = top.length ? new Map((await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(and(eq(clientsTable.userId, userId), inArray(clientsTable.id, top.map(([id]) => id))))).map((r) => [r.id, r.name])) : new Map<string, string>();
  const clients: ClientMonth[] = top.flatMap(([clientId, b]) => [...b.rows.entries()].map(([month, r]) => ({ clientId, name: names.get(clientId) ?? "", month, cents: r.cents, invoices: r.invoices })));

  const lm = new Map<string, LeadMonth>();
  for (const l of leads) {
    if (l.status === "unsubscribed") continue;
    const k = `${ym(l.createdAt)}|${l.source}`;
    const x = lm.get(k) ?? { month: ym(l.createdAt), source: l.source, leads: 0, won: 0 };
    x.leads++;
    if (l.status === "won") x.won++;
    lm.set(k, x);
  }

  const sortM = <T extends { month: string }>(m: Iterable<T>) => [...m].sort((a, b) => a.month.localeCompare(b.month));
  return { months, quotes: sortM(qm.values()), cycle: sortM(cm.values()), clients, leads: sortM(lm.values()) };
}
