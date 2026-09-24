// Phase 98 — what GET /api/healthz/owner says about the owner's Stripe setup.
// The mistakes it exists to catch: a test-mode id pasted into production, a
// monthly price where a yearly one belongs, and a pilot code that was never
// created (or was created in the other mode).
import { describe, test, expect } from "vitest";
import { ownerReadiness } from "./ownerReadiness";

type Price = { active: boolean; livemode: boolean; currency: string; unit_amount: number; recurring: { interval: "month" | "year" } | null };

function fakeStripe(prices: Record<string, Price>, promos: Record<string, { active: boolean; percent_off?: number }> = {}) {
  return {
    prices: {
      retrieve: async (id: string) => {
        const p = prices[id];
        if (!p) throw Object.assign(new Error(`No such price: '${id}'`), { code: "resource_missing" });
        return p as never;
      },
    },
    promotionCodes: {
      list: async ({ code }: { code: string }) => {
        const p = promos[code];
        return { data: p ? [{ active: p.active, promotion: { coupon: { percent_off: p.percent_off ?? null, amount_off: null } } }] : [] } as never;
      },
    },
  };
}

const yearly = (livemode: boolean): Price => ({ active: true, livemode, currency: "cad", unit_amount: 99000, recurring: { interval: "year" } });
const monthly = (livemode: boolean): Price => ({ active: true, livemode, currency: "cad", unit_amount: 1500, recurring: { interval: "month" } });

describe("owner readiness", () => {
  test("reports presence only, never a value", async () => {
    const r = await ownerReadiness({ SENTRY_DSN: "https://secret@o1.ingest.sentry.io/1", OPS_ALERT_EMAIL: "  " }, null);
    expect(r.vars.SENTRY_DSN).toBe(true);
    expect(r.vars.OPS_ALERT_EMAIL).toBe(false); // blank counts as unset
    expect(JSON.stringify(r)).not.toContain("secret@");
    expect(r.stripe.mode).toBe("unset");
    expect(r.stripe.prices.STRIPE_PRICE_YEARLY_PRO).toMatchObject({ set: false, ok: false });
  });

  test("a correct live setup passes", async () => {
    const stripe = fakeStripe(
      { price_ys: yearly(true), price_seat: monthly(true), price_seat_y: yearly(true) },
      { PILOT2026: { active: true, percent_off: 50 } },
    );
    const r = await ownerReadiness(
      { STRIPE_SECRET_KEY: "sk_live_x", STRIPE_PRICE_YEARLY_STARTER: "price_ys", STRIPE_PRICE_EXTRA_SEAT: "price_seat", STRIPE_PRICE_EXTRA_SEAT_YEARLY: "price_seat_y", PILOT_PROMO_CODE: "PILOT2026" },
      stripe,
    );
    expect(r.stripe.mode).toBe("live");
    expect(r.stripe.prices.STRIPE_PRICE_YEARLY_STARTER).toMatchObject({ ok: true, amount: 99000, interval: "year" });
    expect(r.stripe.prices.STRIPE_PRICE_EXTRA_SEAT.ok).toBe(true);
    expect(r.stripe.prices.STRIPE_PRICE_EXTRA_SEAT_YEARLY.ok).toBe(true);
    expect(r.stripe.promo).toMatchObject({ ok: true, code: "PILOT2026", percentOff: 50 });
  });

  test("the pasting mistakes are named", async () => {
    const stripe = fakeStripe({ price_test: yearly(false), price_monthly: monthly(true) });
    const r = await ownerReadiness(
      {
        STRIPE_SECRET_KEY: "sk_live_x",
        STRIPE_PRICE_YEARLY_PRO: "price_test", // test id on a live key
        STRIPE_PRICE_YEARLY_ELITE: "price_monthly", // monthly where yearly belongs
        STRIPE_PRICE_GROUP_COMPANY: "price_gone", // not in this mode at all
        PILOT_PROMO_CODE: "NOPE",
      },
      stripe,
    );
    expect(r.stripe.prices.STRIPE_PRICE_YEARLY_PRO.problem).toMatch(/test-mode price on a live-mode key/);
    expect(r.stripe.prices.STRIPE_PRICE_YEARLY_ELITE.problem).toMatch(/every month, should be every year/);
    expect(r.stripe.prices.STRIPE_PRICE_GROUP_COMPANY.problem).toMatch(/no such price in live mode/);
    expect(r.stripe.promo).toMatchObject({ set: true, ok: false });
    expect(r.stripe.promo.problem).toMatch(/no promotion code "NOPE"/);
  });

  test("an inactive pilot code is not ok", async () => {
    const r = await ownerReadiness({ STRIPE_SECRET_KEY: "sk_test_x", PILOT_PROMO_CODE: "OLD" }, fakeStripe({}, { OLD: { active: false } }));
    expect(r.stripe.mode).toBe("test");
    expect(r.stripe.promo.problem).toMatch(/inactive/);
  });

  test("cron staleness follows CRON_STALE_AFTER_HOURS", async () => {
    expect((await ownerReadiness({}, null)).cron.staleAfterHours).toBe(25);
    expect((await ownerReadiness({ CRON_STALE_AFTER_HOURS: "2" }, null)).cron.staleAfterHours).toBe(2);
  });
});
