// Phase 81 — the marketing site for the pilot.
//
// Most of the phase is prerendered HTML, which `validate-prerender` already
// checks on all 438 pages. What needs a running server is the part the pages
// *ask* the server about: the pilot offer endpoint, and the promise that a
// forged promo code cannot buy anything. Stripe itself is unreachable from
// the harness (sk_test_e2e_not_a_real_key), so the tests here stop at the
// boundary — the Stripe call is covered by the unit tests around it
// (lib/billing.test.ts) and by the owner's own checkout pass.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import "../automations/index.js";
import { startServer, stopServer, api, createOrg, cleanupAll, type TestUser } from "./harness.js";
import { isPilotPromoCode, pilotPromoCode } from "../lib/billing.js";

const SAVED = { PILOT_PROMO_CODE: process.env.PILOT_PROMO_CODE };

describe("pilot offer (Phase 81)", () => {
  let owner: TestUser;

  beforeAll(async () => {
    await startServer();
    delete process.env.PILOT_PROMO_CODE;
    owner = await createOrg({ companyName: "Pilot Co" });
  });

  afterAll(async () => {
    if (SAVED.PILOT_PROMO_CODE === undefined) delete process.env.PILOT_PROMO_CODE;
    else process.env.PILOT_PROMO_CODE = SAVED.PILOT_PROMO_CODE;
    await cleanupAll();
    await stopServer();
  });

  test("with no code configured the endpoint says so instead of inventing an offer", async () => {
    const res = await api("/api/payments/pilot");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ enabled: false, code: null });
    expect(res.body.provinces).toEqual(["BC", "ON", "QC"]);
  });

  test("the offer is public — no session needed, and it is cacheable", async () => {
    const res = await api("/api/payments/pilot");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("max-age=300");
  });

  test("setting the code turns the offer on and publishes exactly that code", async () => {
    process.env.PILOT_PROMO_CODE = "PILOT2026";
    const res = await api("/api/payments/pilot");
    expect(res.body).toMatchObject({ enabled: true, code: "PILOT2026" });
    delete process.env.PILOT_PROMO_CODE;
  });

  test("only the configured code is ever honoured — a forged one is ignored, not looked up", () => {
    process.env.PILOT_PROMO_CODE = "PILOT2026";
    expect(pilotPromoCode()).toBe("PILOT2026");
    expect(isPilotPromoCode("pilot2026")).toBe(true);
    expect(isPilotPromoCode("FREEFOREVER")).toBe(false);
    expect(isPilotPromoCode({ toString: () => "PILOT2026" })).toBe(false);
    delete process.env.PILOT_PROMO_CODE;
    // With nothing configured there is nothing to match, so no Stripe lookup
    // can be provoked by a client sending a code.
    expect(isPilotPromoCode("PILOT2026")).toBe(false);
  });

  test("a promo code on change-plan does not bypass the plan or cadence guards", async () => {
    // Annual is unconfigured in the harness, so this must still be refused —
    // a promo code is not a way around a missing Stripe price.
    const annual = await owner.api("/api/payments/change-plan", {
      method: "POST",
      body: { planType: "monthly_pro", interval: "year", promoCode: "PILOT2026" },
    });
    expect(annual.status).toBe(400);
    expect(annual.body.error).toBe("ANNUAL_BILLING_UNAVAILABLE");

    const bogusPlan = await owner.api("/api/payments/change-plan", {
      method: "POST",
      body: { planType: "monthly_free_forever", interval: "month", promoCode: "PILOT2026" },
    });
    expect(bogusPlan.status).toBe(400);
  });

  test("the plan list the pricing page prerenders from is still the list the server serves", async () => {
    const res = await api("/api/payments/plans");
    expect(res.status).toBe(200);
    const byId = Object.fromEntries((res.body as { id: string; price: number; quotaPerMonth: number | null }[]).map((p) => [p.id, p]));
    // The same three numbers data/pricing.ts prints into the static HTML.
    expect(byId.monthly_starter).toMatchObject({ price: 19, quotaPerMonth: 10 });
    expect(byId.monthly_pro).toMatchObject({ price: 49, quotaPerMonth: 60 });
    expect(byId.monthly_elite).toMatchObject({ price: 59, quotaPerMonth: null });
    expect(byId.oneshot_watermark.price).toBe(5);
    expect(byId.oneshot_clean.price).toBe(13);
  });
});
