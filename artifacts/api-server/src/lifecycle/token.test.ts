import { describe, expect, it } from "vitest";
import { unsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "./token";

describe("unsubscribe token", () => {
  it("round-trips the user id", () => {
    const t = unsubscribeToken("user_123", "secret")!;
    expect(verifyUnsubscribeToken(t, "secret")).toBe("user_123");
  });
  it("rejects a wrong secret, a tampered id or signature, and junk", () => {
    const t = unsubscribeToken("user_123", "secret")!;
    expect(verifyUnsubscribeToken(t, "other")).toBeNull();
    const sig = t.split(".")[1];
    expect(verifyUnsubscribeToken(`${Buffer.from("user_999").toString("base64url")}.${sig}`, "secret")).toBeNull();
    expect(verifyUnsubscribeToken(`${t}x`, "secret")).toBeNull();
    expect(verifyUnsubscribeToken("", "secret")).toBeNull();
    expect(verifyUnsubscribeToken("abc", "secret")).toBeNull();
    expect(verifyUnsubscribeToken(t, null)).toBeNull();
  });
  it("builds the public URL", () => {
    expect(unsubscribeUrl("https://quoteai.ca/", "a.b")).toBe("https://quoteai.ca/api/public/lifecycle/unsubscribe?token=a.b");
  });
});
