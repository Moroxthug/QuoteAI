import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { composeSms, formatPhone, isSmsConfigured, normalizePhone, smsFromNumberHint, smsSegments, twilioSignature, verifyTwilioSignature } from "./sms.js";

afterEach(() => vi.unstubAllEnvs());

describe("normalizePhone", () => {
  it("accepts the ways Canadians write a number", () => {
    for (const raw of ["6135550100", "(613) 555-0100", "613.555.0100", "613 555 0100", "1-613-555-0100", "+1 613 555 0100", "+16135550100"]) {
      expect(normalizePhone(raw), raw).toBe("+16135550100");
    }
  });
  it("rejects what is not a NANP number unless written with +", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("555-0100")).toBeNull();
    expect(normalizePhone("0613555010")).toBeNull();
    expect(normalizePhone("16135550100000")).toBeNull();
    expect(normalizePhone("+33 1 23 45 67 89")).toBe("+33123456789");
    expect(normalizePhone("+1")).toBeNull();
  });
  it("formats back for humans", () => {
    expect(formatPhone("+16135550100")).toBe("(613) 555-0100");
    expect(formatPhone("+33123456789")).toBe("+33123456789");
  });
});

describe("smsSegments", () => {
  it("counts GSM-7 and UCS-2 segments the way carriers bill them", () => {
    expect(smsSegments("")).toBe(1);
    expect(smsSegments("a".repeat(160))).toBe(1);
    expect(smsSegments("a".repeat(161))).toBe(2);
    expect(smsSegments("a".repeat(306))).toBe(2);
    expect(smsSegments("a".repeat(307))).toBe(3);
    // é/è/à are in the GSM-7 set; "œ" and "ê" are not → UCS-2 (70/67).
    expect(smsSegments("Répondez à Éric, déjà prêt?".replace("ê", "e"))).toBe(1);
    expect(smsSegments("ê".repeat(70))).toBe(1);
    expect(smsSegments("ê".repeat(71))).toBe(2);
  });
});

describe("composeSms", () => {
  const profile = { companyName: "Acme Reno Inc.", phone: "(613) 555-0100" };
  it("always carries the identity line and the STOP footer", () => {
    const en = composeSms({ profile, body: "Your quote is ready.", lang: "en" });
    expect(en).toBe("Acme Reno Inc. ((613) 555-0100): Your quote is ready. Reply STOP to opt out.");
    const fr = composeSms({ profile, body: "Votre soumission est prête.", lang: "fr" });
    expect(fr).toBe("Acme Reno Inc. ((613) 555-0100): Votre soumission est prête. Répondez STOP pour ne plus recevoir de textos.");
  });
  it("falls back to the name alone without a usable phone and never renders blank", () => {
    expect(composeSms({ profile: { companyName: "", phone: null }, body: "Hi", lang: "en" })).toBe("QuoteAI: Hi Reply STOP to opt out.");
    expect(composeSms({ profile: { companyName: "Acme", phone: "n/a" }, body: "Hi", lang: "en" })).toBe("Acme: Hi Reply STOP to opt out.");
  });
  it("keeps every message within two segments however long the body", () => {
    const out = composeSms({ profile, body: "word ".repeat(200), lang: "en" });
    expect(out.length).toBeLessThanOrEqual(306);
    expect(smsSegments(out)).toBeLessThanOrEqual(2);
    expect(out).toMatch(/\.\.\. Reply STOP to opt out\.$/);
  });
});

describe("Twilio config + signature", () => {
  it("is configured only when all three vars are present", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "tok");
    vi.stubEnv("TWILIO_FROM_NUMBER", "");
    expect(isSmsConfigured()).toBe(false);
    expect(smsFromNumberHint()).toBeNull();
    vi.stubEnv("TWILIO_FROM_NUMBER", "+1 800 555 0199");
    expect(isSmsConfigured()).toBe(true);
    expect(smsFromNumberHint()).toBe("+1 ••• ••• 0199");
  });
  it("follows Twilio's documented recipe (URL + params sorted by key, HMAC-SHA1, base64) and rejects tampering", () => {
    const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
    const params = { To: "+18005551212", CallSid: "CA1234567890ABCDE", Digits: "1234", Caller: "+12349013030", From: "+12349013030" };
    // Independent reference: the recipe from https://www.twilio.com/docs/usage/webhooks/webhooks-security, spelled out.
    const expected = createHmac("sha1", "12345").update(url + "CallSidCA1234567890ABCDECaller+12349013030Digits1234From+12349013030To+18005551212").digest("base64");
    expect(twilioSignature("12345", url, params)).toBe(expected);
    vi.stubEnv("TWILIO_AUTH_TOKEN", "12345");
    expect(verifyTwilioSignature(expected, url, params)).toBe(true);
    expect(verifyTwilioSignature(expected, url, { ...params, Digits: "9999" })).toBe(false);
    expect(verifyTwilioSignature(expected, "https://mycompany.com/myapp.php", params)).toBe(false);
    expect(verifyTwilioSignature(undefined, url, params)).toBe(false);
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    expect(verifyTwilioSignature(expected, url, params)).toBe(false);
  });
});
