import test from "node:test";
import assert from "node:assert/strict";
import { createFakeBilling, type FakeOptions } from "./playBillingFake.ts";
import { createPurchaseFlow, type FlowApi } from "./playPurchaseFlow.ts";

const offer = { productId: "quoteai_pro", basePlanId: "monthly", offerToken: "tok" };
const fail = (status: number, code?: string) => Object.assign(new Error(code ?? "x"), { status, code });
const setup = (o: FakeOptions, api: Partial<FlowApi> = {}) => {
  const billing = createFakeBilling(o);
  const calls = { verify: [] as { productId: string; purchaseToken: string }[], restore: [] as string[][], applied: 0 };
  const flow = createPurchaseFlow(billing, {
    verify: async (b) => { calls.verify.push(b); return { plan: "monthly_pro", interval: "month", founding: false, status: "active" }; },
    restore: async (b) => { calls.restore.push(b.purchaseTokens); return {}; },
    ...api,
  }, { onApplied: () => { calls.applied++; } });
  return { billing, calls, flow };
};
const settle = () => new Promise((r) => setTimeout(r, 5));

test("a purchase is verified, then finished with Google, then the plan queries refresh", async () => {
  const { billing, calls, flow } = setup({});
  await flow.buy(offer);
  await settle();
  assert.deepEqual(billing.requests, [offer]);
  assert.deepEqual(calls.verify, [{ productId: "quoteai_pro", purchaseToken: "fake-token-1" }]);
  assert.deepEqual(billing.finished, ["fake-token-1"]);
  assert.equal(flow.getState().phase, "done");
  assert.equal(flow.getState().result?.plan, "monthly_pro");
  assert.equal(calls.applied, 1);
});

test("when the server refuses, the purchase is NOT finished and the person sees a failure", async () => {
  const { billing, flow } = setup({}, { verify: async () => { throw fail(400, "PURCHASE_NOT_VALID"); } });
  await flow.buy(offer);
  await settle();
  assert.deepEqual(billing.finished, []);
  assert.deepEqual([flow.getState().phase, flow.getState().error], ["failed", "invalid"]);
});

test("no signal while verifying keeps the purchase open too", async () => {
  const { billing, flow } = setup({}, { verify: async () => { throw fail(0); } });
  await flow.buy(offer);
  await settle();
  assert.deepEqual(billing.finished, []);
  assert.equal(flow.getState().error, "offline");
});

test("PURCHASE_PENDING from the server is a pending state, not an error, and nothing is finished", async () => {
  const { billing, flow } = setup({}, { verify: async () => { throw fail(409, "PURCHASE_PENDING"); } });
  await flow.buy(offer);
  await settle();
  assert.deepEqual([flow.getState().phase, flow.getState().error], ["pending", null]);
  assert.deepEqual(billing.finished, []);
});

test("a slow card (Google says pending) shows pending without calling the server", async () => {
  const { calls, flow } = setup({ outcome: "pending" });
  await flow.buy(offer);
  await settle();
  assert.equal(flow.getState().phase, "pending");
  assert.equal(calls.verify.length, 0);
});

test("the person closing the Play sheet goes back to idle, quietly", async () => {
  const { calls, flow } = setup({ outcome: "cancelled" });
  await flow.buy(offer);
  await settle();
  assert.deepEqual([flow.getState().phase, flow.getState().error], ["idle", null]);
  assert.equal(calls.verify.length, 0);
});

test("a Play error while buying is a generic failure", async () => {
  const { flow } = setup({ outcome: "error" });
  await flow.buy(offer);
  await settle();
  assert.deepEqual([flow.getState().phase, flow.getState().error], ["failed", "generic"]);
});

test("a second tap while a purchase is under way does nothing", async () => {
  const { billing, flow } = setup({ outcome: "pending" });
  await flow.buy(offer);
  await settle();
  await flow.buy(offer);
  await flow.buy(offer);
  // pending is not busy: a new try is allowed; two taps in a row while buying are not
  const r = billing.requests.length;
  assert.ok(r >= 1);
  const busy = setup({}, { verify: () => new Promise(() => undefined) });
  await busy.flow.buy(offer);
  await settle();
  assert.equal(busy.flow.getState().phase, "verifying");
  await busy.flow.buy(offer);
  assert.equal(busy.billing.requests.length, 1);
});

test("app start: an unfinished purchase is verified again and finished, an acknowledged one is left alone", async () => {
  const { billing, calls, flow } = setup({ owned: [{ productId: "quoteai_pro", purchaseToken: "old" }, { productId: "quoteai_starter", purchaseToken: "done", acknowledged: true }] });
  await flow.start();
  await settle();
  assert.deepEqual(calls.verify, [{ productId: "quoteai_pro", purchaseToken: "old" }]);
  assert.deepEqual(billing.finished, ["old"]);
  assert.equal(calls.applied, 1);
});

test("app start: a failure on an old purchase stays quiet and the purchase stays open", async () => {
  const { billing, flow } = setup({ owned: [{ productId: "quoteai_pro", purchaseToken: "old" }] }, { verify: async () => { throw fail(409, "ALREADY_STRIPE_SUBSCRIBER"); } });
  await flow.start();
  await settle();
  assert.equal(flow.getState().phase, "idle");
  assert.deepEqual(billing.finished, []);
});

test("restore sends every held token, then finishes them", async () => {
  const { billing, calls, flow } = setup({ owned: [{ productId: "quoteai_pro", purchaseToken: "a", acknowledged: true }, { productId: "quoteai_starter", purchaseToken: "b", acknowledged: true }, { productId: "quoteai_business", purchaseToken: "p", pending: true }] });
  await flow.restore();
  assert.deepEqual(calls.restore, [["a", "b"]]);
  assert.equal(flow.getState().phase, "restored");
  assert.ok(billing.finished.includes("a") && billing.finished.includes("b"));
  assert.equal(calls.applied, 1);
});

test("restore with nothing held says so and does not call the server", async () => {
  const { calls, flow } = setup({ owned: [] });
  await flow.restore();
  assert.equal(flow.getState().phase, "nothing");
  assert.equal(calls.restore.length, 0);
});

test("restore failure leaves the purchases open", async () => {
  const { billing, flow } = setup({ owned: [{ productId: "quoteai_pro", purchaseToken: "a", acknowledged: true }] }, { restore: async () => { throw fail(503, "PLAY_NOT_CONFIGURED"); } });
  await flow.restore();
  assert.deepEqual([flow.getState().phase, flow.getState().error], ["failed", "unavailable"]);
  assert.deepEqual(billing.finished, []);
});

test("when Google Play cannot connect nothing starts", async () => {
  const { calls, flow } = setup({ connects: false, owned: [{ productId: "quoteai_pro", purchaseToken: "a" }] });
  await flow.start();
  assert.equal(calls.verify.length, 0);
});
