import { describe, expect, test } from "vitest";
import { businessNumber9, matchGroupCompany, normalizeCompanyName, type GroupCompanyKey } from "./intercompany.js";

const companies: GroupCompanyKey[] = [
  { orgId: "a", name: "Nord Reno Inc.", email: "office@nordreno.ca", businessNumber: "111222333RT0001" },
  { orgId: "b", name: "Rénovations Nord Ltée", email: "info@renonord.qc.ca", businessNumber: "444 555 666 RT 0001" },
  { orgId: "c", name: "Co", email: null, businessNumber: null },
];

describe("normalizeCompanyName", () => {
  test("drops accents, punctuation and trailing legal suffixes", () => {
    expect(normalizeCompanyName("Rénovations Nord Ltée")).toBe("renovations nord");
    expect(normalizeCompanyName("NORD RENO, INC.")).toBe("nord reno");
    expect(normalizeCompanyName("Smith & Sons Co. Ltd")).toBe("smith and sons");
  });
  test("keeps a name that is only a suffix", () => {
    expect(normalizeCompanyName("Co")).toBe("co");
    expect(normalizeCompanyName(null)).toBe("");
  });
});

describe("businessNumber9", () => {
  test("reads the 9-digit BN from any registration format", () => {
    expect(businessNumber9("444 555 666 RT0001")).toBe("444555666");
    expect(businessNumber9("1234567890TQ0001")).toBe("123456789");
    expect(businessNumber9("12345")).toBeNull();
  });
});

describe("matchGroupCompany", () => {
  test("business number first, then email, then name", () => {
    expect(matchGroupCompany({ name: "Someone", gstHstNumber: "444555666RT0001" }, companies, "a")).toBe("b");
    expect(matchGroupCompany({ name: "Someone", email: "OFFICE@nordreno.ca" }, companies, "b")).toBe("a");
    expect(matchGroupCompany({ name: "Nord Reno Incorporated" }, companies, "b")).toBe("a");
  });
  test("never matches the company itself, an outsider or a too-short name", () => {
    expect(matchGroupCompany({ name: "Nord Reno Inc." }, companies, "a")).toBeNull();
    expect(matchGroupCompany({ name: "Outside Client", email: "x@y.ca" }, companies, "a")).toBeNull();
    expect(matchGroupCompany({ name: "Co" }, companies, "a")).toBeNull();
  });
});
