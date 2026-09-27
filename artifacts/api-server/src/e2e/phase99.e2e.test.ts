// Phase 99 (2026-09-26) repricing, end to end over HTTP:
//  - Pro runs 3 jobs at a time: a 4th is refused with 402 JOB_LIMIT, archiving
//    or completing one makes room, restoring an archived one and confirming a
//    proposed setup are held to the same cap; Business has no cap.
//  - Elite is custom: the plan list says so, checkout refuses it, and a price
//    made for one customer (metadata quoteai_plan=monthly_elite) unlocks it
//    through the subscription webhook — covered in integrations.e2e.
//  - A plan whose Stripe price is not configured answers 503, not a Stripe error.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { startServer, stopServer, createOrg, cleanupAll, api, type TestUser } from "./harness.js";

async function startJob(org: TestUser, name: string) {
  return org.api("/api/jobs", { body: { name } });
}

describe("Phase 99 — Pro's job cap, Business unlimited, Elite custom", () => {
  let pro: TestUser;
  let business: TestUser;

  beforeAll(async () => {
    await startServer();
    pro = await createOrg({ companyName: "Cap Pro Renos", plan: "monthly_pro" });
    business = await createOrg({ companyName: "No Cap Builders", plan: "monthly_business" });
  }, 120_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("Pro: three jobs open, the fourth is refused with the numbers and the plan that lifts it", async () => {
    const ids: string[] = [];
    for (const n of [1, 2, 3]) {
      const r = await startJob(pro, `Job ${n}`);
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      ids.push(r.body.job.id);
    }
    const fourth = await startJob(pro, "Job 4");
    expect(fourth.status).toBe(402);
    expect(fourth.body).toMatchObject({ error: "JOB_LIMIT", limit: 3, active: 3, requiredPlan: "monthly_business" });

    // A completed job no longer counts.
    await db.update(projectsTable).set({ completedAt: new Date() }).where(eq(projectsTable.id, ids[0]!));
    const afterComplete = await startJob(pro, "Job 4");
    expect(afterComplete.status, JSON.stringify(afterComplete.body)).toBe(201);

    // Archiving makes room; restoring the archived one while full is refused.
    expect((await pro.api(`/api/jobs/${ids[1]}/archive`, { method: "POST", body: {} })).status).toBe(200);
    expect((await startJob(pro, "Job 5")).status).toBe(201);
    const restore = await pro.api(`/api/jobs/${ids[1]}/restore`, { method: "POST", body: {} });
    expect(restore.status).toBe(402);
    expect(restore.body.error).toBe("JOB_LIMIT");
    const [still] = await db.select({ archivedAt: projectsTable.archivedAt }).from(projectsTable).where(eq(projectsTable.id, ids[1]!));
    expect(still!.archivedAt).not.toBeNull();
  });

  test("Pro: a signed contract's job waits in review (not counted) and can't be confirmed past the cap", async () => {
    const [pending] = await db
      .insert(projectsTable)
      .values({ userId: pro.userId, name: "From a signed contract", setupStatus: "pending_review", status: "planning" })
      .returning({ id: projectsTable.id });
    const confirm = await pro.api(`/api/jobs/${pending!.id}/setup/confirm`, { body: {} });
    expect(confirm.status).toBe(402);
    expect(confirm.body.error).toBe("JOB_LIMIT");
    const [row] = await db.select({ setupStatus: projectsTable.setupStatus }).from(projectsTable).where(eq(projectsTable.id, pending!.id));
    expect(row!.setupStatus).toBe("pending_review");
  });

  test("Business: no cap", async () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const r = await startJob(business, `Site ${n}`);
      expect(r.status, JSON.stringify(r.body)).toBe(201);
    }
  });

  test("the plan list: three published prices and a custom Elite with no checkout", async () => {
    const plans = await api("/api/payments/plans");
    expect(plans.status).toBe(200);
    const byId = new Map((plans.body as Array<{ id: string; price: number | null; custom: boolean; checkoutAvailable: boolean; yearlyAvailable: boolean }>).map((p) => [p.id, p]));
    expect(byId.get("monthly_starter")).toMatchObject({ price: 29, custom: false });
    expect(byId.get("monthly_pro")).toMatchObject({ price: 79, custom: false });
    expect(byId.get("monthly_business")).toMatchObject({ price: 249, custom: false });
    expect(byId.get("monthly_elite")).toMatchObject({ price: null, custom: true, checkoutAvailable: false, yearlyAvailable: false });
  });

  test("checkout: Elite is refused as custom; a plan without a configured Stripe price says so instead of failing in Stripe", async () => {
    const owner = await createOrg({ companyName: "Wants Elite", plan: "free" });
    const elite = await owner.api("/api/payments/checkout", { body: { planType: "monthly_elite" } });
    expect(elite.status).toBe(400);
    expect(elite.body.error).toBe("CUSTOM_PLAN");
    const change = await owner.api("/api/payments/change-plan", { body: { planType: "monthly_elite" } });
    expect(change.status).toBe(400);
    expect(change.body.error).toBe("CUSTOM_PLAN");

    const saved = process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_PRICE_PRO;
    try {
      const pro = await owner.api("/api/payments/checkout", { body: { planType: "monthly_pro" } });
      expect(pro.status).toBe(503);
      expect(pro.body.error).toBe("PLAN_UNAVAILABLE");
    } finally {
      if (saved !== undefined) process.env.STRIPE_PRICE_PRO = saved;
    }
  });
});
