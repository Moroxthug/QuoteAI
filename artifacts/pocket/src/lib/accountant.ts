// AccountantView.dc.html: what the company's accountant sees (read-only): a month of books and how finished each part is, the files they can
// download, the sales tax and the next deadlines, and the thread of comments. Pure, so the rules are tested (accountant.test.ts).
// The server's shapes (routes/accountant.ts) are typed here.
import type { OrgDto } from "./api";

export type AccountantOverview =
  | { enabled: false; requiredPlan?: string }
  | {
    enabled: true; today: string;
    company: { name: string; ownerName: string };
    you: { name: string; role: string };
    fiscalYearEnd: string | null; province: string | null;
    month: string;
    months: { month: string; closed: { at: string; by: string | null } | null }[];
    bank: { total: number; matched: number } | null;
    receipts: { total: number; attached: number };
    invoices: { total: number; issued: number; issuedCents: number };
    payroll: { periods: { start: string; end: string; exported: boolean }[] } | null;
  };

export type CommentDto = { id: string; month: string; authorName: string; authorRole: string; body: string; at: string; mine: boolean };

// ── The month's four parts ──────────────────────────────────────────────────

export type CheckKey = "bank" | "receipts" | "invoices" | "payroll";
export type Check = { key: CheckKey; done: number; total: number; pct: number; complete: boolean; cents?: number; periods?: { start: string; end: string }[]; drafts?: number };

const pct = (a: number, b: number): number => (b <= 0 ? 100 : Math.round((a / b) * 100));

/** The parts that apply to this company this month, with nothing listed that has nothing in it (no bank line, no purchase, no invoice). */
export function checks(ov: Extract<AccountantOverview, { enabled: true }>): Check[] {
  const out: Check[] = [];
  if (ov.bank && ov.bank.total > 0) out.push({ key: "bank", done: ov.bank.matched, total: ov.bank.total, pct: pct(ov.bank.matched, ov.bank.total), complete: ov.bank.matched >= ov.bank.total });
  if (ov.receipts.total > 0) out.push({ key: "receipts", done: ov.receipts.attached, total: ov.receipts.total, pct: pct(ov.receipts.attached, ov.receipts.total), complete: ov.receipts.attached >= ov.receipts.total });
  if (ov.invoices.total > 0) {
    const i = ov.invoices;
    out.push({ key: "invoices", done: i.issued, total: i.total, pct: pct(i.issued, i.total), complete: i.issued >= i.total, cents: i.issuedCents, drafts: i.total - i.issued });
  }
  if (ov.payroll && ov.payroll.periods.length > 0) {
    const p = ov.payroll.periods;
    const done = p.filter((x) => x.exported).length;
    out.push({ key: "payroll", done, total: p.length, pct: pct(done, p.length), complete: done >= p.length, periods: p.map((x) => ({ start: x.start, end: x.end })) });
  }
  return out;
}

export type MonthState = "closed" | "inProgress";
export const monthState = (m: { closed: unknown } | undefined): MonthState => (m?.closed ? "closed" : "inProgress");

export const monthDate = (month: string): Date => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1, 12);
};

/** The date text in a server instant, as a date at noon on the phone's clock. */
export const instantDate = (iso: string): Date => new Date(iso);

// ── The files ───────────────────────────────────────────────────────────────

export type ExportKey = "transactions" | "tax" | "payroll";
export type ExportDef = { key: ExportKey; path: string; fallback: string };

/** The files for a month. The tax worksheet is the one a return is made from (its period is the month); payroll only when the company runs it. */
export function exportsFor(month: string, hasPayroll: boolean, monthEnd: string): ExportDef[] {
  const first = `${month}-01`;
  const list: ExportDef[] = [
    { key: "transactions", path: `/api/accountant/export.csv?kind=transactions&month=${encodeURIComponent(month)}`, fallback: `transactions-${month}.csv` },
    { key: "tax", path: `/api/compliance/remittance.csv?from=${encodeURIComponent(first)}&to=${encodeURIComponent(monthEnd)}`, fallback: `sales-tax-worksheet-${month}.csv` },
  ];
  if (hasPayroll) list.push({ key: "payroll", path: `/api/accountant/export.csv?kind=payroll&month=${encodeURIComponent(month)}`, fallback: `payroll-summary-${month}.csv` });
  return list;
}

/** The last day of a `YYYY-MM` month. */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// ── Access ──────────────────────────────────────────────────────────────────

/** The company this phone last opened is no longer in the person's list: the owner turned the access off. */
export function accessEnded(current: Pick<OrgDto, "orgId">[], storedOrgId: string | null, known: { orgId: string; companyName: string; role: string }[]): { ended: boolean; company: string } {
  if (!storedOrgId || current.some((o) => o.orgId === storedOrgId)) return { ended: false, company: "" };
  const was = known.find((k) => k.orgId === storedOrgId);
  return was && was.role === "accountant" ? { ended: true, company: was.companyName } : { ended: false, company: "" };
}

/** The company's initials for the square next to its name ("Rossi Renovations" → "RR"). */
export function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

// ── Comments ────────────────────────────────────────────────────────────────

export const COMMENT_MAX = 2000;
export const canSend = (draft: string): boolean => draft.trim().length > 0 && draft.trim().length <= COMMENT_MAX;
