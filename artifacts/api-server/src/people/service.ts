import {
  db,
  auditLogTable,
  authUsersTable,
  businessProfilesTable,
  collaboratorsTable,
  contractsTable,
  invoicesTable,
  organizationMembersTable,
  projectsTable,
  quotesTable,
  timeEntriesTable,
  userProfilesTable,
  type TeamMemberRole,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";

// ── Phase 91: a person's own page ────────────────────────────────────────────
// Everything here is about one login inside one company: who they are (name,
// photo, title — shared across companies), what they made (quotes, invoices,
// jobs, contracts stamped with created_by_user_id), what they did (audit rows
// that name them), and the hours they logged when the crew list has them by
// the same email. Attribution only exists from Phase 91 on: older records are
// the company's, not anyone's, and the page says so.

const ATTRIBUTION_SINCE = "2026-09-23";

export type Person = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  memberSince: string;
  phone: string | null;
  jobTitle: string | null;
  bio: string | null;
  setupDone: boolean;
};

export async function loadPerson(userId: string): Promise<Person | null> {
  const [u] = await db.select().from(authUsersTable).where(eq(authUsersTable.id, userId));
  if (!u) return null;
  const [p] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    memberSince: u.createdAt.toISOString(),
    phone: p?.phone ?? null,
    jobTitle: p?.jobTitle ?? null,
    bio: p?.bio ?? null,
    setupDone: !!p?.completedAt,
  };
}

/** The companies a person can act in, with their role and when they joined. */
export async function personCompanies(userId: string) {
  const out: { orgId: string; companyName: string; role: TeamMemberRole | "owner"; joinedAt: string | null; isOwn: boolean }[] = [];
  const [own] = await db.select({ companyName: businessProfilesTable.companyName, createdAt: businessProfilesTable.createdAt }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (own) out.push({ orgId: userId, companyName: own.companyName || "", role: "owner", joinedAt: own.createdAt.toISOString(), isOwn: true });
  const memberships = await db
    .select({ ownerId: organizationMembersTable.ownerId, role: organizationMembersTable.role, joinedAt: organizationMembersTable.joinedAt, companyName: businessProfilesTable.companyName })
    .from(organizationMembersTable)
    .leftJoin(businessProfilesTable, eq(businessProfilesTable.userId, organizationMembersTable.ownerId))
    .where(and(eq(organizationMembersTable.userId, userId), eq(organizationMembersTable.status, "active"), ne(organizationMembersTable.ownerId, userId)));
  for (const m of memberships) out.push({ orgId: m.ownerId, companyName: m.companyName || "", role: m.role, joinedAt: m.joinedAt?.toISOString() ?? null, isOwn: false });
  return out;
}

/** The role `userId` holds in company `orgId` (owner = the profile's own login), or null when they are not in it. */
export async function roleInCompany(userId: string, orgId: string): Promise<TeamMemberRole | null> {
  if (userId === orgId) {
    const [p] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
    return p ? "owner" : null;
  }
  const [m] = await db
    .select({ role: organizationMembersTable.role, joinedAt: organizationMembersTable.joinedAt })
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.userId, userId), eq(organizationMembersTable.ownerId, orgId), eq(organizationMembersTable.status, "active")));
  return m?.role ?? null;
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

// Phase 95: a quote is credited to whoever first sent it, and to whoever made
// it when it never went out from the app (a link copied by hand, a contract
// signed on the spot). Invoices the same way, so one that went out on a
// schedule stays with the person who drew it up.
const quoteCredit = sql`coalesce(${quotesTable.sentByUserId}, ${quotesTable.createdByUserId})`;
const quoteWhen = sql`coalesce(${quotesTable.sentAt}, ${quotesTable.createdAt})`;
const invoiceCredit = sql`coalesce(${invoicesTable.sentByUserId}, ${invoicesTable.createdByUserId})`;
const DECIDED_AFTER_DAYS = 30;

