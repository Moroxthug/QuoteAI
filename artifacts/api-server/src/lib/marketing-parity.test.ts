// Phase 81 — the marketing site prints prices and tax rates in its
// *prerendered* HTML, so it cannot wait for an API call to know them. Two
// files in the frontend therefore mirror server data:
//
//   artifacts/quote-ai/src/data/pricing.ts     ← PLANS in routes/payments.ts
//   artifacts/quote-ai/src/lib/tax-profiles.ts ← lib/db/src/schema/tax.ts
//
// A mirror nobody checks is a lie waiting to happen: a price moved in Stripe
// and the pricing page keeps quoting last year's number, or an HST rate
// changes and the Ontario landing page contradicts the invoice PDF. These
// tests import both sides and fail the build on any drift.

import { describe, expect, it } from "vitest";
import { TAX_PROFILES as SERVER_TAX_PROFILES, PROVINCE_NAMES as SERVER_PROVINCE_NAMES } from "@workspace/db";
import { PLANS } from "../routes/payments.js";
import { yearlyPriceFor } from "./billing.js";
import {
  MARKETING_PLANS,
  ONE_SHOT_OPTIONS,
  ANNUAL_MONTHS_CHARGED,
  yearlyPrice,
} from "../../../quote-ai/src/data/pricing.js";
import {
  TAX_PROFILES as CLIENT_TAX_PROFILES,
  PROVINCE_NAMES as CLIENT_PROVINCE_NAMES,
  CANADIAN_PROVINCES,
} from "../../../quote-ai/src/lib/tax-profiles.js";
import {
  MARKETING_SLOTS,
  slotsAwaitingPhotography,
  type MarketingSlotId,
} from "../../../quote-ai/src/data/marketing-images.js";

describe("pricing page mirrors the Stripe plan table", () => {
  it("every marketing tier has the server's price and quota", () => {
    for (const marketing of MARKETING_PLANS) {
      const server = PLANS.find((p) => p.id === marketing.id);
      expect(server, `no server plan for ${marketing.id}`).toBeDefined();
      expect(server!.price, `${marketing.id} monthly price`).toBe(marketing.monthly);
      expect(server!.quotaPerMonth ?? null, `${marketing.id} quota`).toBe(marketing.quotaPerMonth);
      expect(server!.name, `${marketing.id} name`).toBe(marketing.name);
    }
  });

  it("the pay-per-quote options match too", () => {
    for (const option of ONE_SHOT_OPTIONS) {
      const server = PLANS.find((p) => p.id === option.id);
      expect(server, `no server plan for ${option.id}`).toBeDefined();
      expect(server!.price, `${option.id} price`).toBe(option.price);
      expect(server!.interval, `${option.id} should not be a subscription`).toBeNull();
    }
  });

  it("no subscription tier is missing from the marketing page", () => {
    const serverTiers = PLANS.filter((p) => p.interval === "month").map((p) => p.id).sort();
    expect(MARKETING_PLANS.map((p) => p.id).sort()).toEqual(serverTiers);
  });

  it("annual is 10 months on both sides", () => {
    expect(ANNUAL_MONTHS_CHARGED).toBe(10);
    for (const plan of MARKETING_PLANS) {
      expect(yearlyPrice(plan.monthly)).toBe(yearlyPriceFor(plan.monthly));
    }
  });
});

describe("province pages mirror the tax table the documents use", () => {
  it("every province's components and total rate are identical", () => {
    for (const code of CANADIAN_PROVINCES) {
      expect(CLIENT_TAX_PROFILES[code], `missing ${code}`).toEqual(SERVER_TAX_PROFILES[code]);
    }
  });

  it("the client mirror covers exactly the provinces the server knows", () => {
    expect([...CANADIAN_PROVINCES].sort()).toEqual(Object.keys(SERVER_TAX_PROFILES).sort());
  });

  it("province names match in both languages", () => {
    expect(CLIENT_PROVINCE_NAMES).toEqual(SERVER_PROVINCE_NAMES);
  });
});

describe("marketing image slots", () => {
  const ids = Object.keys(MARKETING_SLOTS) as MarketingSlotId[];

  it("every slot that will hold a photograph has alt text in both languages", () => {
    // A decorative band renders alt="" either way; everything else must be
    // describable the day a photograph lands, or it ships without alt text.
    const missing = ids.filter((id) => {
      const slot = MARKETING_SLOTS[id];
      if (slot.shape === "band") return false;
      const alt = "alt" in slot ? slot.alt : undefined;
      // The card grids are thumbnails whose article title is right beside
      // them; they are deliberately decorative too.
      return slot.shape === "split" && (!alt?.en || !alt?.fr);
    });
    expect(missing).toEqual([]);
  });

  it("a photograph path, once set, is a local asset — never a third-party host", () => {
    // The whole point of the phase: nothing on the marketing site loads an
    // image from someone else's domain.
    const external = ids.filter((id) => {
      const src = MARKETING_SLOTS[id].src as string | null;
      return src !== null && !src.startsWith("/");
    });
    expect(external).toEqual([]);
  });

  it("slotsAwaitingPhotography reports exactly the slots with no file yet", () => {
    const awaiting = slotsAwaitingPhotography();
    expect(awaiting).toEqual(ids.filter((id) => MARKETING_SLOTS[id].src === null));
    // Owner track O12 — this is the checklist that number comes from.
    expect(awaiting.length).toBeLessThanOrEqual(ids.length);
  });
});
