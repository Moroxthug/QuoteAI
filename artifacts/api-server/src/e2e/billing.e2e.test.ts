// Phase 73 — legal identity, annual billing, Connect fee.
//
// Stripe itself is not reachable from the harness (sk_test_e2e_not_a_real_key),
// so this file covers everything *around* the Stripe call: the plan list and
// subscription payload, the change-plan guards, the fee disclosure on the
// Connect status, and the registered-entity footer every quoteai.ca email
// now carries. The proration update itself is Stripe's `subscriptions.update`
// and is exercised by hand in the browser pass (see the build log).

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, organizationMembersTable } from "@workspace/db";
import "../automations/index.js";
import { startServer, stopServer, api, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";
import { sentEmails } from "./mailbox.js";

const YEARLY_KEYS = ["STRIPE_PRICE_YEARLY_STARTER", "STRIPE_PRICE_YEARLY_PRO", "STRIPE_PRICE_YEARLY_ELITE"] as const;
const saved: Record<string, string | undefined> = {};

describe("billing (Phase 73)", () => {
  let owner: TestUser;
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = await startServer();
    for (const k of YEARLY_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    saved.STRIPE_CONNECT_FEE_BPS = process.env.STRIPE_CONNECT_FEE_BPS;
    delete process.env.STRIPE_CONNECT_FEE_BPS;
    owner = await createOrg({ companyName: "Billing Co" });
  });

  afterAll(async () => {
    for (const k of [...YEARLY_KEYS, "STRIPE_CONNECT_FEE_BPS"]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    await cleanupAll();
    await stopServer();
  });

  test("the public plan list carries the annual price (10 × monthly) and says annual is not available until the price ids exist", async () => {
    const res = await api("/api/payments/plans");
    expect(res.status).toBe(200);
    const byId = Object.fromEntries((res.body as { id: string; price: number; yearlyPrice: number | null; yearlyAvailable: boolean; stripePriceId?: string }[]).map((p) => [p.id, p]));
    expect(byId.monthly_starter).toMatchObject({ price: 19, yearlyPrice: 190, yearlyAvailable: false });
    expect(byId.monthly_pro).toMatchObject({ price: 49, yearlyPrice: 490, yearlyAvailable: false });
    expect(byId.monthly_elite).toMatchObject({ price: 59, yearlyPrice: 590, yearlyAvailable: false });
    expect(byId.oneshot_clean).toMatchObject({ yearlyPrice: null, yearlyAvailable: false });
    expect(byId.monthly_pro.stripePriceId).toBeUndefined();

    for (const k of YEARLY_KEYS) process.env[k] = `price_y_${k.toLowerCase()}`;
    const after = await api("/api/payments/plans");
    const pro = (after.body as { id: string; yearlyAvailable: boolean }[]).find((p) => p.id === "monthly_pro");
    expect(pro?.yearlyAvailable).toBe(true);
    for (const k of YEARLY_KEYS) delete process.env[k];
  });

  test("the subscription payload exposes the cadence and whether annual is offered", async () => {
    // createOrg seeds an active Elite subscription with no cadence recorded → reads as monthly.
    const res = await owner.api("/api/payments/subscription");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isActive: true, plan: "monthly_elite", interval: "month", annualAvailable: false });
    const free = await createOrg({ plan: "free", companyName: "Free Co" });
    expect((await free.api("/api/payments/subscription")).body).toMatchObject({ isActive: false, interval: null, annualAvailable: false });
  });

  test("change-plan: owner-only, validates the tier, and refuses annual before the prices exist (never a broken Checkout)", async () => {
    const member = await createUser();
    await db.insert(organizationMembersTable).values({ ownerId: owner.userId, userId: member.userId, role: "admin", status: "active", invitedEmail: member.email, invitedByUserId: owner.userId, joinedAt: new Date() });
    expect((await member.api("/api/payments/change-plan", { method: "POST", body: { planType: "monthly_pro", interval: "month" } })).status).toBe(403);

    expect((await owner.api("/api/payments/change-plan", { method: "POST", body: { planType: "oneshot_clean", interval: "month" } })).status).toBe(400);
    expect((await owner.api("/api/payments/change-plan", { method: "POST", body: { planType: "nope", interval: "year" } })).status).toBe(400);

    const annual = await owner.api("/api/payments/change-plan", { method: "POST", body: { planType: "monthly_pro", interval: "year" } });
    expect(annual.status).toBe(400);
    expect(annual.body.error).toBe("ANNUAL_BILLING_UNAVAILABLE");

    const checkout = await owner.api("/api/payments/checkout", { method: "POST", body: { planType: "monthly_pro", interval: "year" } });
    expect(checkout.status).toBe(400);
    expect(checkout.body.error).toBe("ANNUAL_BILLING_UNAVAILABLE");
  });

  test("the Connect status discloses the platform fee before the contractor connects", async () => {
    const res = await owner.api("/api/invoice-payments/connect/status");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ connected: false, applicationFeeBps: 50, applicationFeePercent: "0.5" });

    process.env.STRIPE_CONNECT_FEE_BPS = "0";
    expect((await owner.api("/api/invoice-payments/connect/status")).body).toMatchObject({ applicationFeeBps: 0, applicationFeePercent: "0" });
    process.env.STRIPE_CONNECT_FEE_BPS = "125";
    expect((await owner.api("/api/invoice-payments/connect/status")).body).toMatchObject({ applicationFeeBps: 125, applicationFeePercent: "1.25" });
    delete process.env.STRIPE_CONNECT_FEE_BPS;
  });

  test("every email sent from quoteai.ca carries the registered-entity footer exactly once", async () => {
    // Two different senders: the team invite (lib/emailTeam via resendOrThrow)
    // and the password reset (lib/auth, which builds its own client at import).
    const inviteeEmail = `e2e-invitee-${owner.userId.slice(4, 12)}@example.invalid`;
    expect((await owner.api("/api/team/members/invite", { body: { email: inviteeEmail, role: "viewer" } })).status).toBeLessThan(300);
    const reset = await fetch(`${baseUrl}/api/auth/request-password-reset`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: owner.email, redirectTo: "/reset-password" }) });
    expect(reset.status).toBeLessThan(300);
    const mine = sentEmails.filter((m) => m.to.some((t) => [inviteeEmail, owner.email].includes(t.toLowerCase())));
    expect(mine.length).toBeGreaterThanOrEqual(2);
    for (const m of mine) {
      expect(m.html.split("data-quoteai-legal-footer").length - 1).toBe(1);
      expect(m.html).toContain("support@quoteai.ca");
      expect(m.html).toContain("quoteai.ca");
    }
  });
});
