import { describe, expect, it } from "vitest";
import { escapeHtml, pickLang, unsubscribeDonePage, unsubscribeMessagePage } from "./unsubscribePage.js";

describe("unsubscribe page", () => {
  it("says what stopped, shows the company, and keeps the invoices note (EN)", () => {
    const html = unsubscribeDonePage({ lang: "en", kind: "reminders", company: "Rossi Renovations" });
    expect(html).toContain("No more reminders by email");
    expect(html).toContain("Rossi Renovations");
    expect(html).toContain("Invoices still arrive.");
    expect(html).toContain("Unsubscribed");
    expect(html).toContain("prefers-color-scheme:dark");
    expect(html).toContain('lang="en-CA"');
  });

  it("is in French when asked (FR)", () => {
    const html = unsubscribeDonePage({ lang: "fr", kind: "marketing" });
    expect(html).toContain("Plus de demandes d&#39;avis ni de photos par courriel");
    expect(html).toContain("Les factures arrivent toujours.");
    expect(html).toContain('lang="fr-CA"');
    expect(html).not.toContain("<header>");
  });

  it("escapes the company name", () => {
    const html = unsubscribeDonePage({ lang: "en", kind: "followups", company: '<script>alert(1)</script> & "Co"' });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("has a plain refusal page for a stale link", () => {
    expect(unsubscribeMessagePage("en", "invalid")).toContain("This unsubscribe link is no longer valid.");
    expect(unsubscribeMessagePage("fr", "invalid")).toContain("n&#39;est plus valide");
  });

  it("prefers the saved language, then the browser's", () => {
    const req = (accepts: string | false) => ({ acceptsLanguages: () => accepts }) as never;
    expect(pickLang(req("en"), "fr")).toBe("fr");
    expect(pickLang(req("fr"))).toBe("fr");
    expect(pickLang(req(false))).toBe("en");
  });
});
