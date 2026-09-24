// Phase 94 — the dashboard's money formatter (artifacts/quote-ai/src/lib/money.ts)
// follows the app's language. It used to be hard-coded to en-CA, so a French
// job page read "$12,345.50", and the chart axes rounded to whole thousands
// ("2k $" for both 1 500 and 2 000).
import { describe, test, expect } from "vitest";
import { formatCad, formatCents, formatCadWhole, formatCadShort, formatAmount, setMoneyLang } from "../../../quote-ai/src/lib/money";

// Intl uses no-break spaces (U+00A0, U+202F) in French; compare on plain spaces.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("money formatting follows the app's language", () => {
  test("English", () => {
    setMoneyLang("en");
    expect(formatCad(12345.5)).toBe("$12,345.50");
    expect(formatCents(1234550)).toBe("$12,345.50");
    expect(formatCadWhole(12345.5)).toBe("$12,346");
    expect(formatAmount(1234.5)).toBe("1,234.50");
  });

  test("French", () => {
    setMoneyLang("fr");
    expect(plain(formatCad(12345.5))).toBe("12 345,50 $");
    expect(plain(formatCents(1234550))).toBe("12 345,50 $");
    expect(plain(formatCadWhole(12345.5))).toBe("12 346 $");
    expect(plain(formatAmount(1234.5))).toBe("1 234,50");
    setMoneyLang("en");
  });

  test("an explicit language wins over the app's", () => {
    setMoneyLang("en");
    expect(plain(formatCad(10, "fr"))).toBe("10,00 $");
  });

  test("axis ticks keep one decimal, so neighbouring ticks never read the same", () => {
    setMoneyLang("en");
    expect(formatCadShort(1500)).toBe("$1.5K");
    expect(formatCadShort(2000)).toBe("$2K");
    expect(formatCadShort(850)).toBe("$850");
    setMoneyLang("fr");
    const ticks = [0, 500, 1000, 1500, 2000, 2500].map((v) => plain(formatCadShort(v)));
    expect(new Set(ticks).size).toBe(ticks.length);
    // ICU builds differ on the space before the symbol ("1,5 k$" on Windows,
    // "1,5 k $" on the Linux runner); the decimal is what this pins.
    expect(ticks[3]).toMatch(/^1,5 k ?\$$/);
    setMoneyLang("en");
  });
});
