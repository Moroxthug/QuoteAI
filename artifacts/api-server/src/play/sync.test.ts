import { describe, expect, it, vi } from "vitest";
import { PlayError } from "./client";
import { runPlaySync } from "./sync";
import type { SyncTarget } from "./entitlement";
import type { SubscriptionPurchaseV2 } from "./purchase";

const NOW = new Date("2026-10-19T15:00:00Z");
const target = (userId: string, over: Partial<SyncTarget> = {}): SyncTarget => ({ userId, token: `token-${userId}-0000`, status: "active", periodEnd: new Date("2026-10-20T00:00:00Z"), ...over });
const reply = (state: string, expiry = "2026-11-19T15:00:00Z", ack = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"): SubscriptionPurchaseV2 => ({
  subscriptionState: state, acknowledgementState: ack, latestOrderId: "GPA.1",
  lineItems: [{ productId: "quoteai_pro", expiryTime: expiry, offerDetails: { basePlanId: "monthly" }, autoRenewingPlan: { autoRenewEnabled: true } }],
});

function deps(targets: SyncTarget[], answer: (token: string) => SubscriptionPurchaseV2 | Error) {
  const apply = vi.fn(async () => ({ plan: null, interval: null, founding: false, status: "active", expiresAt: null, autoRenewing: false }));
  const acknowledge = vi.fn(async () => undefined);
  const getSubscription = vi.fn(async (token: string) => {
    const a = answer(token);
    if (a instanceof Error) throw a;
    return a;
  });
  return { apply, acknowledge, getSubscription, over: { client: { getSubscription, acknowledge }, list: async () => targets, apply: apply as never, now: () => NOW } };
}
type ApplyArgs = [string, string, { entitled: boolean }, boolean];

describe("daily Play sync", () => {
  it("does nothing without a key", async () => {
    expect(await runPlaySync({ client: null })).toMatchObject({ ran: false, reason: "not_configured" });
  });
  it("renewal: applies the active purchase", async () => {
    const d = deps([target("a")], () => reply("SUBSCRIPTION_STATE_ACTIVE"));
    const r = await runPlaySync(d.over);
    expect(r).toMatchObject({ ran: true, checked: 1, updated: 1, ended: 0, errors: 0 });
    expect(d.apply).toHaveBeenCalledTimes(1);
    const [uid, , purchase, wasPaying] = d.apply.mock.calls[0] as unknown as ApplyArgs;
    expect(uid).toBe("a");
    expect(purchase.entitled).toBe(true);
    expect(wasPaying).toBe(true);
  });
  it("expired: applied as not entitled and counted as ended", async () => {
    const d = deps([target("a")], () => reply("SUBSCRIPTION_STATE_EXPIRED", "2026-10-10T00:00:00Z"));
    const r = await runPlaySync(d.over);
    expect(r).toMatchObject({ updated: 1, ended: 1 });
    expect((d.apply.mock.calls[0] as unknown as ApplyArgs)[2].entitled).toBe(false);
  });
  it("on hold: applied as not entitled but not ended", async () => {
    const d = deps([target("a")], () => reply("SUBSCRIPTION_STATE_ON_HOLD", "2026-10-10T00:00:00Z"));
    expect(await runPlaySync(d.over)).toMatchObject({ updated: 1, ended: 0 });
  });
  it("acknowledges a purchase still pending", async () => {
    const d = deps([target("a")], () => reply("SUBSCRIPTION_STATE_ACTIVE", undefined, "ACKNOWLEDGEMENT_STATE_PENDING"));
    expect(await runPlaySync(d.over)).toMatchObject({ acknowledged: 1 });
    expect(d.acknowledge).toHaveBeenCalledWith("quoteai_pro", "token-a-0000");
  });
  it("a token Google forgot, past the period, is over; before the period it is an error to look at", async () => {
    const gone = () => new PlayError("PURCHASE_NOT_VALID", "gone", 410);
    const past = deps([target("a", { periodEnd: new Date("2026-09-01T00:00:00Z") })], gone);
    expect(await runPlaySync(past.over)).toMatchObject({ updated: 1, ended: 1, errors: 0 });
    const early = deps([target("b")], gone);
    expect(await runPlaySync(early.over)).toMatchObject({ updated: 0, errors: 1 });
    expect(early.apply).not.toHaveBeenCalled();
  });
  it("one company failing does not stop the others", async () => {
    const d = deps([target("a"), target("b")], (t) => (t.includes("-a-") ? new PlayError("PLAY_UNAVAILABLE", "x", 500) : reply("SUBSCRIPTION_STATE_ACTIVE")));
    expect(await runPlaySync(d.over)).toMatchObject({ checked: 2, updated: 1, errors: 1 });
  });
  it("a refused key stops the run at once", async () => {
    const d = deps([target("a"), target("b"), target("c")], () => new PlayError("PLAY_NOT_CONFIGURED", "no", 403));
    expect(await runPlaySync(d.over)).toMatchObject({ checked: 1, errors: 1 });
  });
  it("Google being down stops after three in a row", async () => {
    const d = deps([target("a"), target("b"), target("c"), target("d"), target("e")], () => new PlayError("PLAY_UNAVAILABLE", "x", 503));
    expect(await runPlaySync(d.over)).toMatchObject({ checked: 3, errors: 3 });
  });
});
