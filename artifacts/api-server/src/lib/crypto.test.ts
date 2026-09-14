import { describe, it, expect, beforeAll } from "vitest";

// TOKEN_ENCRYPTION_KEY must be read at call time (getKey() inside crypto.ts),
// so set it before importing the module under test.
beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64); // 32 bytes hex
});

const { encryptSecret, decryptSecret } = await import("./crypto");

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext string", () => {
    const plaintext = "sk_live_super_secret_oauth_token";
    const encrypted = encryptSecret(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
  });

  it("stores iv.tag.ciphertext as three base64 segments", () => {
    const encrypted = encryptSecret("x");
    expect(encrypted.split(".")).toHaveLength(3);
  });

  it("throws on a tampered ciphertext (auth tag mismatch)", () => {
    const encrypted = encryptSecret("do-not-tamper");
    const [iv, tag, data] = encrypted.split(".");
    const tamperedByte = data.length > 0 ? (data[0] === "A" ? "B" : "A") : "A";
    const tampered = [iv, tag, tamperedByte + data.slice(1)].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws on a malformed payload", () => {
    expect(() => decryptSecret("not-a-valid-payload")).toThrow("Malformed encrypted payload");
  });
});
