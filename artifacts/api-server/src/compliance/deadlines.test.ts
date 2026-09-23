import { describe, expect, test } from "vitest";
import { deadlinesBetween, fiscalYearEndMonth, nextOccurrence, daysUntil } from "./deadlines.js";
import { summarizeWorksheet, dayOf, type WorksheetCost, type WorksheetInvoice } from "./remittance.js";
import { municipalityOf, suggestPermits } from "./catalog.js";

const due = (list: ReturnType<typeof deadlinesBetween>) => list.map((d) => `${d.kind}:${d.periodKey}→${d.dueDate}`);

describe("filing calendar", () => {
  test("nothing configured, nothing derived — no guessed deadlines", () => {
    expect(deadlinesBetween({ province: "ON", settings: {}, hasPstNumber: true }, "2026-01-01", "2026-12-31")).toEqual([]);
  });

  test("monthly GST/HST: one month after the period, month ends respected", () => {
    const list = deadlinesBetween({ province: "ON", settings: { salesTaxFrequency: "monthly" }, hasPstNumber: false }, "2026-02-01", "2026-04-30");
    expect(due(list)).toEqual(["sales_tax:2026-01→2026-02-28", "sales_tax:2026-02→2026-03-31", "sales_tax:2026-03→2026-04-30"]);
    expect(list[0]).toMatchObject({ periodStart: "2026-01-01", periodEnd: "2026-01-31", tax: "GST/HST", authority: "cra" });
  });

  test("quarterly follows the fiscal year, not the calendar", () => {
    const list = deadlinesBetween({ province: "ON", settings: { salesTaxFrequency: "quarterly", fiscalYearEnd: "03-31" }, hasPstNumber: false }, "2026-01-01", "2026-12-31");
    expect(due(list)).toEqual(["sales_tax:Q2025-12→2026-01-31", "sales_tax:Q2026-03→2026-04-30", "sales_tax:Q2026-06→2026-07-31", "sales_tax:Q2026-09→2026-10-31"]);
    expect(list[1]).toMatchObject({ periodStart: "2026-01-01", periodEnd: "2026-03-31" });
  });

  test("Québec files GST and QST together with Revenu Québec", () => {
    const [d] = deadlinesBetween({ province: "QC", settings: { salesTaxFrequency: "quarterly" }, hasPstNumber: false }, "2026-10-01", "2026-10-31");
    expect(d).toMatchObject({ key: "sales_tax:Q2026-09", tax: "GST/QST", authority: "rq", dueDate: "2026-10-31" });
  });

  test("annual: three months after year end for a corporation", () => {
    const list = deadlinesBetween({ province: "ON", settings: { salesTaxFrequency: "annual", fiscalYearEnd: "06-30", structure: "corporation" }, hasPstNumber: false }, "2026-01-01", "2026-12-31");
    expect(due(list)).toEqual(["sales_tax:FY2026→2026-09-30"]);
  });

  test("annual sole proprietor, Dec 31: pay by April 30, file by June 15", () => {
    const list = deadlinesBetween({ province: "BC", settings: { salesTaxFrequency: "annual", structure: "sole_proprietor" }, hasPstNumber: false }, "2027-01-01", "2027-12-31");
    expect(due(list)).toEqual(["sales_tax_payment:FY2026→2027-04-30", "sales_tax:FY2026→2027-06-15"]);
  });

  test("annual filers with instalments: one month after each fiscal quarter", () => {
    const list = deadlinesBetween({ province: "ON", settings: { salesTaxFrequency: "annual", structure: "corporation", instalments: true }, hasPstNumber: false }, "2027-01-01", "2027-12-31");
    expect(due(list).filter((k) => k.startsWith("gst_instalment"))).toEqual(["gst_instalment:I2026-12→2027-01-31", "gst_instalment:I2027-03→2027-04-30", "gst_instalment:I2027-06→2027-07-31", "gst_instalment:I2027-09→2027-10-31"]);
  });

  test("provincial sales tax: BC at month end, SK and MB on the 20th — only when registered", () => {
    const bc = deadlinesBetween({ province: "BC", settings: { pstFrequency: "quarterly" }, hasPstNumber: true }, "2026-10-01", "2026-10-31");
    expect(due(bc)).toEqual(["pst:P2026-09→2026-10-31"]);
    const mb = deadlinesBetween({ province: "MB", settings: { pstFrequency: "monthly" }, hasPstNumber: true }, "2026-10-01", "2026-10-31");
    expect(mb[0]).toMatchObject({ dueDate: "2026-10-20", tax: "RST", authority: "mb" });
    expect(deadlinesBetween({ province: "BC", settings: { pstFrequency: "quarterly" }, hasPstNumber: false }, "2026-10-01", "2026-10-31")).toEqual([]);
    // Ontario has no separate PST to file.
    expect(deadlinesBetween({ province: "ON", settings: { pstFrequency: "quarterly" }, hasPstNumber: true }, "2026-01-01", "2026-12-31")).toEqual([]);
  });

  test("T5018: six months after the calendar year", () => {
    expect(due(deadlinesBetween({ province: "ON", settings: { t5018: true }, hasPstNumber: false }, "2027-01-01", "2027-12-31"))).toEqual(["t5018:2026→2027-06-30"]);
  });

  test("helpers", () => {
    expect(fiscalYearEndMonth("09-30")).toBe(9);
    expect(fiscalYearEndMonth("nonsense")).toBe(12);
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextOccurrence("2026-03-15", "annual")).toBe("2027-03-15");
    expect(nextOccurrence("2026-03-15", "none")).toBeNull();
    expect(daysUntil("2026-09-22", "2026-09-30")).toBe(8);
    expect(daysUntil("2026-09-22", "2026-09-20")).toBe(-2);
  });
});

