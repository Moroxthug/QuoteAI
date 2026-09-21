import { describe, expect, it } from "vitest";
import { withLegalFooter } from "./legalFooter.js";

describe("withLegalFooter", () => {
  it("injects before </body> and is idempotent", () => {
    const html = "<html><body><p>hi</p></body></html>";
    const out = withLegalFooter(html);
    expect(out).toMatch(/<p>hi<\/p><table[^>]*data-quoteai-legal-footer[^>]*>[\s\S]*<\/table><\/body>/);
    expect(out).toContain("support@quoteai.ca");
    expect(withLegalFooter(out)).toBe(out);
  });

  it("appends to a bodiless fragment", () => {
    const out = withLegalFooter("<p>fragment</p>");
    expect(out.startsWith("<p>fragment</p><table")).toBe(true);
  });
});
