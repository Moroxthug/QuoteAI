import { describe, it, expect, vi } from "vitest";

// The layout builders are pure; the modules around them reach for the database and the mail API,
// which these tests never touch.
vi.mock("../emailConnections/service.js", () => ({ getValidEmailAccessToken: vi.fn(), markEmailSendResult: vi.fn() }));
vi.mock("./emailUtils.js", () => ({
  resendOrThrow: () => ({ emails: { send: vi.fn() } }),
  brandedResend: () => ({ emails: { send: vi.fn() } }),
  sanitizeForFromHeader: (v: string) => v,
}));
vi.mock("./gmailSendClient.js", () => ({ sendGmailMessage: vi.fn() }));

const { shell } = await import("./emailContracts.js");
const { buildQuoteEmailHtml } = await import("./email.js");

describe("client email layout (EmailQuote board)", () => {
  it("draws the company mark and name, the message, the one ink button, and follows night", () => {
    const html = buildQuoteEmailHtml({ lang: "en", companyName: "Rossi Renovations", clientName: "Dana", quoteNumber: "Q-2026-119", totale: "4131.05", publicUrl: "https://quoteai.ca/p/abc", pdf: { filename: "Q-2026-119 Rossi Renovations.pdf", bytes: 188_416 } });
    expect(html).toContain('<span class="mark">RR</span>');
    expect(html).toContain("Rossi Renovations");
    expect(html).toContain("Your quote is ready");
    expect(html).toContain("Hi Dana,");
    expect(html).toContain("$4,131.05");
    expect(html).toContain('href="https://quoteai.ca/p/abc"');
    expect(html).toContain("View &amp; accept online");
    expect(html).toContain("Q-2026-119 Rossi Renovations.pdf");
    expect(html).toContain("PDF · 184 KB");
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain('name="color-scheme" content="light dark"');
    expect(html).toContain("background:#141416");
  });

  it("is in French, with fr-CA money (EmailQuote FR)", () => {
    const html = buildQuoteEmailHtml({ lang: "fr", companyName: "Rossi Rénovations", clientName: "Dana", quoteNumber: "Q-2026-119", totale: "4131.05", publicUrl: "https://quoteai.ca/p/abc" });
    expect(html).toContain('lang="fr-CA"');
    expect(html).toContain("Votre soumission est prête");
    expect(html).toContain("Consulter et accepter en ligne");
    // narrow no-break space before the cents is Intl's; the amount keeps the "$" after the figure
    expect(html.replace(/[  ]/g, " ")).toContain("4 131,05 $");
    expect(html).not.toContain("PDF ·");
  });

  it("escapes the company and client names", () => {
    const html = buildQuoteEmailHtml({ lang: "en", companyName: "A <b>&</b> Co", clientName: "<i>X</i>", quoteNumber: "Q-1", totale: "10.00" });
    expect(html).not.toContain("<b>&</b>");
    expect(html).not.toContain("<i>X</i>");
  });

  it("the shared shell keeps its old signature and shows the QuoteAI logo when no company is given", () => {
    const html = shell({ lang: "en", headerTitle: "Payment reminder", headerSub: "Invoice INV-1", bodyHtml: "<p>x</p>", footer: "f", accent: "linear-gradient(135deg,#000,#fff)" });
    expect(html).toContain("quoteai-logo.png");
    expect(html).toContain("Payment reminder");
    expect(html).not.toContain("linear-gradient");
  });
});
