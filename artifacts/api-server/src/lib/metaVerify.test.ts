import { describe, expect, it } from "vitest";
import { metaChallengeResponse } from "./metaVerify.js";

const ok = { "hub.mode": "subscribe", "hub.verify_token": "s3cret", "hub.challenge": "1158201444" };

describe("metaChallengeResponse", () => {
  it("echoes the challenge when the token matches", () => {
    expect(metaChallengeResponse(ok, "s3cret")).toBe("1158201444");
  });

  it("refuses everything when no secret is configured, even with no token sent", () => {
    expect(metaChallengeResponse({ "hub.mode": "subscribe", "hub.challenge": "1" }, undefined)).toBeNull();
    expect(metaChallengeResponse(ok, undefined)).toBeNull();
    expect(metaChallengeResponse(ok, "")).toBeNull();
  });

  it("refuses a wrong token, a wrong mode, or a missing token", () => {
    expect(metaChallengeResponse({ ...ok, "hub.verify_token": "nope" }, "s3cret")).toBeNull();
    expect(metaChallengeResponse({ ...ok, "hub.mode": "unsubscribe" }, "s3cret")).toBeNull();
    expect(metaChallengeResponse({ "hub.mode": "subscribe", "hub.challenge": "1" }, "s3cret")).toBeNull();
  });

  it("never reflects markup", () => {
    expect(metaChallengeResponse({ ...ok, "hub.challenge": "<script>alert(1)</script>" }, "s3cret")).toBeNull();
    expect(metaChallengeResponse({ ...ok, "hub.challenge": ["1", "2"] }, "s3cret")).toBeNull();
  });
});
