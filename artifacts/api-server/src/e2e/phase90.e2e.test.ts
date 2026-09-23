// Phase 90 — multi-entity: a group of companies.
//  1. A group is started by one company's owner (Elite), another company is
//     invited only by someone who owns or administers it, and joins only when
//     its own owner accepts. Nobody outside sees or reaches anything.
//  2. One catalog: the group's catalog company's items appear read-only in the
//     other companies, which can opt out.
//  3. The consolidated view adds up only the companies where the person is an
//     owner or admin, and takes work between group companies out of the sums.
//  4. One person on two crews: one magic link reaches both; hours that only
//     cross the overtime line when added up are flagged.
//  5. One bill: the paying company's plan covers another company (charged on
//     its subscription); a company that still pays for itself cannot be
//     covered; leaving the group ends coverage and bills it down.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, businessProfilesTable, collaboratorsTable, costEntriesTable, invoicesTable, priceCatalogItemsTable, projectsTable } from "@workspace/db";
import { startServer, stopServer, createOrg, createUser, cleanupAll, api, type ApiResponse, type TestUser } from "./harness.js";
import { setGroupBillingDriverForTests } from "../groups/service.js";

async function member(owner: TestUser, as: TestUser | null, role: "admin" | "foreman" | "viewer"): Promise<TestUser> {
  const email = as?.email ?? `e2e-p90-${role}-${owner.userId}@example.invalid`;
  const invite = await owner.api("/api/team/members/invite", { body: { email, role } });
  expect(invite.status, JSON.stringify(invite.body)).toBe(201);
  const token = invite.body.url.split("/team-invite/")[1];
  const user = as ?? (await createUser({ email, name: `${role} person` }));
  expect((await user.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);
  return user;
}

type Caller = (path: string, opts?: Parameters<TestUser["api"]>[1]) => Promise<ApiResponse>;

/** Calls as `user` while acting as company `orgId` (the switcher's cookie). */
const actingAs = (user: TestUser, orgId: string) => (path: string, opts: Parameters<TestUser["api"]>[1] = {}) => user.api(path, { ...opts, headers: { ...(opts.headers ?? {}), cookie: `qai_active_org=${orgId}` } });

async function job(org: Caller, name: string): Promise<string> {
  const r = await org("/api/jobs", { body: { name, address: "1 Main St" } });
  expect(r.body?.job?.id, JSON.stringify(r.body)).toBeTruthy();
  await db.update(projectsTable).set({ status: "active" }).where(eq(projectsTable.id, r.body.job.id));
  return r.body.job.id;
}

async function worker(org: Caller, name: string): Promise<string> {
  const r = await org("/api/team/workers", { body: { name, hourlyRateCents: 4000, burdenPercent: 10, workerType: "employee" } });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.worker.id;
}

/** Last week's Monday, so every day of that week is in the past. */
const monday = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7);
  return d.toISOString().slice(0, 10);
})();
const plusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const setPlan = (orgId: string, plan: string | null) => db.update(businessProfilesTable).set({ subscriptionPlan: plan, subscriptionStatus: plan ? "active" : null }).where(eq(businessProfilesTable.userId, orgId));
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("Phase 90 — company groups", () => {
  let a: TestUser; // owns Nord Reno Inc. (ON, Elite)
  let b: TestUser; // owns Nord Reno Quebec Ltd (QC, free) — and makes `a` an admin there
  let outsider: TestUser;
  let foremanA: TestUser;
  let asB: ReturnType<typeof actingAs>;
  const quantities: number[] = [];

  beforeAll(async () => {
    await startServer();
    a = await createOrg({ companyName: "Nord Reno Inc.", province: "ON", profile: { gstHstNumber: "111222333RT0001" } });
    b = await createOrg({ companyName: "Nord Reno Quebec Ltd", province: "QC", plan: "monthly_pro", profile: { gstHstNumber: "444555666RT0001" } });
    outsider = await createOrg({ companyName: "Someone Else Co" });
    await member(b, a, "admin");
    // B runs on the free plan from here (inviting a team member needed Pro).
    await db.update(businessProfilesTable).set({ subscriptionPlan: null, subscriptionStatus: null }).where(eq(businessProfilesTable.userId, b.userId));
    foremanA = await member(a, null, "foreman");
    asB = actingAs(a, b.userId);
    setGroupBillingDriverForTests({ async setQuantity(_billing, q) { quantities.push(q); } });
  });

  afterAll(async () => {
    setGroupBillingDriverForTests(null);
    delete process.env.STRIPE_PRICE_GROUP_COMPANY;
    await cleanupAll();
    await stopServer();
  });

  test("starting a group: Elite, owner only, and invitations only to companies you run", async () => {
    const pro = await createOrg({ plan: "monthly_pro" });
    expect((await pro.api("/api/group", { body: { name: "Pro group" } })).status).toBe(403);
    expect((await foremanA.api("/api/group", { body: { name: "Mine" } })).status).toBe(403);

    const before = await a.api("/api/group");
    expect(before.status).toBe(200);
    expect(before.body.group).toBeNull();
    expect(before.body.candidates.map((c: { orgId: string }) => c.orgId)).toEqual([b.userId]);

    const made = await a.api("/api/group", { body: { name: "Nord Reno group" } });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    expect((await a.api("/api/group", { body: { name: "Again" } })).status).toBe(409);

    // A company the person has no role in cannot be invited.
    expect((await a.api("/api/group/companies", { body: { orgId: outsider.userId } })).status).toBe(403);
    const inv = await a.api("/api/group/companies", { body: { orgId: b.userId } });
    expect(inv.status, JSON.stringify(inv.body)).toBe(201);

    // Pending: B's admin (a, acting as B) cannot accept for B — only B's owner decides.
    expect((await asB("/api/group/accept", { method: "POST" })).status).toBe(403);
    const pending = await b.api("/api/group");
    expect(pending.body.group.self.status).toBe("pending");
    // Nothing is shared while pending.
    expect((await b.api("/api/group/overview")).status).toBe(403); // free plan, no multi_entity
    expect((await a.api("/api/group/overview")).body.companies.map((c: { orgId: string }) => c.orgId)).toEqual([a.userId]);

    const ok = await b.api("/api/group/accept", { method: "POST" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.group.companies.map((c: { status: string }) => c.status)).toEqual(["active", "active"]);

    // The outsider sees no group and reaches none.
    expect((await outsider.api("/api/group")).body.group).toBeNull();
    expect((await outsider.api("/api/group/overview")).status).toBe(404);
    expect((await outsider.api(`/api/group/companies/${b.userId}`, { method: "DELETE" })).status).toBe(404);
  });

  test("one catalog: shared read-only into the other company, which can opt out", async () => {
    await db.insert(priceCatalogItemsTable).values({ userId: a.userId, nome: "Drywall 1/2in sheet", um: "each", prezzoUnitario: "18.50" });
    expect((await b.api("/api/catalog")).body).toHaveLength(0);
    // Only the managing company picks the catalog.
    expect((await b.api("/api/group", { method: "PUT", body: { catalogOrgId: b.userId } })).status).toBe(403);
    expect((await a.api("/api/group", { method: "PUT", body: { catalogOrgId: a.userId } })).status).toBe(200);

    const list = await b.api("/api/catalog");
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ nome: "Drywall 1/2in sheet", shared: true, sharedFrom: "Nord Reno Inc." });
    // Read-only from B.
    expect((await b.api(`/api/catalog/${list.body[0].id}`, { method: "PUT", body: { prezzoUnitario: 1 } })).status).toBe(404);
    expect((await b.api(`/api/catalog/${list.body[0].id}`, { method: "DELETE" })).status).toBe(404);
    // The outsider's catalog is untouched.
    expect((await outsider.api("/api/catalog")).body).toHaveLength(0);

    expect((await b.api("/api/group/me", { method: "PUT", body: { useGroupCatalog: false } })).status).toBe(200);
    expect((await b.api("/api/catalog")).body).toHaveLength(0);
    await b.api("/api/group/me", { method: "PUT", body: { useGroupCatalog: true } });
    expect((await b.api("/api/catalog")).body).toHaveLength(1);
  });

  test("the consolidated view: owner/admin companies only, work between them taken out", async () => {
    const jobA = await job(a.api, "Tower A");
    await setPlan(b.userId, "monthly_pro");
    const jobB = await job(b.api, "Tower B");
    await setPlan(b.userId, null);
    const contractor = { name: "x" };
    // A bills an outside client 10,000 and bills B 3,000 (matched by B's business number).
    await db.insert(invoicesTable).values([
      { userId: a.userId, projectId: jobA, number: "INV-P90-1", type: "progress", status: "sent", province: "ON", issueDate: daysAgo(3), dueDate: daysAgo(-27), contractor, customer: { name: "Outside Client" }, lines: [], subtotalCents: 1_000_000, taxableCents: 1_000_000, taxCents: 0, totalCents: 1_000_000, sentAt: daysAgo(3) },
      { userId: a.userId, projectId: jobA, number: "INV-P90-2", type: "progress", status: "sent", province: "ON", issueDate: daysAgo(3), dueDate: daysAgo(-27), contractor, customer: { name: "NRQ", gstHstNumber: "444 555 666 RT0001" }, lines: [], subtotalCents: 300_000, taxableCents: 300_000, taxCents: 0, totalCents: 300_000, sentAt: daysAgo(3) },
      { userId: b.userId, projectId: jobB, number: "INV-P90-3", type: "progress", status: "sent", province: "QC", issueDate: daysAgo(2), dueDate: daysAgo(-28), contractor, customer: { name: "Client QC" }, lines: [], subtotalCents: 500_000, taxableCents: 500_000, taxCents: 0, totalCents: 500_000, sentAt: daysAgo(2) },
    ]);
    // B's cost for A's work (vendor by name, legal suffix aside) and an ordinary cost.
    await db.insert(costEntriesTable).values([
      { userId: b.userId, projectId: jobB, category: "subcontractor", vendor: "NORD RENO INC", description: "Framing crew", date: daysAgo(2), subtotalCents: 300_000, totalCents: 300_000, status: "confirmed", source: "manual", createdBy: "user", confirmedAt: new Date() },
      { userId: b.userId, projectId: jobB, category: "materials", vendor: "Home Hardware", description: "Studs", date: daysAgo(2), subtotalCents: 100_000, totalCents: 100_000, status: "confirmed", source: "manual", createdBy: "user", confirmedAt: new Date() },
    ]);

    const out = await a.api("/api/group/overview");
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    expect(out.body.companies.map((c: { orgId: string }) => c.orgId).sort()).toEqual([a.userId, b.userId].sort());
    const byOrg = Object.fromEntries(out.body.companies.map((c: { orgId: string; totals: { invoicedCents: number } }) => [c.orgId, c.totals]));
    expect(byOrg[a.userId].invoicedCents).toBe(1_300_000);
    expect(byOrg[b.userId].invoicedCents).toBe(500_000);
    expect(out.body.intercompany.invoicedCents).toBe(300_000);
    expect(out.body.intercompany.costCents).toBe(300_000);
    expect(out.body.consolidated.invoicedCents).toBe(1_500_000);
    expect(out.body.consolidated.costCents).toBe(100_000);
    expect(out.body.consolidated.marginCents).toBe(1_400_000);
    expect(out.body.consolidated.outstandingCents).toBe(1_800_000); // receivables are still owed, intercompany or not
    expect(out.body.consolidated.activeJobs).toBe(2);

    // A foreman in A reaches the page but no company's money.
    const f = await foremanA.api("/api/group/overview");
    expect(f.status).toBe(200);
    expect(f.body.companies).toHaveLength(0);
    expect(f.body.excluded.map((e: { orgId: string }) => e.orgId).sort()).toEqual([a.userId, b.userId].sort());
  });

  test("one person on two crews: one link reaches both, combined hours are flagged", async () => {
    const jobA = await job(a.api, "Crew job A");
    await setPlan(b.userId, "monthly_elite");
    const jobB = await job(b.api, "Crew job B");
    const wA = await worker(a.api, "Sam Leduc");
    const wB = await worker(b.api, "Sam Leduc");
    await setPlan(b.userId, null);
    const wA2 = await worker(a.api, "Other Person");
    const wOut = await worker(outsider.api, "Stranger");

    expect((await a.api("/api/group/crew/link", { body: { workerIds: [wA, wA2] } })).status).toBe(400);
    expect((await a.api("/api/group/crew/link", { body: { workerIds: [wA, wOut] } })).status).toBe(404);
    expect((await foremanA.api("/api/group/crew/link", { body: { workerIds: [wA, wB] } })).status).toBe(403);
    const linked = await a.api("/api/group/crew/link", { body: { workerIds: [wA, wB] } });
    expect(linked.status, JSON.stringify(linked.body)).toBe(200);

    const token = (await a.api(`/api/team/workers/${wA}/invite`, { body: {} })).body.url.split("/t/")[1] as string;
    const page = await api(`/api/t/${token}`);
    expect(page.status).toBe(200);
    expect(page.body.companyName).toBe("Nord Reno Inc.");
    expect(page.body.companies).toEqual([]);

    // B is on the free plan (no time tracking) — its record is not offered, and cannot be reached.
    const bPlan = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, b.userId));
    expect(bPlan[0]!.subscriptionPlan).toBeNull();
    expect((await api(`/api/t/${token}~${wB}`)).status).toBe(410);
    await db.update(businessProfilesTable).set({ subscriptionPlan: "monthly_elite", subscriptionStatus: "active" }).where(eq(businessProfilesTable.userId, b.userId));

    expect((await api(`/api/t/${token}`)).body.companies.map((c: { workerId: string }) => c.workerId).sort()).toEqual([wA, wB].sort());
    const asOther = await api(`/api/t/${token}~${wB}`);
    expect(asOther.status).toBe(200);
    expect(asOther.body.companyName).toBe("Nord Reno Quebec Ltd");
    expect(asOther.body.jobs.map((j: { id: string }) => j.id)).toContain(jobB);
    expect(asOther.body.jobs.map((j: { id: string }) => j.id)).not.toContain(jobA);
    // A worker id that is not this person's is refused, as is the outsider's.
    expect((await api(`/api/t/${token}~${wA2}`)).status).toBe(404);
    expect((await api(`/api/t/${token}~${wOut}`)).status).toBe(404);

    const clocked = await api(`/api/t/${token}~${wB}/clock-in`, { body: { projectId: jobB } });
    expect(clocked.status, JSON.stringify(clocked.body)).toBe(201);
    const [entry] = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.id, wB));
    expect(entry).toBeTruthy();
    expect((await api(`/api/t/${token}~${wB}/clock-out`, { body: {} })).status).toBe(200);

    // 30 h at A + 20 h at B this week: neither passes 44 (ON) or 40 (QC) alone; together they do.
    // Mon–Wed 10 h a day at A, Thu–Fri 10 h a day at B.
    for (const [org, jobId, wid, day] of [[a.api, jobA, wA, 0], [a.api, jobA, wA, 1], [a.api, jobA, wA, 2], [b.api, jobB, wB, 3], [b.api, jobB, wB, 4]] as const) {
      const r = await org(`/api/jobs/${jobId}/time-entries`, { body: { workerId: wid, date: plusDays(monday, day), hours: 10, approve: true } });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
    }
    const crew = await a.api(`/api/group/crew?day=${monday}`);
    expect(crew.status, JSON.stringify(crew.body)).toBe(200);
    const sam = crew.body.people.find((p: { name: string }) => p.name === "Sam Leduc");
    expect(sam.companies).toHaveLength(2);
    expect(sam.combinedHours).toBe(50);
    expect(sam.overCombined).toBe(true);
    expect(crew.body.workers.some((w: { id: string }) => w.id === wOut)).toBe(false);
  });

  test("one bill: covering a company, refused while it pays for itself, and billed down on leaving", async () => {
    // B paid its own way in the last test; put it back on free.
    await db.update(businessProfilesTable).set({ subscriptionPlan: null, subscriptionStatus: null }).where(eq(businessProfilesTable.userId, b.userId));
    expect((await a.api("/api/group/billing", { method: "PUT", body: { pays: true } })).status).toBe(200);

    delete process.env.STRIPE_PRICE_GROUP_COMPANY;
    const off = await a.api(`/api/group/companies/${b.userId}/coverage`, { method: "PUT", body: { covered: true } });
    expect(off.status).toBe(409);
    expect(off.body.error).toBe("GROUP_BILLING_UNAVAILABLE");

    process.env.STRIPE_PRICE_GROUP_COMPANY = "price_e2e_group_company";
    await db.update(businessProfilesTable).set({ stripeCustomerId: "cus_e2e_group" }).where(eq(businessProfilesTable.userId, a.userId));
    // Only the paying company decides whom it pays for.
    expect((await b.api(`/api/group/companies/${a.userId}/coverage`, { method: "PUT", body: { covered: true } })).status).toBe(403);

    // B paying for itself: refused.
    await db.update(businessProfilesTable).set({ subscriptionPlan: "monthly_pro", subscriptionStatus: "active" }).where(eq(businessProfilesTable.userId, b.userId));
    const own = await a.api(`/api/group/companies/${b.userId}/coverage`, { method: "PUT", body: { covered: true } });
    expect(own.body.error).toBe("OWN_SUBSCRIPTION_ACTIVE");
    await db.update(businessProfilesTable).set({ subscriptionPlan: null, subscriptionStatus: "cancelled" }).where(eq(businessProfilesTable.userId, b.userId));

    const on = await a.api(`/api/group/companies/${b.userId}/coverage`, { method: "PUT", body: { covered: true } });
    expect(on.status, JSON.stringify(on.body)).toBe(200);
    expect(quantities.at(-1)).toBe(1);
    const [covered] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, b.userId));
    expect(covered).toMatchObject({ subscriptionPlan: "monthly_elite", subscriptionStatus: "active", planCoveredBy: a.userId });
    const sub = await b.api("/api/payments/subscription");
    expect(sub.body.coveredBy).toEqual({ orgId: a.userId, companyName: "Nord Reno Inc." });
    const bp = await b.api("/api/business-profile");
    expect(bp.body.features?.jobs ?? bp.body.plan).toBeTruthy();

    // B leaves: coverage ends, the bill goes down, the shared catalog and crew link end with it.
    const left = await b.api(`/api/group/companies/${b.userId}`, { method: "DELETE" });
    expect(left.status, JSON.stringify(left.body)).toBe(200);
    expect(quantities.at(-1)).toBe(0);
    const [after] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, b.userId));
    expect(after).toMatchObject({ subscriptionPlan: null, planCoveredBy: null });
    expect((await b.api("/api/catalog")).body).toHaveLength(0);
    const linked = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.userId, a.userId));
    expect(linked.every((w) => w.groupPersonId === null)).toBe(true);
    expect((await a.api("/api/group")).body.group.companies).toHaveLength(1);
  });
});
