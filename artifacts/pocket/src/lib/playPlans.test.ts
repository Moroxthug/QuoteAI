import test from "node:test";
import assert from "node:assert/strict";
import { baseOffer, errorKind, hasInterval, isPlaySubscriber, isStripeSubscriber, offersFor, productIds, termKey, type PlayCatalog, type PlayOfferDetails } from "./playPlans.ts";

const cur = { provider: null, plan: null, status: null, expiresAt: null, autoRenewing: null } as PlayCatalog["current"];
const products: PlayCatalog["products"] = [
  { productId: "quoteai_starter", basePlanId: "monthly", tier: "starter", interval: "month", founding: false },
  { productId: "quoteai_starter", basePlanId: "yearly", tier: "starter", interval: "year", founding: false },
  { productId: "quoteai_starter", basePlanId: "launch", tier: "starter", interval: "month", founding: true },
  { productId: "quoteai_pro", basePlanId: "monthly", tier: "pro", interval: "month", founding: false },
  { productId: "quoteai_pro", basePlanId: "yearly", tier: "pro", interval: "year", founding: false },
  { productId: "quoteai_business", basePlanId: "monthly", tier: "business", interval: "month", founding: false },
  { productId: "quoteai_business", basePlanId: "yearly", tier: "business", interval: "year", founding: false },
];
const details: PlayOfferDetails[] = products.map((p) => ({ productId: p.productId, basePlanId: p.basePlanId, offerToken: `tok-${p.productId}-${p.basePlanId}`, price: `P-${p.productId}-${p.basePlanId}` }));
const cat = (o: Partial<PlayCatalog> = {}): PlayCatalog => ({ products, launchActive: false, current: cur, ...o });

test("monthly: the normal Starter plan, the founding plan only while the launch is active", () => {
  assert.equal(offersFor(cat(), details, "month")[0]!.basePlanId, "monthly");
  const l = offersFor(cat({ launchActive: true }), details, "month");
  assert.deepEqual(l.map((o) => [o.tier, o.basePlanId, o.founding]), [["starter", "launch", true], ["pro", "monthly", false], ["business", "monthly", false]]);
});
test("a launch base plan the catalog does not list is never shown", () => {
  const c = cat({ launchActive: true, products: products.filter((p) => !p.founding) });
  assert.equal(offersFor(c, details, "month")[0]!.basePlanId, "monthly");
});
test("yearly never uses the founding plan", () => {
  const y = offersFor(cat({ launchActive: true }), details, "year");
  assert.deepEqual(y.map((o) => o.basePlanId), ["yearly", "yearly", "yearly"]);
  assert.equal(y.every((o) => !o.founding), true);
});
test("a plan Google Play returned no price for is left out; the price is the Play string", () => {
  const some = details.filter((d) => d.productId !== "quoteai_pro");
  const o = offersFor(cat(), some, "month");
  assert.deepEqual(o.map((x) => x.tier), ["starter", "business"]);
  assert.equal(o[0]!.price, "P-quoteai_starter-monthly");
  assert.equal(offersFor(cat(), [{ ...details[0]!, price: "" }], "month").length, 0);
});
test("product ids and the year toggle come from the catalog", () => {
  assert.deepEqual(productIds(cat()), ["quoteai_starter", "quoteai_pro", "quoteai_business"]);
  assert.equal(hasInterval(cat(), "year"), true);
  assert.equal(hasInterval(cat({ products: products.filter((p) => p.interval === "month") }), "year"), false);
});
test("subscriber kinds", () => {
  assert.equal(isPlaySubscriber(cat({ current: { ...cur, provider: "play", status: "active" } })), true);
  assert.equal(isPlaySubscriber(cat({ current: { ...cur, provider: "play", status: "expired" } })), false);
  assert.equal(isPlaySubscriber(cat()), false);
  assert.equal(isStripeSubscriber(cat({ current: { ...cur, provider: "stripe", status: "active" } })), true);
  assert.equal(isStripeSubscriber(cat({ current: { ...cur, provider: "stripe", status: "canceled" } })), false);
  assert.equal(isStripeSubscriber(null), false);
});
test("term wording keys", () => {
  assert.equal(termKey({ interval: "month", founding: true }), "founding");
  assert.equal(termKey({ interval: "month", founding: false }), "month");
  assert.equal(termKey({ interval: "year", founding: false }), "year");
});
test("server codes become states", () => {
  assert.equal(errorKind(0, undefined), "offline");
  assert.equal(errorKind(409, "PURCHASE_PENDING"), "pending");
  assert.equal(errorKind(409, "ALREADY_STRIPE_SUBSCRIBER"), "stripe");
  assert.equal(errorKind(400, "PURCHASE_NOT_VALID"), "invalid");
  assert.equal(errorKind(503, "PLAY_NOT_CONFIGURED"), "unavailable");
  assert.equal(errorKind(500, undefined), "generic");
});
test("the base plan own offer, its last pricing phase as the price", () => {
  const offers = [
    { basePlanId: "monthly", offerId: "trial", offerToken: "t1", phases: [{ formattedPrice: "Free" }, { formattedPrice: "$29.00" }] },
    { basePlanId: "monthly", offerId: null, offerToken: "t2", phases: [{ formattedPrice: "$29.00" }] },
    { basePlanId: "yearly", offerId: null, offerToken: "t3", displayPrice: "$290.00" },
  ];
  assert.deepEqual(baseOffer(offers, "monthly"), { offerToken: "t2", price: "$29.00" });
  assert.deepEqual(baseOffer(offers, "yearly"), { offerToken: "t3", price: "$290.00" });
  assert.equal(baseOffer(offers, "launch"), null);
});

test("tier of a plan key", async () => {
  const { tierOfPlan } = await import("./playPlans.ts");
  assert.equal(tierOfPlan("monthly_pro"), "pro");
  assert.equal(tierOfPlan("yearly_business"), "business");
  assert.equal(tierOfPlan("monthly_elite"), null);
  assert.equal(tierOfPlan(null), null);
});
