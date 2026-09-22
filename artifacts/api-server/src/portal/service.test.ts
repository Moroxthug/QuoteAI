import { describe, test, expect, beforeAll } from "vitest";
import { portalToken, portalUrl, hashToken, maskEmail, otpHash, otpMatches, contractCanSign } from "./service.js";

beforeAll(() => {
  process.env.INVOICE_LINK_SECRET ??= "unit-test-secret";
});

describe("portal link token", () => {
  test("is deterministic per client and differs across clients and companies", () => {
    const a = portalToken({ id: "11111111-1111-1111-1111-111111111111", userId: "u1" });
    expect(portalToken({ id: "11111111-1111-1111-1111-111111111111", userId: "u1" })).toBe(a);
    expect(portalToken({ id: "22222222-2222-2222-2222-222222222222", userId: "u1" })).not.toBe(a);
    expect(portalToken({ id: "11111111-1111-1111-1111-111111111111", userId: "u2" })).not.toBe(a);
    expect(a).toMatch(/^[A-Za-z0-9_-]{40,}$/); // base64url, no padding — safe in a path segment
    expect(portalUrl(a)).toMatch(new RegExp(`/portal/${a}$`));
    expect(hashToken(a)).toHaveLength(64);
  });
});

describe("email masking", () => {
  test("keeps the first two characters and the domain", () => {
    expect(maskEmail("client@example.com")).toBe("cl•••@example.com");
    expect(maskEmail("a@b.co")).toBe("a@b.co"); // too short to mask — the regex needs two leading characters
  });
});

describe("OTP", () => {
  const client = { id: "c1", portalOtpHash: otpHash("c1", "123456") };
  test("matches the stored code only, and never with no code on file", () => {
    expect(otpMatches(client, "123456")).toBe(true);
    expect(otpMatches(client, "123457")).toBe(false);
    expect(otpMatches({ id: "c2", portalOtpHash: client.portalOtpHash }, "123456")).toBe(false); // bound to the client id
    expect(otpMatches({ id: "c1", portalOtpHash: null }, "123456")).toBe(false);
  });
});

describe("contract 'sign now' from the portal", () => {
  const future = new Date(Date.now() + 86_400_000);
  const signer = { email: "Client@Example.com", status: "pending" };
  test("only a sent/viewed, unexpired contract whose customer signer is the client's mailbox", () => {
    expect(contractCanSign({ status: "sent", expiresAt: future }, signer, "client@example.com")).toBe(true);
    expect(contractCanSign({ status: "viewed", expiresAt: null }, signer, "client@example.com")).toBe(true);
    expect(contractCanSign({ status: "signed", expiresAt: future }, signer, "client@example.com")).toBe(false);
    expect(contractCanSign({ status: "sent", expiresAt: new Date(Date.now() - 1000) }, signer, "client@example.com")).toBe(false);
    expect(contractCanSign({ status: "sent", expiresAt: future }, signer, "other@example.com")).toBe(false);
    expect(contractCanSign({ status: "sent", expiresAt: future }, { ...signer, status: "declined" }, "client@example.com")).toBe(false);
    expect(contractCanSign({ status: "sent", expiresAt: future }, undefined, "client@example.com")).toBe(false);
    expect(contractCanSign({ status: "sent", expiresAt: future }, signer, null)).toBe(false);
  });
});
