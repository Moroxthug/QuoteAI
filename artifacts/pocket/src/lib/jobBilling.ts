// The Invoices tab's billing plan (Job.dc.html): the contract's payment terms, each with the invoice that came from it and where it
// stands, so "Create" shows on a term whose milestone is done and has no invoice yet. Pure, so it is tested without a screen.
import type { JobDetail, JobInvoice } from "./jobDetail.ts";

export type PlanState = "paid" | "late" | "partial" | "sent" | "draft" | "ready" | "open";

export type PlanRow = {
  key: string;
  /** 1-based position among the contract's terms; null for an invoice that isn't one of them (a change order). */
  n: number | null;
  termId: string | null;
  label: string;
  cents: number;
  pct: number | null;
  milestoneId: string | null;
  dueDate: string | null;
  invoice: JobInvoice | null;
  state: PlanState;
};

const live = (i: JobInvoice) => i.status !== "void" && i.type !== "credit_note";

export function stateOfInvoice(i: JobInvoice): PlanState {
  switch (i.status) {
    case "paid": return "paid";
    case "overdue": return "late";
    case "partially_paid": return "partial";
    case "draft": return "draft";
    default: return "sent";
  }
}

/** One row per payment term, then one per invoice that is not tied to a term (change orders, manual ones). */
export function planRows(d: JobDetail): PlanRow[] {
  const terms = d.job.contract?.paymentSchedule.terms ?? [];
  const totalCents = Math.round((d.job.contract?.total ?? 0) * 100);
  const used = new Set<string>();
  const rows: PlanRow[] = terms.map((term, i) => {
    const ms = d.milestones.find((m) => m.paymentTermId === term.id) ?? null;
    const inv = d.invoices.filter(live).find((x) => x.paymentTermId === term.id) ?? null;
    if (inv) used.add(inv.id);
    const cents = ms?.paymentAmountCents ?? (term.amountType === "percent" ? Math.round((totalCents * term.value) / 100) : Math.round(term.value * 100));
    const ready = !inv && !!ms && ms.status === "completed";
    return {
      key: term.id, n: i + 1, termId: term.id, label: term.label, cents, pct: term.amountType === "percent" ? term.value : totalCents > 0 ? Math.round((cents / totalCents) * 100) : null,
      milestoneId: ms?.id ?? null, dueDate: inv?.dueDate ?? null, invoice: inv, state: inv ? stateOfInvoice(inv) : ready ? "ready" : "open",
    };
  });
  for (const inv of d.invoices.filter(live)) {
    if (used.has(inv.id)) continue;
    rows.push({ key: inv.id, n: null, termId: null, label: inv.title || inv.number, cents: inv.totalCents, pct: null, milestoneId: inv.milestoneId, dueDate: inv.dueDate, invoice: inv, state: stateOfInvoice(inv) });
  }
  return rows;
}

export type BillingFigures = {
  invoicedCents: number; invoiceCount: number;
  collectedCents: number; paidCount: number;
  outstandingCents: number; worstLate: { number: string; days: number } | null;
  /** The contract less what has been invoiced (never negative), and how many plan rows are still without an invoice. */
  stillCents: number; termsLeft: number;
};

export function daysLate(dueISO: string, now: Date): number {
  // A due date is a day: read it as the day in the string, not shifted by the phone's time zone.
  const [y, m, d] = dueISO.slice(0, 10).split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y!, m! - 1, d!)) / 86_400_000));
}

export function billingFigures(d: JobDetail, now: Date): BillingFigures {
  const sent = d.invoices.filter((i) => live(i) && i.status !== "draft");
  const late = sent.filter((i) => i.status === "overdue").sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];
  const rows = planRows(d);
  return {
    invoicedCents: d.invoiceTotals.invoicedCents,
    invoiceCount: sent.length,
    collectedCents: d.invoiceTotals.collectedCents,
    paidCount: sent.filter((i) => i.status === "paid").length,
    outstandingCents: d.invoiceTotals.outstandingCents,
    worstLate: late ? { number: late.number, days: daysLate(late.dueDate, now) } : null,
    stillCents: Math.max(0, d.job.totalValueCents - d.invoiceTotals.invoicedCents),
    termsLeft: rows.filter((r) => r.n !== null && (r.state === "open" || r.state === "ready")).length,
  };
}
