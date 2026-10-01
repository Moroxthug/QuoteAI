// The Change order screen's logic (ChangeOrder.dc.html): the four steps follow where the change order stands on the server, the lines
// are what the contractor and the assistant write, and the totals (tax included) come from the server. Pure, so it is tested.
import type { ChangeOrderRow } from "./jobDetail.ts";

export type Step = "describe" | "review" | "sent" | "signed";
export const STEPS: Step[] = ["describe", "review", "sent", "signed"];

export type Line = { key: string; description: string; qty: number; unit: string; unitPrice: number };

export const round2 = (n: number): number => Math.round(n * 100) / 100;
export const lineTotal = (l: Pick<Line, "qty" | "unitPrice">): number => round2(l.qty * l.unitPrice);
export const subtotal = (lines: Line[]): number => round2(lines.reduce((n, l) => n + lineTotal(l), 0));

/** The change order's step: none yet is Describe; a draft is Review; sent (or declined, voided) is Sent; signed is Signed. */
export function stepOf(co: Pick<ChangeOrderRow, "status"> | null): Step {
  if (!co) return "describe";
  switch (co.status) {
    case "draft": return "review";
    case "signed": return "signed";
    default: return "sent";
  }
}

export function itemsOf(lines: Line[]) {
  return lines.filter((l) => l.description.trim()).map((l) => ({ descrizione: l.description.trim(), um: l.unit, quantita: l.qty, prezzoUnitario: l.unitPrice, totale: lineTotal(l) }));
}

export function linesOf(co: Pick<ChangeOrderRow, "items">): Line[] {
  return co.items.map((i, n) => ({ key: `l${n}`, description: i.descrizione, qty: i.quantita, unit: i.um, unitPrice: i.prezzoUnitario }));
}

/** The lines of an assistant `change_order` proposal; anything unusable is left out. */
export function proposalLines(payload: unknown): { title: string; description: string; days: number; lines: Line[] } | null {
  const p = payload as { title?: unknown; description?: unknown; scheduleDeltaDays?: unknown; items?: unknown } | null;
  if (!p || !Array.isArray(p.items)) return null;
  const lines = (p.items as { descrizione?: unknown; um?: unknown; quantita?: unknown; prezzoUnitario?: unknown }[])
    .filter((i) => typeof i.descrizione === "string" && Number.isFinite(Number(i.prezzoUnitario)))
    .map((i, n): Line => ({ key: `p${n}`, description: String(i.descrizione), qty: Number.isFinite(Number(i.quantita)) ? Number(i.quantita) : 1, unit: typeof i.um === "string" ? i.um : "", unitPrice: Number(i.prezzoUnitario) }));
  if (!lines.length) return null;
  return { title: typeof p.title === "string" ? p.title : "", description: typeof p.description === "string" ? p.description : "", days: Number.isInteger(p.scheduleDeltaDays) ? (p.scheduleDeltaDays as number) : 0, lines };
}

/** The contract before and after this change order is signed. A signed one is already in the job's total, so "before" takes it out. */
export function contractNow(jobTotalCents: number, co: Pick<ChangeOrderRow, "status" | "totalCents">): { now: number; after: number } {
  return co.status === "signed" ? { now: jobTotalCents - co.totalCents, after: jobTotalCents } : { now: jobTotalCents, after: jobTotalCents + co.totalCents };
}

/** A change order needs a title, at least one priced line and a schedule change within what the server allows. */
export function canWrite(title: string, lines: Line[]): boolean {
  return title.trim().length > 0 && itemsOf(lines).length > 0 && lines.every((l) => !l.description.trim() || Number.isFinite(l.unitPrice));
}
