// Phase 87 — the filing calendar, derived.
//
// Every date here comes from a published rule applied to how the company
// told us it files (business_profiles.compliance_settings) — nothing is
// guessed from data, and a company that has not said how it files gets no
// sales-tax deadlines at all rather than a plausible-looking wrong one.
//
// Rules (CRA "Reporting requirements and deadlines", checked 2026-09-22):
//   · GST/HST monthly or quarterly: due one month after the end of the period.
//   · Annual: three months after the fiscal year end — except an individual
//     with business income and a Dec 31 year end: pay by April 30, file by June 15.
//   · Annual filers whose net tax was $3,000+ pay quarterly instalments, due
//     one month after the end of each fiscal quarter.
//   · Québec: GST and QST are filed together with Revenu Québec, same periods.
//   · BC PST: last day of the month after the period. SK PST and MB RST: the
//     20th of the month after the period.
//   · T5018: six months after the end of the (calendar) reporting year.
//
// Everything is plain `YYYY-MM-DD` strings so the math is timezone-free and
// testable. It prepares and reminds; it does not file.

import type { ComplianceSettings, FilingKind } from "@workspace/db";

export type Authority = "cra" | "rq" | "bc" | "sk" | "mb";

export type Deadline = {
  /** `${kind}:${periodKey}` — stable, matches compliance_filings. */
  key: string;
  kind: FilingKind;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  /** "GST/HST", "GST/QST", "PST", "RST" — or "" for T5018. */
  tax: string;
  authority: Authority;
  frequency: "monthly" | "quarterly" | "semiannual" | "annual";
  /** True when the worksheet (tax collected minus credits) applies to this deadline. */
  hasWorksheet: boolean;
};

export const AUTHORITY_URL: Record<Authority, string> = {
  cra: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/file-gst-hst-return/reporting-requirements-deadlines.html",
  rq: "https://www.revenuquebec.ca/en/",
  bc: "https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst",
  sk: "https://www.saskatchewan.ca/business/taxes-licensing-and-reporting/provincial-taxes-policies-and-bulletins/provincial-sales-tax",
  mb: "https://www.gov.mb.ca/finance/taxation/taxes/retail.html",
};
export const T5018_URL = "https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/t5018.html";

// ── Tiny date-only helpers ───────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
/** Last day of month `m` (1-12) in year `y`. */
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Normalises (y, m) where m may be outside 1-12. */
function ym(y: number, m: number): [number, number] {
  const idx = y * 12 + (m - 1);
  return [Math.floor(idx / 12), (idx % 12) + 1];
}
const monthEnd = (y: number, m: number) => {
  const [yy, mm] = ym(y, m);
  return `${yy}-${pad(mm)}-${pad(lastDay(yy, mm))}`;
};
const monthStart = (y: number, m: number) => {
  const [yy, mm] = ym(y, m);
  return `${yy}-${pad(mm)}-01`;
};
const dayOfMonth = (y: number, m: number, d: number) => {
  const [yy, mm] = ym(y, m);
  return `${yy}-${pad(mm)}-${pad(Math.min(d, lastDay(yy, mm)))}`;
};

/** The fiscal year end's month (1-12). Year ends are taken as month ends; anything unparseable is December. */
export function fiscalYearEndMonth(fye: string | null | undefined): number {
  const m = /^(\d{2})-(\d{2})$/.exec(fye ?? "");
  const month = m ? Number(m[1]) : 12;
  return month >= 1 && month <= 12 ? month : 12;
}

type Period = { key: string; start: string; end: string; endY: number; endM: number };

/** Periods of `months` length whose end months are aligned to `anchorMonth`, ending between the two years given. */
function periods(months: 1 | 3 | 6 | 12, anchorMonth: number, fromYear: number, toYear: number, keyOf: (endY: number, endM: number) => string): Period[] {
  const out: Period[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      if (((m - anchorMonth) % months + 12) % 12 !== 0 && months !== 1) continue;
      out.push({ key: keyOf(y, m), start: monthStart(y, m - months + 1), end: monthEnd(y, m), endY: y, endM: m });
    }
  }
  return out;
}

export type DeadlineInputs = {
  province: string | null | undefined;
  settings: ComplianceSettings;
  /** Registered for PST/RST (a number on file). */
  hasPstNumber: boolean;
};

