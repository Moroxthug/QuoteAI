// Phase 71 — the quote tax split and French/English presentation.
import { describe, it, expect } from "vitest";
import { quoteTaxLines, splitTaxRate } from "@workspace/db";
import { fmtMoney, fmtRate, quoteTaxLinesFor, resolveQuoteLanguage } from "./i18n.js";

/** fr-CA groups digits with U+202F / U+00A0 (no-break spaces); compare on plain spaces. */
const plain = (s: string) => s.replace(new RegExp(`[${String.fromCharCode(0xa0)}${String.fromCharCode(0x202f)}]`, "g"), " ");

describe("splitTaxRate", () => {
  it("maps a province's statutory total to its components", () => {
    expect(splitTaxRate(14.975, "QC").map((c) => c.code)).toEqual(["GST", "QST"]);
    expect(splitTaxRate(12, "BC").map((c) => c.code)).toEqual(["GST", "PST"]);
    expect(splitTaxRate(13, "ON").map((c) => c.code)).toEqual(["HST"]);
  });
  it("tolerates the old 2-decimal storage of the Québec rate", () => {
    expect(splitTaxRate(14.98, "QC").map((c) => c.code)).toEqual(["GST", "QST"]);
  });
  it("is tax-exempt at 0 and generic for an unknown rate", () => {
    expect(splitTaxRate(0, "QC")).toEqual([]);
    expect(splitTaxRate(7, "ON")).toEqual([{ code: "TAX", label: "Tax", rate: 7 }]);
  });
  it("recognises another province's single-component total without a province", () => {
    expect(splitTaxRate(13, null).map((c) => c.code)).toEqual(["HST"]);
  });
});

describe("quoteTaxLines", () => {
  it("component amounts sum exactly to the stored tax total", () => {
    // $1 234.56 taxable in Québec: 5 % = 61.728 → 61.73, 9.975 % = 123.147 → 123.15; stored total 184.87
    const lines = quoteTaxLines(1234.56, 14.975, 184.87, "QC");
    expect(lines.map((l) => [l.code, l.amount])).toEqual([["GST", 61.73], ["QST", 123.14]]);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(184.87, 2);
  });
  it("uses the discounted subtotal as the taxable base", () => {
    const lines = quoteTaxLinesFor({ subtotale: "1000", ivaPercentuale: "13", ivaValore: "117", sconto: { importoScontato: 900 } }, "ON", "en");
    expect(lines).toEqual([{ code: "HST", label: "HST", rate: 13, amount: 117, display: "HST 13%" }]);
  });
  it("labels in French with TPS/TVQ and a French percent", () => {
    const lines = quoteTaxLinesFor({ subtotale: "100", ivaPercentuale: "14.975", ivaValore: "14.98" }, "QC", "fr");
    expect(lines.map((l) => plain(l.display))).toEqual(["TPS 5 %", "TVQ 9,975 %"]);
  });
  it("shows one generic line for a hand-entered rate", () => {
    const [line] = quoteTaxLinesFor({ subtotale: "100", ivaPercentuale: "7", ivaValore: "7" }, "ON", "en");
    expect(line.display).toBe("TAX (7%)");
  });
});

describe("presentation", () => {
  it("formats money per locale", () => {
    expect(fmtMoney(1234.5, "en")).toBe("$ 1,234.50");
    // fr-CA groups with U+202F (narrow no-break space); compare on plain spaces.
    expect(plain(fmtMoney(1234.5, "fr"))).toBe("1 234,50 $");
    expect(plain(fmtRate(9.975, "fr"))).toBe("9,975 %");
  });
  it("picks the document language: client preference, else French in Québec", () => {
    expect(resolveQuoteLanguage({ clientLanguage: "en", province: "QC" })).toBe("en");
    expect(resolveQuoteLanguage({ clientLanguage: null, province: "QC" })).toBe("fr");
    expect(resolveQuoteLanguage({ clientLanguage: null, province: "ON" })).toBe("en");
    expect(resolveQuoteLanguage({ clientLanguage: "fr", province: "BC" })).toBe("fr");
  });
});