export type PersonStats = {
  months: number;
  since: string;
  attributionSince: string;
  /** created: made by them. sent: first sent by them. won / winRate: credited to them (sent by them, or made by them and never sent). */
  quotes: { created: number; valueCents: number; sent: number; won: number; wonValueCents: number; winRate: number | null };
  invoices: { issued: number; invoicedCents: number; paidCents: number };
  jobs: number;
  contracts: number;
  hours: { total: number; linkedWorker: boolean };
  series: { month: string; quotes: number; quoteValueCents: number; sent: number; won: number; invoicedCents: number; hours: number }[];
};

/** What one person made and logged in one company over the last `months` months. */
export async function personStats(orgId: string, personId: string, opts: { months?: number; now?: Date } = {}): Promise<PersonStats> {
  const now = opts.now ?? new Date();
  const months = Math.min(24, Math.max(1, opts.months ?? 6));
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
  const keys = Array.from({ length: months }, (_, i) => monthKey(new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1))));
  const series = keys.map((month) => ({ month, quotes: 0, quoteValueCents: 0, sent: 0, won: 0, invoicedCents: 0, hours: 0 }));
  const at = (d: Date) => series[keys.indexOf(monthKey(d))];

  const [made, credited, invoices, jobs, contracts, person] = await Promise.all([
    db.select({ totale: quotesTable.totale, createdAt: quotesTable.createdAt }).from(quotesTable).where(and(eq(quotesTable.userId, orgId), eq(quotesTable.createdByUserId, personId), gte(quotesTable.createdAt, since))),
    db
      .select({ totale: quotesTable.totale, status: quotesTable.status, sentBy: quotesTable.sentByUserId, sentAt: quotesTable.sentAt, createdAt: quotesTable.createdAt })
      .from(quotesTable)
      .where(and(eq(quotesTable.userId, orgId), sql`${quoteCredit} = ${personId}`, sql`${quoteWhen} >= ${since.toISOString()}`)),
    db.select({ type: invoicesTable.type, status: invoicesTable.status, totalCents: invoicesTable.totalCents, paidCents: invoicesTable.paidCents, issueDate: invoicesTable.issueDate }).from(invoicesTable).where(and(eq(invoicesTable.userId, orgId), sql`${invoiceCredit} = ${personId}`, gte(invoicesTable.issueDate, since))),
    db.select({ n: sql<number>`count(*)::int` }).from(projectsTable).where(and(eq(projectsTable.userId, orgId), eq(projectsTable.createdByUserId, personId), gte(projectsTable.createdAt, since))),
    db.select({ n: sql<number>`count(*)::int` }).from(contractsTable).where(and(eq(contractsTable.userId, orgId), eq(contractsTable.createdByUserId, personId), gte(contractsTable.createdAt, since))),
    db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, personId)),
  ]);

  let created = 0, valueCents = 0;
  for (const q of made) {
    const cents = Math.round(Number(q.totale) * 100);
    created++;
    valueCents += cents;
    const m = at(q.createdAt);
    if (m) { m.quotes++; m.quoteValueCents += cents; }
  }
  let sent = 0, won = 0, wonValueCents = 0, decided = 0;
  const decidedBefore = now.getTime() - DECIDED_AFTER_DAYS * 86_400_000;
  for (const q of credited) {
    const when = q.sentAt ?? q.createdAt;
    const m = at(when);
    if (q.sentBy === personId) {
      sent++;
      if (m) m.sent++;
    }
    // Win rate over decided quotes: accepted, or out 30+ days and still not accepted (counted as not won).
    if (q.status === "accepted") {
      won++;
      wonValueCents += Math.round(Number(q.totale) * 100);
      decided++;
      if (m) m.won++;
    } else if (when.getTime() < decidedBefore) decided++;
  }
  let issued = 0, invoicedCents = 0, paidCents = 0;
  for (const i of invoices) {
    if (i.status === "draft" || i.status === "void") continue;
    const cents = i.type === "credit_note" ? -Math.abs(i.totalCents) : i.totalCents;
    issued++;
    invoicedCents += cents;
    paidCents += i.paidCents;
    const m = at(i.issueDate);
    if (m) m.invoicedCents += cents;
  }

  // Hours: the crew record in this company with the same email, if there is one.
  const email = person[0]?.email?.toLowerCase() ?? "";
  const workers = email ? await db.select({ id: collaboratorsTable.id }).from(collaboratorsTable).where(and(eq(collaboratorsTable.userId, orgId), sql`lower(${collaboratorsTable.email}) = ${email}`)) : [];
  let hours = 0;
  if (workers.length) {
    const entries = await db
      .select({ hours: timeEntriesTable.hours, date: timeEntriesTable.date, status: timeEntriesTable.status })
      .from(timeEntriesTable)
      .where(and(inArray(timeEntriesTable.workerId, workers.map((w) => w.id)), gte(timeEntriesTable.date, since)));
    for (const e of entries) {
      if (e.status === "rejected") continue;
      const h = Number(e.hours);
      hours += h;
      const m = at(e.date);
      if (m) m.hours = Math.round((m.hours + h) * 100) / 100;
    }
  }

  return {
    months,
    since: since.toISOString().slice(0, 10),
    attributionSince: ATTRIBUTION_SINCE,
    quotes: { created, valueCents, sent, won, wonValueCents, winRate: decided > 0 ? Math.round((won / decided) * 1000) / 10 : null },
    invoices: { issued, invoicedCents, paidCents },
    jobs: jobs[0]?.n ?? 0,
    contracts: contracts[0]?.n ?? 0,
    hours: { total: Math.round(hours * 100) / 100, linkedWorker: workers.length > 0 },
    series,
  };
}

