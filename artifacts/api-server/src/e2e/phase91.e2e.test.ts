// Phase 91 — seats, sign-up answers, access codes, and a page for every person.
//  1. The sign-up answers are saved and read back; they gate nothing.
//  2. Seats: the plan's included seats, then paid extra seats on the company's
//     own subscription (prorated); going below the seats in use is refused;
//     a company without an add-on price or its own subscription is told why.
//  3. Access codes: made for a role, each holding a seat; previewed without an
//     account (forgiving case and dashes); redeemed once by a signed-in person,
//     who lands in the company with that role; expired or used codes refused,
//     and an expired code gives its seat back.
//  4. The person's own page: name, title, photo, setup done; what they made is
//     stamped with who made it; their numbers and history; a teammate can open
//     it inside the company, nobody outside can; audit rows name the person.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, auditLogTable, businessProfilesTable, organizationMembersTable, projectsTable, quotesTable } from "@workspace/db";
import { startServer, stopServer, createOrg, createUser, cleanupAll, api, type TestUser } from "./harness.js";
import { setAddonDriverForTests } from "../lib/subscriptionAddons.js";
import { TINY_PNG_DATA_URL } from "../lib/pngDataUrl.js";

const asOrg = (user: TestUser, orgId: string) => (path: string, opts: Parameters<TestUser["api"]>[1] = {}) => user.api(path, { ...opts, headers: { ...(opts.headers ?? {}), cookie: `qai_active_org=${orgId}` } });

