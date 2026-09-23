import {
  db,
  businessProfilesTable,
  organizationMembersTable,
  companyGroupsTable,
  companyGroupMembersTable,
  collaboratorsTable,
  invoicesTable,
  costEntriesTable,
  timeEntriesTable,
  effectivePlan,
  type CompanyGroup,
  type CompanyGroupMember,
  type TeamMemberRole,
} from "@workspace/db";
import { roleCan } from "@workspace/permissions";
import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { companyAnalytics, type CompanyAnalytics } from "../analytics/service.js";
import { addonPriceIdFor, isBillingInterval, type BillingInterval } from "../lib/billing.js";
import { AddonError, setAddonQuantity } from "../lib/subscriptionAddons.js";
import { logger } from "../lib/logger.js";
import { paySettingsFor } from "../pay/service.js";
import { addDays, overtimeWindow } from "../pay/rules.js";
import { matchGroupCompany, type GroupCompanyKey } from "./intercompany.js";

// ── Phase 90: multi-entity ───────────────────────────────────────────────────
// A group never merges data. Each read below runs per company, keyed by that
// company's own id, and only for the companies where the person asking holds
// a role that could already read the same thing by switching to it — a group
// is a shortcut across companies, never a way into one.

export class GroupError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** The role `actorId` holds in company `orgId`, or null. The owner is the profile's own login. */
export async function roleIn(actorId: string, orgId: string): Promise<TeamMemberRole | null> {
  if (actorId === orgId) {
    const [p] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
    return p ? "owner" : null;
  }
  const [m] = await db
    .select({ role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.userId, actorId), eq(organizationMembersTable.ownerId, orgId), eq(organizationMembersTable.status, "active")));
  return m?.role ?? null;
}

type GroupCompany = CompanyGroupMember & { companyName: string; province: string | null };
export type GroupState = { group: CompanyGroup; self: CompanyGroupMember; members: GroupCompany[] };

/** The group a company belongs to (or is invited into), with every company in it. */
export async function groupStateFor(orgId: string): Promise<GroupState | null> {
  const [self] = await db.select().from(companyGroupMembersTable).where(eq(companyGroupMembersTable.userId, orgId));
  if (!self) return null;
  const [group] = await db.select().from(companyGroupsTable).where(eq(companyGroupsTable.id, self.groupId));
  if (!group) return null;
  const rows = await db.select().from(companyGroupMembersTable).where(eq(companyGroupMembersTable.groupId, group.id));
  const profiles = rows.length
    ? await db.select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName, province: businessProfilesTable.province }).from(businessProfilesTable).where(inArray(businessProfilesTable.userId, rows.map((r) => r.userId)))
    : [];
  const byId = new Map(profiles.map((p) => [p.userId, p]));
  const members = rows
    .map((r) => ({ ...r, companyName: byId.get(r.userId)?.companyName || "Company", province: byId.get(r.userId)?.province ?? null }))
    .sort((a, b) => (a.userId === group.userId ? -1 : b.userId === group.userId ? 1 : a.createdAt.getTime() - b.createdAt.getTime()));
  return { group, self, members };
}

export const activeMembers = (s: GroupState) => s.members.filter((m) => m.status === "active");

/** Companies in the acting company's group where the person holds a role that passes `check`. */
async function companiesWhere(actorId: string, state: GroupState, check: (role: TeamMemberRole) => boolean): Promise<{ included: (GroupCompany & { role: TeamMemberRole })[]; excluded: { orgId: string; companyName: string; role: TeamMemberRole | null }[] }> {
  const included: (GroupCompany & { role: TeamMemberRole })[] = [];
  const excluded: { orgId: string; companyName: string; role: TeamMemberRole | null }[] = [];
  for (const m of activeMembers(state)) {
    const role = await roleIn(actorId, m.userId);
    if (role && check(role)) included.push({ ...m, role });
    else excluded.push({ orgId: m.userId, companyName: m.companyName, role });
  }
  return { included, excluded };
}

// ── Shared catalog ───────────────────────────────────────────────────────────

/**
 * Whose catalog items a company reads: its own, plus the group's catalog
 * company's when the group has one and this company has not opted out.
 * Writes always stay on the company's own items.
 */