/** Every deadline whose due date falls in [from, to] (inclusive, `YYYY-MM-DD`). */
export function deadlinesBetween(input: DeadlineInputs, from: string, to: string): Deadline[] {
  const s = input.settings ?? {};
  const province = (input.province ?? "").toUpperCase();
  const fromYear = Number(from.slice(0, 4)) - 2;
  const toYear = Number(to.slice(0, 4)) + 1;
  const out: Deadline[] = [];
  const push = (d: Omit<Deadline, "key">) => {
    if (d.dueDate >= from && d.dueDate <= to) out.push({ ...d, key: `${d.kind}:${d.periodKey}` });
  };

  // ── GST/HST (GST/QST in Québec) ────────────────────────────────────────────
  const freq = s.salesTaxFrequency;
  if (freq) {
    const qc = province === "QC";
    const tax = qc ? "GST/QST" : "GST/HST";
    const authority: Authority = qc ? "rq" : "cra";
    const fyeM = fiscalYearEndMonth(s.fiscalYearEnd);
    if (freq === "monthly") {
      for (const p of periods(1, 1, fromYear, toYear, (y, m) => `${y}-${pad(m)}`)) {
        push({ kind: "sales_tax", periodKey: p.key, periodStart: p.start, periodEnd: p.end, dueDate: monthEnd(p.endY, p.endM + 1), tax, authority, frequency: "monthly", hasWorksheet: true });
      }
    } else if (freq === "quarterly") {
      for (const p of periods(3, fyeM, fromYear, toYear, (y, m) => `Q${y}-${pad(m)}`)) {
        push({ kind: "sales_tax", periodKey: p.key, periodStart: p.start, periodEnd: p.end, dueDate: monthEnd(p.endY, p.endM + 1), tax, authority, frequency: "quarterly", hasWorksheet: true });
      }
    } else {
      for (const p of periods(12, fyeM, fromYear, toYear, (y) => `FY${y}`)) {
        const base = { periodKey: p.key, periodStart: p.start, periodEnd: p.end, tax, authority, frequency: "annual" as const };
        if (s.structure === "sole_proprietor" && fyeM === 12) {
          push({ ...base, kind: "sales_tax_payment", dueDate: `${p.endY + 1}-04-30`, hasWorksheet: true });
          push({ ...base, kind: "sales_tax", dueDate: `${p.endY + 1}-06-15`, hasWorksheet: true });
        } else {
          push({ ...base, kind: "sales_tax", dueDate: monthEnd(p.endY, p.endM + 3), hasWorksheet: true });
        }
        if (s.instalments) {
          // Four instalments inside the *next* fiscal year, one month after each of its quarters.
          for (let q = 1; q <= 4; q++) {
            const [qy, qm] = ym(p.endY, p.endM + q * 3);
            push({ kind: "gst_instalment", periodKey: `I${qy}-${pad(qm)}`, periodStart: monthStart(qy, qm - 2), periodEnd: monthEnd(qy, qm), dueDate: monthEnd(qy, qm + 1), tax, authority, frequency: "quarterly", hasWorksheet: false });
          }
        }
      }
    }
  }

  // ── Provincial sales tax (BC, SK, MB) — calendar periods ───────────────────
  const pstFreq = s.pstFrequency;
  if (pstFreq && input.hasPstNumber && (province === "BC" || province === "SK" || province === "MB")) {
    const months = pstFreq === "monthly" ? 1 : pstFreq === "quarterly" ? 3 : pstFreq === "semiannual" ? 6 : 12;
    const authority = province.toLowerCase() as Authority;
    for (const p of periods(months as 1 | 3 | 6 | 12, 12, fromYear, toYear, (y, m) => `P${y}-${pad(m)}`)) {
      const due = province === "BC" ? monthEnd(p.endY, p.endM + 1) : dayOfMonth(p.endY, p.endM + 1, 20);
      push({ kind: "pst", periodKey: p.key, periodStart: p.start, periodEnd: p.end, dueDate: due, tax: province === "MB" ? "RST" : "PST", authority, frequency: pstFreq, hasWorksheet: true });
    }
  }

  // ── T5018 (contract payments to subcontractors), calendar year ─────────────
  if (s.t5018) {
    for (let y = fromYear; y <= toYear; y++) {
      push({ kind: "t5018", periodKey: String(y), periodStart: `${y}-01-01`, periodEnd: `${y}-12-31`, dueDate: `${y + 1}-06-30`, tax: "", authority: "cra", frequency: "annual", hasWorksheet: false });
    }
  }

  return out.sort((a, b) => (a.dueDate === b.dueDate ? a.key.localeCompare(b.key) : a.dueDate < b.dueDate ? -1 : 1));
}

/** The next occurrence of a recurring reminder after it is done. */
export function nextOccurrence(due: string, recurrence: "none" | "monthly" | "quarterly" | "annual"): string | null {
  if (recurrence === "none") return null;
  const y = Number(due.slice(0, 4));
  const m = Number(due.slice(5, 7));
  const d = Number(due.slice(8, 10));
  const step = recurrence === "monthly" ? 1 : recurrence === "quarterly" ? 3 : 12;
  return dayOfMonth(y, m + step, d);
}

/** Whole days from `today` to `due` (negative when late). */
export function daysUntil(today: string, due: string): number {
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
