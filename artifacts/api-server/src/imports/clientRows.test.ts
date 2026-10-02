import { describe, expect, it } from "vitest";
import { phoneOk, planClientRows, type ExistingClient } from "./clientRows.js";

const existing: ExistingClient[] = [
  { id: "c1", name: "Dana Whitfield", email: "dana.w@rogers.com", phone: "416-555-0187", dedupKey: "dana whitfield|dana.w@rogers.com|416-555-0187" },
  { id: "c2", name: "Tom & Lena Hart", email: null, phone: "(647) 555-0122", dedupKey: "tom & lena hart||(647) 555-0122" },
];

describe("planClientRows", () => {
  it("adds a clean row, skips one already there and one repeated in the file", () => {
    const p = planClientRows([
      { row: 2, name: "Okoye Condo", phone: "647-555-0199" },
      { row: 3, name: "Dana Whitfield", email: "dana.w@rogers.com", phone: "416-555-0187" },
      { row: 4, name: "Okoye Condo", phone: "647-555-0199" },
    ], existing);
    expect(p.clean.map((r) => r.row)).toEqual([2]);
    expect(p.skipped).toBe(2);
    expect(p.matches).toEqual([]);
  });
  it("flags a different name with the same email or phone as a match to review", () => {
    const p = planClientRows([{ row: 5, name: "Priya Nair", email: "DANA.W@rogers.com" }, { row: 6, name: "T. Hart", phone: "647 555 0122" }], existing);
    expect(p.matches).toEqual([
      { row: 5, name: "Priya Nair", existingId: "c1", existingName: "Dana Whitfield", why: "email" },
      { row: 6, name: "T. Hart", existingId: "c2", existingName: "Tom & Lena Hart", why: "phone" },
    ]);
    expect(p.clean).toEqual([]);
  });
  it("reports a row without a name, a short phone or a bad email", () => {
    const p = planClientRows([{ row: 1, name: " ", email: "a@b.ca" }, { row: 2, name: "Marchetti Bakery", phone: "416-55" }, { row: 3, name: "Gill", email: "gill.example.com" }], existing);
    expect(p.errors).toEqual([{ row: 1, name: "", why: "no_name" }, { row: 2, name: "Marchetti Bakery", why: "short_phone" }, { row: 3, name: "Gill", why: "bad_email" }]);
  });
  it("accepts ten digits or a leading 1", () => {
    expect(phoneOk("416-555-0187")).toBe(true);
    expect(phoneOk("+1 416 555 0187")).toBe(true);
    expect(phoneOk("555-0187")).toBe(false);
    expect(phoneOk(undefined)).toBe(false);
  });
});