export async function catalogOwnerIds(orgId: string): Promise<string[]> {
  const [row] = await db
    .select({ status: companyGroupMembersTable.status, use: companyGroupMembersTable.useGroupCatalog, catalogOrgId: companyGroupsTable.catalogOrgId, groupId: companyGroupsTable.id })
    .from(companyGroupMembersTable)
    .innerJoin(companyGroupsTable, eq(companyGroupsTable.id, companyGroupMembersTable.groupId))
    .where(eq(companyGroupMembersTable.userId, orgId));
  if (!row || row.status !== "active" || !row.use || !row.catalogOrgId || row.catalogOrgId === orgId) return [orgId];
  // The catalog company has to still be an active member of the same group.
  const [source] = await db
    .select({ id: companyGroupMembersTable.id })
    .from(companyGroupMembersTable)
    .where(and(eq(companyGroupMembersTable.groupId, row.groupId), eq(companyGroupMembersTable.userId, row.catalogOrgId), eq(companyGroupMembersTable.status, "active")));
  return source ? [orgId, row.catalogOrgId] : [orgId];
}

// ── One bill ─────────────────────────────────────────────────────────────────

async function loadProfile(orgId: string) {
  const [p] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
  return p ?? null;
}

/** Whether the billing company pays with its own subscription (not itself covered) and on which interval. */
export async function billingStatus(billingOrgId: string | null): Promise<{ available: boolean; reason: string | null; plan: string | null; interval: BillingInterval }> {
  if (!billingOrgId) return { available: false, reason: "NO_BILLING_COMPANY", plan: null, interval: "month" };
  const p = await loadProfile(billingOrgId);
  const interval: BillingInterval = isBillingInterval(p?.subscriptionInterval) ? p!.subscriptionInterval as BillingInterval : "month";
  const plan = effectivePlan(p);
  if (!addonPriceIdFor("group_company", interval)) return { available: false, reason: "GROUP_BILLING_UNAVAILABLE", plan, interval };
  if (!p || p.planCoveredBy || plan === "free" || !p.stripeCustomerId) return { available: false, reason: "NO_SUBSCRIPTION", plan, interval };
  return { available: true, reason: null, plan, interval };
}

/**
 * Copies the billing company's plan onto every company it covers, and takes
 * it back from any company that is no longer covered. Only ever touches a
 * plan it put there itself (plan_covered_by), never a company's own.
 */
export async function applyCoverage(groupId: string): Promise<void> {
  const [group] = await db.select().from(companyGroupsTable).where(eq(companyGroupsTable.id, groupId));
  if (!group) return;
  const rows = await db.select().from(companyGroupMembersTable).where(eq(companyGroupMembersTable.groupId, groupId));
  const billing = group.billingOrgId ? await loadProfile(group.billingOrgId) : null;
  const billingActive = !!billing && !billing.planCoveredBy && effectivePlan(billing) !== "free";
  for (const r of rows) {
    if (r.userId === group.billingOrgId) continue;
    const covered = r.status === "active" && r.covered && billingActive;
    if (covered) {
      await db
        .update(businessProfilesTable)
        .set({ subscriptionPlan: billing!.subscriptionPlan, subscriptionStatus: "active", subscriptionInterval: billing!.subscriptionInterval, subscriptionPeriodEnd: billing!.subscriptionPeriodEnd, planCoveredBy: billing!.userId })
        .where(eq(businessProfilesTable.userId, r.userId));
    } else {
      await uncoverProfile(r.userId);
    }
  }
}

/** Removes a plan the group put on this company. A plan the company pays for itself is left alone. */
async function uncoverProfile(orgId: string): Promise<void> {
  await db
    .update(businessProfilesTable)
    .set({ subscriptionPlan: null, subscriptionStatus: "cancelled", subscriptionInterval: null, subscriptionPeriodEnd: null, planCoveredBy: null })
    .where(and(eq(businessProfilesTable.userId, orgId), isNotNull(businessProfilesTable.planCoveredBy)));
}

async function coveredCount(groupId: string, billingOrgId: string): Promise<number> {
  const rows = await db.select().from(companyGroupMembersTable).where(and(eq(companyGroupMembersTable.groupId, groupId), eq(companyGroupMembersTable.status, "active"), eq(companyGroupMembersTable.covered, true)));
  return rows.filter((r) => r.userId !== billingOrgId).length;
}

/** Charges the billing company for the companies it now covers. Throws before anything changes if it cannot. */
export async function chargeFor(groupId: string, billingOrgId: string, quantity: number): Promise<void> {
  const p = await loadProfile(billingOrgId);
  const interval: BillingInterval = isBillingInterval(p?.subscriptionInterval) ? p!.subscriptionInterval as BillingInterval : "month";
  try {
    await setAddonQuantity({ stripeCustomerId: p?.stripeCustomerId ?? null, interval }, "group_company", quantity);
  } catch (err) {
    if (err instanceof AddonError) throw new GroupError(err.status, err.code, err.message);
    throw err;
  }
  logger.info({ groupId, billingOrgId, quantity }, "Group billing quantity set");
}

