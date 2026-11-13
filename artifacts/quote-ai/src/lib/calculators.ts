// The arithmetic behind the free calculators (/tools, /fr/outils). Pure
// functions, no React, so calculators.test.ts can pin every number the pages
// show. Tax rates come from TAX_PROFILES, the same table the quote, contract
// and invoice PDFs use.
import { TAX_PROFILES, type ProvinceCode, type TaxComponent } from "./tax-profiles";

/** Round to the cent, half away from zero (what a printed invoice does). */
export function round2(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON) / 100;
}

/**
 * Reads what a person typed into a money or percent box: "1,250.50" in
 * English, "1 250,50" in French, "$1250", "12 %". Returns null when nothing
 * usable is there.
 */
export function parseAmount(raw: string, lang: "en" | "fr"): number | null {
  let s = raw.replace(/[\s  $%]/g, "");
  // French: a comma is the decimal mark; without one, a dot is ("12.5" stays 12.5).
  if (lang === "fr") s = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  else s = s.replace(/,/g, "");
  if (s === "" || s === "." || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface TaxLine {
  code: TaxComponent["code"];
  rate: number;
  amount: number;
}

export interface SalesTaxResult {
  subtotal: number;
  lines: TaxLine[];
  tax: number;
  total: number;
}

/**
 * Sales tax for a province. "add" treats the amount as the price before tax;
 * "extract" treats it as a tax-included total and works back to the price.
 * Each tax is its own line (QST is charged on the price, not on price + GST).
 */
export function salesTax(amount: number, province: ProvinceCode, mode: "add" | "extract"): SalesTaxResult {
  const profile = TAX_PROFILES[province];
  if (mode === "add") {
    const subtotal = round2(amount);
    const lines = profile.components.map((c) => ({ code: c.code, rate: c.rate, amount: round2((subtotal * c.rate) / 100) }));
    const tax = round2(lines.reduce((s, l) => s + l.amount, 0));
    return { subtotal, lines, tax, total: round2(subtotal + tax) };
  }
  const total = round2(amount);
  const subtotal = round2(total / (1 + profile.totalRate / 100));
  const tax = round2(total - subtotal);
  // Split the tax across the lines by rate; the last line takes the rounding
  // cent so the lines always add up to the total.
  const lines: TaxLine[] = [];
  let assigned = 0;
  profile.components.forEach((c, i) => {
    const last = i === profile.components.length - 1;
    const share = last ? round2(tax - assigned) : round2((subtotal * c.rate) / 100);
    assigned = round2(assigned + share);
    lines.push({ code: c.code, rate: c.rate, amount: share });
  });
  return { subtotal, lines, tax, total };
}

export interface HoldbackResult {
  billed: number;
  holdback: number;
  net: number;
  taxNow: number;
  payableNow: number;
  taxOnRelease: number;
  releaseTotal: number;
}

/**
 * One progress invoice with a holdback kept back. Following the Excise Tax
 * Act's holdback rule, GST/HST on the holdback is charged when the holdback is
 * paid, so this invoice taxes only the part paid now.
 */
export function holdback(billed: number, holdbackPct: number, taxRatePct: number): HoldbackResult {
  const b = round2(billed);
  const h = round2((b * holdbackPct) / 100);
  const net = round2(b - h);
  const taxNow = round2((net * taxRatePct) / 100);
  const taxOnRelease = round2((h * taxRatePct) / 100);
  return { billed: b, holdback: h, net, taxNow, payableNow: round2(net + taxNow), taxOnRelease, releaseTotal: round2(h + taxOnRelease) };
}

export interface PricingResult {
  cost: number;
  price: number;
  profit: number;
  /** Profit as a percent of cost. */
  markupPct: number;
  /** Profit as a percent of the selling price. */
  marginPct: number;
}

/** Price from a cost and either a markup (% of cost) or a margin (% of price). Null when a margin of 100 % or more is asked for. */
export function priceFrom(cost: number, pct: number, mode: "markup" | "margin"): PricingResult | null {
  if (mode === "margin" && pct >= 100) return null;
  const price = mode === "markup" ? cost * (1 + pct / 100) : cost / (1 - pct / 100);
  const profit = price - cost;
  return {
    cost: round2(cost),
    price: round2(price),
    profit: round2(profit),
    markupPct: cost > 0 ? (profit / cost) * 100 : 0,
    marginPct: price > 0 ? (profit / price) * 100 : 0,
  };
}

/** The margin a markup gives: 25 % markup → 20 % margin. */
export const marginFromMarkup = (markupPct: number) => (markupPct / (100 + markupPct)) * 100;
/** The markup a margin needs: 20 % margin → 25 % markup. */
export const markupFromMargin = (marginPct: number) => (marginPct >= 100 ? Infinity : (marginPct / (100 - marginPct)) * 100);

export interface LabourRateInput {
  /** What the owner wants to pay themselves in a year, before personal income tax. */
  salary: number;
  /** Yearly business costs not billed to a job: truck, insurance, tools, phone, software, accounting. */
  overhead: number;
  /** Hours a week actually billed to customers. */
  hoursPerWeek: number;
  /** Weeks worked in a year. */
  weeks: number;
  /** Profit on top, as a percent of the hourly rate. */
  marginPct: number;
}

export interface LabourRateResult {
  billableHours: number;
  breakEven: number;
  rate: number;
  yearlyRevenue: number;
}

/** Null when there are no billable hours or the margin is 100 % or more. */
export function labourRate(i: LabourRateInput): LabourRateResult | null {
  const billableHours = i.hoursPerWeek * i.weeks;
  if (billableHours <= 0 || i.marginPct >= 100) return null;
  const breakEven = (i.salary + i.overhead) / billableHours;
  const rate = breakEven / (1 - i.marginPct / 100);
  return { billableHours, breakEven: round2(breakEven), rate: round2(rate), yearlyRevenue: round2(rate * billableHours) };
}
