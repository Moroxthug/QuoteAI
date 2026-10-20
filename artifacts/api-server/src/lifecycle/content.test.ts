import { describe, expect, it } from "vitest";
import { buildLifecycleEmail, formatPrice, offerLine, type LaunchOfferInfo } from "./content";
import { LIFECYCLE_KEYS } from "./rules";

const UNSUB = "https://quoteai.ca/api/public/lifecycle/unsubscribe?token=abc.def";
const ON: LaunchOfferInfo = { active: true, launchPriceCents: 1900, remaining: 42 };
const OFF: LaunchOfferInfo = { active: false, launchPriceCents: 1900, remaining: 0 };
const input = (key: (typeof LIFECYCLE_KEYS)[number], lang: "en" | "fr", offer: LaunchOfferInfo | null = ON) => ({ key, lang, name: "Marc <b>", baseUrl: "https://quoteai.ca", unsubscribeUrl: UNSUB, freeLimit: 3, offer });

// Words that should never show up in the French emails (whole words, case-insensitive).
const ENGLISH = ["the", "your", "you", "quote", "quotes", "free", "open", "choose", "welcome", "unsubscribe", "questions", "email", "left", "spots", "spot", "month", "kept", "life", "account"];

describe("every lifecycle email, both languages", () => {
  for (const lang of ["en", "fr"] as const) {
    for (const key of LIFECYCLE_KEYS) {
      it(`${key} (${lang})`, () => {
        const m = buildLifecycleEmail(input(key, lang));
        expect(m.subject.trim().length).toBeGreaterThan(0);
        expect(m.preheader.trim().length).toBeGreaterThan(0);
        expect(m.html).toContain(UNSUB);
        expect(m.text).toContain(UNSUB);
        // CASL legal footer from the shared helper
        expect(m.html).toContain("data-quoteai-legal-footer");
        // exactly one primary button
        expect((m.html.match(/border-radius:999px;background:#101031/g) ?? []).length).toBe(1);
        // no unreplaced placeholders
        for (const s of [m.subject, m.preheader, m.html, m.text]) {
          expect(s).not.toMatch(/\{[A-Za-z_]+\}|\$\{|undefined|NaN|\[object/);
        }
        // the name is escaped
        expect(m.html).not.toContain("<b>");
        expect(m.html).toContain(`lang="${lang}"`);
        expect(m.html).toContain("https://quoteai.ca/dashboard");
      });
    }
  }

  it("French has no obvious English words", () => {
    for (const key of LIFECYCLE_KEYS) {
      const m = buildLifecycleEmail(input(key, "fr"));
      const plain = `${m.subject} ${m.preheader} ${m.text}`.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/support@quoteai\.ca/g, "");
      const words = plain.match(/[a-zà-ÿ]+/g) ?? [];
      const hits = words.filter((w) => ENGLISH.includes(w));
      expect(hits, `${key}: ${hits.join(",")}`).toEqual([]);
    }
  });

  it("French uses the glossary (soumission, courriel) and vous", () => {
    const all = LIFECYCLE_KEYS.map((k) => buildLifecycleEmail(input(k, "fr")).text).join("\n");
    expect(all).toMatch(/soumission/);
    expect(all).toMatch(/courriel/);
    expect(all).toMatch(/\bvous\b/i);
    expect(all).not.toMatch(/\btu\b|\bton\b|\bta\b/i);
  });
});

describe("the launch price", () => {
  it("is written only from the offer, never by hand", () => {
    expect(offerLine(ON, "en")).toBe("Founding price: $19 a month, kept for life. 42 spots left.");
    expect(offerLine({ ...ON, remaining: 1 }, "en")).toContain("1 spot left");
    expect(offerLine({ ...ON, launchPriceCents: 2100 }, "en")).toContain("$21");
    expect(offerLine(ON, "fr")).toMatch(/Prix fondateur : 19\s\$ par mois, gardé à vie\. Il reste 42 places\./);
    expect(formatPrice(1900, "fr")).toMatch(/^19\s\$$/);
  });
  it("is absent when the offer is off or unknown", () => {
    expect(offerLine(OFF, "en")).toBeNull();
    expect(offerLine(null, "fr")).toBeNull();
    for (const offer of [OFF, null]) {
      const m = buildLifecycleEmail(input("free_quotes_used", "en", offer));
      expect(m.html).not.toMatch(/\$\s?\d|Founding/);
    }
  });
  it("appears on the free-quotes-used email while the offer is active, with the plan page link", () => {
    const m = buildLifecycleEmail(input("free_quotes_used", "en"));
    expect(m.html).toContain("Founding price: $19 a month, kept for life. 42 spots left.");
    expect(m.html).toContain("https://quoteai.ca/dashboard/billing");
    expect(m.subject).toBe("Your free quotes are used up");
  });
});