export async function setCovered(state: GroupState, orgId: string, covered: boolean): Promise<void> {
  const billingOrgId = state.group.billingOrgId;
  if (!billingOrgId) throw new GroupError(409, "NO_BILLING_COMPANY", "Pick the company that pays first.");
  const member = activeMembers(state).find((m) => m.userId === orgId);
  if (!member || orgId === billingOrgId) throw new GroupError(404, "NOT_FOUND", "That company is not in the group.");
  if (member.covered === covered) return;
  if (covered) {
    const status = await billingStatus(billingOrgId);
    if (!status.available) throw new GroupError(409, status.reason ?? "NO_SUBSCRIPTION", "The paying company cannot cover another company yet.");
    const own = await loadProfile(orgId);
    if (own && !own.planCoveredBy && effectivePlan(own) !== "free") throw new GroupError(409, "OWN_SUBSCRIPTION_ACTIVE", "That company still pays for its own plan. Cancel it first; it can join the group bill when that plan ends.");
  }
  const next = (await coveredCount(state.group.id, billingOrgId)) + (covered ? 1 : -1);
  await chargeFor(state.group.id, billingOrgId, Math.max(0, next));
  await db.update(companyGroupMembersTable).set({ covered }).where(eq(companyGroupMembersTable.id, member.id));
  await applyCoverage(state.group.id);
}

/**
 * After a company's own subscription changes (webhook): if it pays for a
 * group, its covered companies follow it; if it just started paying for
 * itself, it leaves the group bill.
 */
export async function subscriptionChanged(orgId: string, ownActive: boolean, opts: { ended?: boolean } = {}): Promise<void> {
  const [member] = await db.select().from(companyGroupMembersTable).where(eq(companyGroupMembersTable.userId, orgId));
  if (!member) return;
  const [group] = await db.select().from(companyGroupsTable).where(eq(companyGroupsTable.id, member.groupId));
  if (!group) return;
  if (group.billingOrgId === orgId) {
    // Past due: the covered companies pause with it and come back with it. Deleted: the bill is gone, so is the coverage.
    if (opts.ended) await db.update(companyGroupMembersTable).set({ covered: false }).where(eq(companyGroupMembersTable.groupId, group.id));
    await applyCoverage(group.id);
    return;
  }
  if (!ownActive && member.covered) {
    // A stale event about the company's old subscription must not wipe the plan the group pays for.
    await applyCoverage(group.id);
    return;
  }
  if (ownActive && member.covered) {
    await db.update(companyGroupMembersTable).set({ covered: false }).where(eq(companyGroupMembersTable.id, member.id));
    await db.update(businessProfilesTable).set({ planCoveredBy: null }).where(eq(businessProfilesTable.userId, orgId));
    if (group.billingOrgId) {
      try {
        await chargeFor(group.id, group.billingOrgId, await coveredCount(group.id, group.billingOrgId));
      } catch (err) {
        logger.error({ err, groupId: group.id }, "Could not lower the group bill after a company started paying for itself");
      }
    }
  }
}

/** Takes a company out of its group: coverage ends (and is billed down), its crew links end. */
export async function removeFromGroup(state: GroupState, orgId: string): Promise<void> {
  const member = state.members.find((m) => m.userId === orgId);
  if (!member) return;
  const { group } = state;
  if (member.covered && group.billingOrgId && member.status === "active") {
    await chargeFor(group.id, group.billingOrgId, Math.max(0, (await coveredCount(group.id, group.billingOrgId)) - 1));
  }
  await db.delete(companyGroupMembersTable).where(eq(companyGroupMembersTable.id, member.id));
  await uncoverProfile(orgId);
  await db.update(collaboratorsTable).set({ groupPersonId: null }).where(eq(collaboratorsTable.userId, orgId));
  const patch: Partial<typeof companyGroupsTable.$inferInsert> = {};
  if (group.catalogOrgId === orgId) patch.catalogOrgId = null;
  if (group.billingOrgId === orgId) patch.billingOrgId = null;
  if (Object.keys(patch).length) await db.update(companyGroupsTable).set(patch).where(eq(companyGroupsTable.id, group.id));
  if (group.billingOrgId === orgId) {
    // The paying company left: nobody is covered any more.
    await db.update(companyGroupMembersTable).set({ covered: false }).where(eq(companyGroupMembersTable.groupId, group.id));
    await applyCoverage(group.id);
  }
  // Crew links that now point at only one company are not links.
  await pruneCrewLinks(group.id);
  const left = await db.select({ id: companyGroupMembersTable.id }).from(companyGroupMembersTable).where(eq(companyGroupMembersTable.groupId, group.id));
  if (!left.length || orgId === group.userId) {
    // A group without its managing company is handed to the oldest active member, or ends.
    const [next] = (await db.select().from(companyGroupMembersTable).where(and(eq(companyGroupMembersTable.groupId, group.id), eq(companyGroupMembersTable.status, "active")))).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (next) await db.update(companyGroupsTable).set({ userId: next.userId }).where(eq(companyGroupsTable.id, group.id));
    else await db.delete(companyGroupsTable).where(eq(companyGroupsTable.id, group.id));
  }
}