export type ActivityItem = { id: string; at: string; action: string; entityType: string; entityId: string; link: string | null };

const LINKS: Record<string, (id: string) => string> = {
  quote: (id) => `/dashboard/quotes/${id}`,
  invoice: (id) => `/dashboard/invoices/${id}`,
  contract: (id) => `/dashboard/contracts/${id}`,
  project: (id) => `/dashboard/jobs/${id}`,
  job: (id) => `/dashboard/jobs/${id}`,
};

/**
 * One person's history in one company: every audit row that names them, and
 * the records they made (a create is not always audited, so both are read and
 * merged, newest first).
 */
export async function personActivity(orgId: string, personId: string, limit = 60): Promise<ActivityItem[]> {
  const [audits, quotes, invoices, jobs] = await Promise.all([
    db
      .select({ id: auditLogTable.id, at: auditLogTable.createdAt, action: auditLogTable.action, entityType: auditLogTable.entityType, entityId: auditLogTable.entityId })
      .from(auditLogTable)
      .where(and(eq(auditLogTable.userId, orgId), eq(auditLogTable.actorId, personId), isNotNull(auditLogTable.actorId)))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit),
    db.select({ id: quotesTable.id, at: quotesTable.createdAt }).from(quotesTable).where(and(eq(quotesTable.userId, orgId), eq(quotesTable.createdByUserId, personId))).orderBy(desc(quotesTable.createdAt)).limit(20),
    db.select({ id: invoicesTable.id, at: invoicesTable.createdAt }).from(invoicesTable).where(and(eq(invoicesTable.userId, orgId), eq(invoicesTable.createdByUserId, personId))).orderBy(desc(invoicesTable.createdAt)).limit(20),
    db.select({ id: projectsTable.id, at: projectsTable.createdAt }).from(projectsTable).where(and(eq(projectsTable.userId, orgId), eq(projectsTable.createdByUserId, personId))).orderBy(desc(projectsTable.createdAt)).limit(20),
  ]);
  const items: ActivityItem[] = audits.map((a) => ({ id: a.id, at: a.at.toISOString(), action: a.action, entityType: a.entityType, entityId: a.entityId, link: LINKS[a.entityType]?.(a.entityId) ?? null }));
  const seen = new Set(items.filter((i) => i.action === "created").map((i) => `${i.entityType}:${i.entityId}`));
  const made = (entityType: string, rows: { id: string; at: Date }[]) => {
    for (const r of rows) if (!seen.has(`${entityType}:${r.id}`)) items.push({ id: `${entityType}-${r.id}`, at: r.at.toISOString(), action: "created", entityType, entityId: r.id, link: LINKS[entityType]!(r.id) });
  };
  made("quote", quotes);
  made("invoice", invoices);
  made("project", jobs);
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// ── Phase 95: the team leaderboard ───────────────────────────────────────────
// Everyone in the company (the owner and every active member), what they sent,
// what was won on their credit and what they invoiced over the last `days`
// days, with the same crediting rules as personStats. Two grouped queries,
// whatever the team size.

