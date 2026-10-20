import { describe, expect, it } from "vitest";
import { centsToDecimal, csvField, toCsv } from "./csv";

describe("csv", () => {
  it("cents to dollars", () => {
    expect(centsToDecimal(2147)).toBe("21.47");
    expect(centsToDecimal(5)).toBe("0.05");
    expect(centsToDecimal(-1999)).toBe("-19.99");
    expect(centsToDecimal(0)).toBe("0.00");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvField('Smith, "Bob"\nCo')).toBe('"Smith, ""Bob""\nCo"');
    expect(csvField(null)).toBe("");
  });
  it("defuses spreadsheet formulas in text", () => {
    expect(csvField("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvField("+1 555")).toBe("'+1 555");
    expect(csvField("@sum")).toBe("'@sum");
  });
  it("negative numbers stay numbers", () => {
    expect(toCsv(["a", "b"], [["x", { n: -5 }], ["-dash", 3]])).toBe("a,b\r\nx,-5\r\n'-dash,3\r\n");
  });
});