// ── Crew on more than one payroll ────────────────────────────────────────────

async function pruneCrewLinks(groupId: string): Promise<void> {
  const orgIds = (await db.select({ userId: companyGroupMembersTable.userId }).from(companyGroupMembersTable).where(and(eq(companyGroupMembersTable.groupId, groupId), eq(companyGroupMembersTable.status, "active")))).map((r) => r.userId);
  if (!orgIds.length) return;
  const linked = await db.select({ id: collaboratorsTable.id, personId: collaboratorsTable.groupPersonId }).from(collaboratorsTable).where(and(inArray(collaboratorsTable.userId, orgIds), isNotNull(collaboratorsTable.groupPersonId)));
  const count = new Map<string, number>();
  for (const w of linked) count.set(w.personId!, (count.get(w.personId!) ?? 0) + 1);
  const lonely = linked.filter((w) => (count.get(w.personId!) ?? 0) < 2).map((w) => w.id);
  if (lonely.length) await db.update(collaboratorsTable).set({ groupPersonId: null }).where(inArray(collaboratorsTable.id, lonely));
}

export async function unlinkWorker(state: GroupState, workerId: string): Promise<void> {
  await db.update(collaboratorsTable).set({ groupPersonId: null }).where(eq(collaboratorsTable.id, workerId));
  await pruneCrewLinks(state.group.id);
}

/**
 * The other companies' records for the same person as `worker`, when both
 * companies are still active in one group. Used by the magic link.
 */
export async function linkedWorkers(worker: { id: string; userId: string; groupPersonId: string | null }): Promise<(typeof collaboratorsTable.$inferSelect)[]> {
  if (!worker.groupPersonId) return [];
  const state = await groupStateFor(worker.userId);
  if (!state || state.self.status !== "active") return [];
  const orgIds = activeMembers(state).map((m) => m.userId);
  const rows = await db.select().from(collaboratorsTable).where(and(eq(collaboratorsTable.groupPersonId, worker.groupPersonId), inArray(collaboratorsTable.userId, orgIds)));
  return rows.filter((r) => r.active);
}

// ── Consolidated view ────────────────────────────────────────────────────────

type Totals = CompanyAnalytics["totals"];

export type GroupOverview = {
  months: number;
  companies: { orgId: string; companyName: string; province: string | null; totals: Totals; aging: CompanyAnalytics["aging"]; activeJobs: number }[];
  excluded: { orgId: string; companyName: string; role: TeamMemberRole | null }[];
  consolidated: { invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null; outstandingCents: number; overdueCents: number; pipelineCents: number; activeJobs: number };
  intercompany: { invoicedCents: number; costCents: number; lines: { fromOrgId: string; toOrgId: string; kind: "invoice" | "cost"; count: number; cents: number }[] };
  series: { month: string; invoicedCents: number; collectedCents: number; costCents: number }[];
  aging: CompanyAnalytics["aging"];
  cashFlow: { week: string; netCents: number; cumulativeCents: number }[];
};

/**
 * Every included company's own analytics, added up, with work between group
 * companies taken out of the sums (invoiced by one, a cost to the other).
 * Money is only shown for companies where the person is an owner or admin.
 */