export type LeaderboardRow = {
  userId: string;
  name: string;
  image: string | null;
  role: TeamMemberRole | "owner";
  sent: number;
  won: number;
  winRate: number | null;
  invoicedCents: number;
};

export async function teamLeaderboard(orgId: string, opts: { days?: number; now?: Date } = {}): Promise<{ days: number; since: string; attributionSince: string; rows: LeaderboardRow[] }> {
  const now = opts.now ?? new Date();
  const days = Math.min(365, Math.max(7, opts.days ?? 90));
  const since = new Date(now.getTime() - days * 86_400_000);
  const decidedBefore = new Date(now.getTime() - DECIDED_AFTER_DAYS * 86_400_000);

  const members = await db
    .select({ userId: organizationMembersTable.userId, role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.ownerId, orgId), eq(organizationMembersTable.status, "active"), isNotNull(organizationMembersTable.userId), ne(organizationMembersTable.userId, orgId)));
  const roles = new Map<string, TeamMemberRole | "owner">([[orgId, "owner"]]);
  for (const m of members) if (m.userId) roles.set(m.userId, m.role);
  const ids = [...roles.keys()];

  const [users, quoteRows, invoiceRows] = await Promise.all([
    db.select({ id: authUsersTable.id, name: authUsersTable.name, email: authUsersTable.email, image: authUsersTable.image }).from(authUsersTable).where(inArray(authUsersTable.id, ids)),
    db
      .select({
        pid: sql<string>`${quoteCredit}`,
        sent: sql<number>`count(*) filter (where ${quotesTable.sentByUserId} is not null)::int`,
        won: sql<number>`count(*) filter (where ${quotesTable.status} = 'accepted')::int`,
        decided: sql<number>`count(*) filter (where ${quotesTable.status} = 'accepted' or ${quoteWhen} < ${decidedBefore.toISOString()})::int`,
      })
      .from(quotesTable)
      .where(and(eq(quotesTable.userId, orgId), inArray(quoteCredit, ids), sql`${quoteWhen} >= ${since.toISOString()}`))
      .groupBy(quoteCredit),
    db
      .select({
        pid: sql<string>`${invoiceCredit}`,
        cents: sql<number>`coalesce(sum(case when ${invoicesTable.type} = 'credit_note' then -abs(${invoicesTable.totalCents}) else ${invoicesTable.totalCents} end), 0)::bigint`,
      })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.userId, orgId), inArray(invoiceCredit, ids), gte(invoicesTable.issueDate, since), sql`${invoicesTable.status} not in ('draft', 'void')`))
      .groupBy(invoiceCredit),
  ]);

  const q = new Map(quoteRows.map((r) => [r.pid, r]));
  const inv = new Map(invoiceRows.map((r) => [r.pid, Number(r.cents)]));
  const rows: LeaderboardRow[] = users.map((u) => {
    const s = q.get(u.id);
    const won = s?.won ?? 0;
    const decided = s?.decided ?? 0;
    return {
      userId: u.id,
      name: u.name || u.email,
      image: u.image ?? null,
      role: roles.get(u.id)!,
      sent: s?.sent ?? 0,
      won,
      winRate: decided > 0 ? Math.round((won / decided) * 1000) / 10 : null,
      invoicedCents: inv.get(u.id) ?? 0,
    };
  });
  rows.sort((a, b) => b.won - a.won || b.invoicedCents - a.invoicedCents || b.sent - a.sent || a.name.localeCompare(b.name));
  return { days, since: since.toISOString().slice(0, 10), attributionSince: ATTRIBUTION_SINCE, rows };
}