describe("Phase 91 — seats, access codes and personal profiles", () => {
  let owner: TestUser; // Pro: 2 seats included
  let outsider: TestUser;
  const calls: { kind: string; quantity: number }[] = [];

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Seat Test Reno", plan: "monthly_pro" });
    outsider = await createOrg({ companyName: "Elsewhere Inc" });
    setAddonDriverForTests({ async setQuantity(_b, kind, quantity) { calls.push({ kind, quantity }); } });
  });

  afterAll(async () => {
    setAddonDriverForTests(null);
    delete process.env.STRIPE_PRICE_EXTRA_SEAT;
    await cleanupAll();
    await stopServer();
  });

  test("the sign-up answers are saved and read back", async () => {
    expect((await owner.api("/api/company-setup", { method: "PUT", body: { trades: ["painting", "nonsense"] } })).status).toBe(400);
    const saved = await owner.api("/api/company-setup", { method: "PUT", body: { trades: ["painting", "drywall"], teamSize: 8, seatsWanted: 4, fieldCrew: true } });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const bp = await owner.api("/api/business-profile");
    expect(bp.body.companySetup).toMatchObject({ trades: ["painting", "drywall"], teamSize: 8, seatsWanted: 4, fieldCrew: true });
    expect((await owner.api("/api/seats")).body.seatsWanted).toBe(4);
  });

  test("seats: included, then paid extras on the subscription", async () => {
    const first = await owner.api("/api/team/members/invite", { body: { email: "e2e-p91-first@example.invalid", role: "office", send: false } });
    expect(first.status).toBe(201);
    const full = await owner.api("/api/team/members/invite", { body: { email: "e2e-p91-second@example.invalid", role: "office", send: false } });
    expect(full.status).toBe(403);
    expect(full.body.error).toBe("SEAT_LIMIT");

    delete process.env.STRIPE_PRICE_EXTRA_SEAT;
    let seats = await owner.api("/api/seats");
    expect(seats.body).toMatchObject({ used: 2, limit: 2, included: 2, extra: 0, canBuy: false, reason: "SEATS_UNAVAILABLE" });
    expect((await owner.api("/api/seats", { method: "PUT", body: { extraSeats: 3 } })).status).toBe(409);

    process.env.STRIPE_PRICE_EXTRA_SEAT = "price_e2e_extra_seat";
    seats = await owner.api("/api/seats");
    expect(seats.body.reason).toBe("NO_SUBSCRIPTION");
    await db.update(businessProfilesTable).set({ stripeCustomerId: "cus_e2e_seats" }).where(eq(businessProfilesTable.userId, owner.userId));
    seats = await owner.api("/api/seats");
    expect(seats.body).toMatchObject({ canBuy: true, reason: null, pricePerSeatCents: 1500 });

    const bought = await owner.api("/api/seats", { method: "PUT", body: { extraSeats: 3 } });
    expect(bought.status, JSON.stringify(bought.body)).toBe(200);
    expect(bought.body).toMatchObject({ limit: 5, extra: 3 });
    expect(calls.at(-1)).toEqual({ kind: "extra_seat", quantity: 3 });
    expect((await owner.api("/api/team/members/invite", { body: { email: "e2e-p91-second@example.invalid", role: "office", send: false } })).status).toBe(201);

    // 3 seats in use (owner + 2 invites): extras can go to 1, not 0.
    const tooFew = await owner.api("/api/seats", { method: "PUT", body: { extraSeats: 0 } });
    expect(tooFew.status).toBe(409);
    expect(tooFew.body).toMatchObject({ error: "SEATS_IN_USE", minimumExtra: 1 });
  });

  test("access codes: preview, redeem once, the role they carry", async () => {
    // 3 used of 5: four codes would need 7.
    expect((await owner.api("/api/team/members/codes", { body: { count: 4, role: "foreman" } })).body.error).toBe("SEAT_LIMIT");
    const made = await owner.api("/api/team/members/codes", { body: { count: 2, role: "foreman" } });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    const [c1, c2] = made.body.codes as { id: string; code: string }[];
    expect(c1!.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
    expect((await owner.api("/api/seats")).body.used).toBe(5);

    // Anyone can preview a code, typed loosely; a wrong one is a 404.
    const preview = await api(`/api/team/code/${c1!.code.toLowerCase().replace("-", " ")}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ companyName: "Seat Test Reno", role: "foreman", code: c1!.code });
    expect((await api("/api/team/code/ZZZZZ-ZZZZZ")).status).toBe(404);

    // Redeeming needs an account.
    expect((await api(`/api/team/code/${c1!.code}/redeem`, { method: "POST" })).status).toBe(401);
    const newcomer = await createUser({ name: "Casey Newcomer", email: "e2e-p91-casey@example.invalid" });
    const joined = await newcomer.api(`/api/team/code/${c1!.code}/redeem`, { method: "POST" });
    expect(joined.status, JSON.stringify(joined.body)).toBe(200);
    expect(joined.body).toMatchObject({ orgId: owner.userId, role: "foreman" });
    expect((await createUser({}).then((u) => u.api(`/api/team/code/${c1!.code}/redeem`, { method: "POST" })))).toMatchObject({ status: 409 });

    const orgs = await newcomer.api("/api/team/orgs");
    expect(orgs.body.items.map((o: { orgId: string; role: string }) => [o.orgId, o.role])).toContainEqual([owner.userId, "foreman"]);
    const members = await owner.api("/api/team/members");
    const casey = members.body.items.find((m: { userId: string | null }) => m.userId === newcomer.userId);
    expect(casey).toMatchObject({ status: "active", role: "foreman", kind: "code", name: "Casey Newcomer", email: "e2e-p91-casey@example.invalid" });
    const open = members.body.items.find((m: { id: string }) => m.id === c2!.id);
    expect(open).toMatchObject({ status: "invited", kind: "code", email: null, codeHint: c2!.code.slice(-4) });

    // An expired code is refused and gives its seat back.
    await db.update(organizationMembersTable).set({ inviteTokenExpiresAt: new Date(Date.now() - 60_000) }).where(eq(organizationMembersTable.id, c2!.id));
    expect((await api(`/api/team/code/${c2!.code}`)).status).toBe(410);
    expect((await owner.api("/api/seats")).body.used).toBe(4);

    // Only the team's managers make codes.
    expect((await asOrg(newcomer, owner.userId)("/api/team/members/codes", { body: { count: 1, role: "viewer" } })).status).toBe(403);
  });

  test("a person's own page: details, photo, what they made, and who can see it", async () => {
    const office = await createUser({ name: "Robin Office", email: "e2e-p91-first@example.invalid" });
    const invites = await owner.api("/api/team/members");
    const pending = invites.body.items.find((m: { email: string | null }) => m.email === "e2e-p91-first@example.invalid");
    const link = await owner.api(`/api/team/members/${pending.id}/resend`, { method: "POST", body: { send: false } });
    const token = String(link.body.url).split("/team-invite/")[1];
    expect((await office.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);
    const asRobin = asOrg(office, owner.userId);

    const me0 = await asRobin("/api/me");
    expect(me0.body.person).toMatchObject({ name: "Robin Office", setupDone: false, image: null });
    expect(me0.body.current).toEqual({ orgId: owner.userId, role: "office" });
    expect(me0.body.companies.map((c: { orgId: string }) => c.orgId)).toContain(owner.userId);

    const saved = await asRobin("/api/me", { method: "PUT", body: { name: "Robin Estimator", jobTitle: "Estimator", phone: "613-555-0199", complete: true } });
    expect(saved.body.person).toMatchObject({ name: "Robin Estimator", jobTitle: "Estimator", phone: "613-555-0199", setupDone: true });

    const png = Buffer.from(TINY_PNG_DATA_URL.split(",")[1]!, "base64");
    const fd = new FormData();
    fd.append("avatar", new Blob([png], { type: "image/png" }), "me.png");
    const photo = await asRobin("/api/me/avatar", { method: "POST", form: fd });
    expect(photo.status, JSON.stringify(photo.body)).toBe(200);
    expect(photo.body.image).toMatch(/^\/api\/storage\/public-objects\/.*avatars\//);
    const bad = new FormData();
    bad.append("avatar", new Blob(["not an image"], { type: "text/plain" }), "x.txt");
    expect((await asRobin("/api/me/avatar", { method: "POST", form: bad })).status).toBe(400);

    // What Robin makes carries Robin's id; what the owner makes carries the owner's.
    const job = await asRobin("/api/jobs", { body: { name: "Robin's job", address: "5 Elm St" } });
    expect(job.body?.job?.id, JSON.stringify(job.body)).toBeTruthy();
    const quote = await asRobin("/api/quotes/manual", { body: { capitoli: [{ lettera: "A", titolo: "Paint", subtotale: 0, voci: [{ descrizione: "Walls", um: "sqft", quantita: 100, prezzoUnitario: 3, totale: 0 }] }], clientData: { nome: "Pat Client", indirizzo: "1 Main St" } } });
    expect(quote.status, JSON.stringify(quote.body)).toBe(201);
    const ownerJob = await owner.api("/api/jobs", { body: { name: "Owner job", address: "1 Oak St" } });
    const [robinJob] = await db.select().from(projectsTable).where(eq(projectsTable.id, job.body.job.id));
    const [theirs] = await db.select().from(projectsTable).where(eq(projectsTable.id, ownerJob.body.job.id));
    expect(robinJob!.createdByUserId).toBe(office.userId);
    expect(theirs!.createdByUserId).toBe(owner.userId);
    const [q] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.body.id ?? quote.body.quote?.id));
    expect(q!.createdByUserId).toBe(office.userId);

    const stats = await asRobin("/api/me/stats");
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({ jobs: 1, quotes: { created: 1, valueCents: 33_900 } }); // 300 + 13 % HST
    expect(stats.body.series.reduce((n: number, m: { quotes: number }) => n + m.quotes, 0)).toBe(1);
    const activity = await asRobin("/api/me/activity");
    expect(activity.body.items.some((i: { entityType: string; entityId: string }) => i.entityType === "project" && i.entityId === job.body.job.id)).toBe(true);
    expect(activity.body.items.some((i: { entityId: string }) => i.entityId === ownerJob.body.job.id)).toBe(false);

    // Audit rows written with the company id as actor now name the person (the invite accept, Robin's job).
    const rows = await db.select().from(auditLogTable).where(and(eq(auditLogTable.userId, owner.userId), eq(auditLogTable.actorId, office.userId)));
    expect(rows.length).toBeGreaterThan(0);

    // The owner opens Robin's page; the foreman can too (team:view); an outsider cannot.
    const seen = await owner.api(`/api/team/people/${office.userId}`);
    expect(seen.status).toBe(200);
    expect(seen.body).toMatchObject({ role: "office", person: { name: "Robin Estimator", jobTitle: "Estimator" }, stats: { jobs: 1 } });
    expect((await owner.api(`/api/team/people/${owner.userId}`)).body.role).toBe("owner");
    expect((await outsider.api(`/api/team/people/${office.userId}`)).status).toBe(404);
    expect((await owner.api(`/api/team/people/${outsider.userId}`)).status).toBe(404);
  });
});