export async function groupOverview(actorId: string, state: GroupState, opts: { months: number; now?: Date }): Promise<GroupOverview> {
  const now = opts.now ?? new Date();
  const months = Math.min(24, Math.max(3, opts.months));
  const { included, excluded } = await companiesWhere(actorId, state, (role) => roleCan(role, "analytics", "full"));
  const perCompany = await Promise.all(included.map(async (c) => ({ c, a: await companyAnalytics(c.userId, { months, now }) })));

  // Intercompany: every group company (not only the included ones) is a counterparty worth recognising.
  const keys = await companyKeys(activeMembers(state).map((m) => m.userId));
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
  const lines = new Map<string, { fromOrgId: string; toOrgId: string; kind: "invoice" | "cost"; count: number; cents: number }>();
  const add = (fromOrgId: string, toOrgId: string, kind: "invoice" | "cost", cents: number) => {
    const k = `${kind}:${fromOrgId}:${toOrgId}`;
    const l = lines.get(k) ?? { fromOrgId, toOrgId, kind, count: 0, cents: 0 };
    l.count += 1;
    l.cents += cents;
    lines.set(k, l);
  };
  let icInvoiced = 0;
  let icCost = 0;
  if (included.length) {
    const ids = included.map((c) => c.userId);
    const [invoices, costs] = await Promise.all([
      db.select({ userId: invoicesTable.userId, type: invoicesTable.type, status: invoicesTable.status, totalCents: invoicesTable.totalCents, customer: invoicesTable.customer }).from(invoicesTable).where(and(inArray(invoicesTable.userId, ids), gte(invoicesTable.issueDate, since))),
      db.select({ userId: costEntriesTable.userId, vendor: costEntriesTable.vendor, totalCents: costEntriesTable.totalCents, status: costEntriesTable.status }).from(costEntriesTable).where(and(inArray(costEntriesTable.userId, ids), gte(costEntriesTable.date, since))),
    ]);
    for (const i of invoices) {
      if (i.status === "void" || i.status === "draft") continue;
      const to = matchGroupCompany(i.customer ?? {}, keys, i.userId);
      if (!to) continue;
      const cents = i.type === "credit_note" ? -Math.abs(i.totalCents) : i.totalCents;
      icInvoiced += cents;
      add(i.userId, to, "invoice", cents);
    }
    for (const c of costs) {
      if (c.status !== "confirmed") continue;
      const from = matchGroupCompany({ name: c.vendor }, keys, c.userId);
      if (!from) continue;
      icCost += c.totalCents;
      add(from, c.userId, "cost", c.totalCents);
    }
  }

  const sum = (k: keyof Totals) => perCompany.reduce((s, p) => s + ((p.a.totals[k] as number | null) ?? 0), 0);
  const invoicedCents = sum("invoicedCents") - icInvoiced;
  const costCents = sum("costCents") - icCost;
  const marginCents = invoicedCents - costCents;

  const series = (perCompany[0]?.a.months ?? []).map((m, i) => ({
    month: m.month,
    invoicedCents: perCompany.reduce((s, p) => s + (p.a.months[i]?.invoicedCents ?? 0), 0),
    collectedCents: perCompany.reduce((s, p) => s + (p.a.months[i]?.collectedCents ?? 0), 0),
    costCents: perCompany.reduce((s, p) => s + (p.a.months[i]?.costCents ?? 0), 0),
  }));
  const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalCents: 0, overdueCents: 0 };
  for (const p of perCompany) for (const k of Object.keys(aging) as (keyof typeof aging)[]) aging[k] += p.a.aging[k];
  const weeks = new Map<string, number>();
  for (const p of perCompany) for (const w of p.a.cashFlow) weeks.set(w.week, (weeks.get(w.week) ?? 0) + w.netCents);
  let running = 0;
  const cashFlow = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, netCents]) => ({ week, netCents, cumulativeCents: (running += netCents) }));

  return {
    months,
    companies: perCompany.map(({ c, a }) => ({ orgId: c.userId, companyName: c.companyName, province: c.province, totals: a.totals, aging: a.aging, activeJobs: a.jobs.active })),
    excluded,
    consolidated: {
      invoicedCents,
      collectedCents: sum("collectedCents"),
      costCents,
      marginCents,
      marginPercent: invoicedCents > 0 ? Math.round((marginCents / invoicedCents) * 1000) / 10 : null,
      outstandingCents: sum("outstandingCents"),
      overdueCents: sum("overdueCents"),
      pipelineCents: sum("pipelineCents"),
      activeJobs: perCompany.reduce((s, p) => s + p.a.jobs.active, 0),
    },
    intercompany: { invoicedCents: icInvoiced, costCents: icCost, lines: [...lines.values()] },
    series,
    aging,
    cashFlow,
  };
}