describe("remittance worksheet", () => {
  const inv = (taxable: number, lines: [string, number][], type = "progress"): WorksheetInvoice => ({ id: String(Math.random()), number: "INV", type, day: "2026-07-10", customer: "", taxableCents: taxable, taxLines: lines.map(([code, amountCents]) => ({ code, amountCents })) });
  const cost = (tax: number, breakdown: WorksheetCost["taxBreakdown"], status: WorksheetCost["status"] = "confirmed"): WorksheetCost => ({ id: String(Math.random()), day: "2026-07-11", vendor: "Home Depot", description: "", status, subtotalCents: 10_000, taxCents: tax, taxBreakdown: breakdown });

  test("collected minus credits, credit notes subtract, PST is not a credit", () => {
    const s = summarizeWorksheet(
      [inv(100_000, [["HST", 13_000]]), inv(-10_000, [["HST", -1_300]], "credit_note")],
      [cost(1_300, { HST: 1_300 }), cost(1_200, { GST: 500, PST: 700 })],
    );
    expect(s.salesCents).toBe(90_000);
    expect(s.gstHst).toEqual({ collectedCents: 11_700, creditsCents: 1_800, netCents: 9_900 });
    expect(s.nonRecoverableCents).toBe(700);
  });

  test("Québec: QST collected and refunded separately", () => {
    const s = summarizeWorksheet([inv(100_000, [["GST", 5_000], ["QST", 9_975]])], [cost(1_498, { GST: 500, QST: 998 })]);
    expect(s.gstHst.netCents).toBe(4_500);
    expect(s.qst).toEqual({ collectedCents: 9_975, creditsCents: 998, netCents: 8_977 });
  });

  test("never guesses: unsplit tax, costs awaiting review and generic tax are warnings, not credits", () => {
    const s = summarizeWorksheet([inv(10_000, [["TAX", 800]])], [cost(1_300, {}), cost(500, { GST: 500 }, "pending_review")]);
    expect(s.gstHst.creditsCents).toBe(0);
    expect(s.warnings).toEqual({ unsplitCostCount: 1, unsplitTaxCents: 1_300, pendingCostCount: 1, pendingTaxCents: 500, genericTaxCents: 800 });
  });

  test("a date-only value is its own day; an instant is read in the province", () => {
    expect(dayOf(new Date("2026-09-30T00:00:00Z"), "BC")).toBe("2026-09-30");
    // 20:00 in Vancouver on the 30th is 03:00 UTC on Oct 1.
    expect(dayOf(new Date("2026-10-01T03:00:00Z"), "BC")).toBe("2026-09-30");
  });
});

describe("permit suggestions", () => {
  test("municipality from a free-text address", () => {
    expect(municipalityOf("12 Elm St, Toronto, ON M4X 1A1")).toBe("Toronto");
    expect(municipalityOf("45 Rue Laurier, Gatineau QC")).toBe("Gatineau");
    expect(municipalityOf("somewhere")).toBe("");
  });

  test("electrical goes to the provincial authority where we know it; building to the municipality", () => {
    const on = suggestPermits(["basement"], "ON", "12 Elm St, Toronto");
    expect(on.map((s) => s.kind)).toEqual(["building", "electrical", "plumbing"]);
    expect(on.find((s) => s.kind === "electrical")!.url).toBe("https://esasafe.com");
    expect(on.find((s) => s.kind === "building")!.authority).toBe("Municipality — Toronto");
    expect(on.find((s) => s.kind === "building")!.url).toContain(encodeURIComponent("building permit Toronto"));
  });
});