async function companyKeys(orgIds: string[]): Promise<GroupCompanyKey[]> {
  if (!orgIds.length) return [];
  const rows = await db
    .select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName, email: businessProfilesTable.email, gst: businessProfilesTable.gstHstNumber })
    .from(businessProfilesTable)
    .where(inArray(businessProfilesTable.userId, orgIds));
  return rows.map((r) => ({ orgId: r.userId, name: r.companyName, email: r.email, businessNumber: r.gst }));
}

// ── The crew across companies ────────────────────────────────────────────────

export type GroupCrew = {
  weekOf: string;
  workers: { id: string; orgId: string; companyName: string; name: string; role: string; workerType: string; personId: string | null; hasLink: boolean }[];
  people: { personId: string; name: string; companies: { orgId: string; companyName: string; workerId: string; hours: number; weeklyThreshold: number | null }[]; combinedHours: number; overCombined: boolean }[];
  excluded: { orgId: string; companyName: string; role: TeamMemberRole | null }[];
};

/**
 * Everyone on the crews of the companies where the person may see the team,
 * and — for people on more than one crew — this week's hours at each company
 * and together. Each company pays its own overtime on its own hours; related
 * employers can be treated as one employer under provincial employment
 * standards, so hours that only cross the line when added up are flagged
 * for the accountant rather than paid differently here.
 */
export async function groupCrew(actorId: string, state: GroupState, day: string): Promise<GroupCrew> {
  const { included, excluded } = await companiesWhere(actorId, state, (role) => roleCan(role, "team", "view"));
  const ids = included.map((c) => c.userId);
  const workers = ids.length ? await db.select().from(collaboratorsTable).where(and(inArray(collaboratorsTable.userId, ids), eq(collaboratorsTable.active, true))) : [];
  const nameOf = new Map(included.map((c) => [c.userId, c.companyName]));

  const people = new Map<string, typeof workers>();
  for (const w of workers) if (w.groupPersonId) people.set(w.groupPersonId, [...(people.get(w.groupPersonId) ?? []), w]);
  const linked = [...people.values()].filter((ws) => ws.length > 1);

  // Each company's own overtime week and threshold.
  const settings = new Map<string, { from: string; to: string; weekly: number | null }>();
  for (const orgId of new Set(linked.flat().map((w) => w.userId))) {
    const { effective } = await paySettingsFor(orgId);
    const win = overtimeWindow(day, { weekStartsOn: effective.weekStartsOn, averaging: null });
    settings.set(orgId, { from: win.start, to: win.end, weekly: effective.overtime.weeklyHours });
  }
  const hoursFor = async (w: (typeof workers)[number]) => {
    const s = settings.get(w.userId)!;
    const rows = await db
      .select({ hours: timeEntriesTable.hours, status: timeEntriesTable.status })
      .from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.workerId, w.id), gte(timeEntriesTable.date, new Date(`${s.from}T00:00:00Z`)), lt(timeEntriesTable.date, new Date(`${addDays(s.to, 1)}T00:00:00Z`))));
    return Math.round(rows.filter((r) => r.status !== "rejected").reduce((t, r) => t + Number(r.hours), 0) * 100) / 100;
  };

  const out: GroupCrew["people"] = [];
  for (const ws of linked) {
    const companies = [];
    for (const w of ws) companies.push({ orgId: w.userId, companyName: nameOf.get(w.userId) ?? "", workerId: w.id, hours: await hoursFor(w), weeklyThreshold: settings.get(w.userId)!.weekly });
    const combinedHours = Math.round(companies.reduce((t, c) => t + c.hours, 0) * 100) / 100;
    const lowest = Math.min(...companies.map((c) => c.weeklyThreshold ?? Number.POSITIVE_INFINITY));
    const anyAlone = companies.some((c) => c.weeklyThreshold != null && c.hours > c.weeklyThreshold);
    out.push({ personId: ws[0]!.groupPersonId!, name: ws[0]!.name, companies, combinedHours, overCombined: Number.isFinite(lowest) && combinedHours > lowest && !anyAlone });
  }

  return {
    weekOf: day,
    workers: workers
      .map((w) => ({ id: w.id, orgId: w.userId, companyName: nameOf.get(w.userId) ?? "", name: w.name, role: w.role, workerType: w.workerType, personId: w.groupPersonId && people.get(w.groupPersonId)!.length > 1 ? w.groupPersonId : null, hasLink: !!w.timeTokenHash }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.companyName.localeCompare(b.companyName)),
    people: out.sort((a, b) => a.name.localeCompare(b.name)),
    excluded,
  };
}
