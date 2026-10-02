// Pocket 127.7 (Documents): what the receipts and supplier invoices the AI has read say about prices. Pure, so they are tested
// (documents.test.ts); routes/documents.ts reads the rows. Built on the price series of materials/suppliers.ts.
import { normVendor, priceHistory, priceSeries, sameItem, type PriceRow, type ReceiptLines } from "./suppliers.js";

export type CostLines = { vendor: string; date: Date; lines: ReceiptLines["lines"] };
type Series = ReturnType<typeof priceSeries>;

/** The item whose price moved most in the last six months, or null when nothing has moved. */
export function topMover(series: Series, now: Date): PriceRow | null {
  const [first] = priceHistory(series, now, 6, 1);
  return first && first.when ? first : null;
}

/** The newest price each store charged for the item (newest sale first), at most `limit`. */
export function storePrices(costs: CostLines[], itemName: string, limit = 3): { name: string; at: string; price: number }[] {
  const best = new Map<string, { name: string; at: string; price: number }>();
  for (const c of [...costs].sort((a, b) => b.date.getTime() - a.date.getTime())) {
    const key = normVendor(c.vendor);
    if (!key || best.has(key)) continue;
    const line = c.lines.find((l) => l.unitPrice != null && l.unitPrice > 0 && sameItem(l.description ?? "", itemName));
    if (line) best.set(key, { name: c.vendor.trim(), at: c.date.toISOString().slice(0, 10), price: line.unitPrice! });
  }
  return [...best.values()].slice(0, limit);
}

/** The item that has 2 of the 3 prices needed to follow it (so "one more invoice and it is tracked"), the one seen most recently first. */
export function almostReady(series: Series, need = 3): { name: string; have: number; need: number } | null {
  const near = series.filter((s) => s.points.length >= 2 && s.points.length < need);
  near.sort((a, b) => b.points.length - a.points.length || b.points[b.points.length - 1]!.at.localeCompare(a.points[a.points.length - 1]!.at));
  const s = near[0];
  return s ? { name: s.name, have: s.points.length, need } : null;
}

type Extracted = { lines?: { description?: string; unitPrice?: number | null }[]; lavorazioni?: { tipo?: string; prezzoUnitario?: number }[]; vendor?: string | null; fornitore?: string | null; confidence?: string } | null;

/** What a document says: the store, how many prices were read and how many lines could not be (a receipt line with no unit price). */
export function readOf(extracted: unknown): { vendor: string | null; prices: number; unread: number; names: string[] } {
  const e = (extracted ?? null) as Extracted;
  if (!e) return { vendor: null, prices: 0, unread: 0, names: [] };
  const vendor = (e.vendor ?? e.fornitore ?? null)?.toString().trim() || null;
  if (Array.isArray(e.lavorazioni)) {
    const items = e.lavorazioni.filter((l) => typeof l.prezzoUnitario === "number");
    return { vendor, prices: items.length, unread: 0, names: items.map((l) => l.tipo ?? "") };
  }
  const lines = Array.isArray(e.lines) ? e.lines.filter((l) => (l.description ?? "").trim()) : [];
  const priced = lines.filter((l) => typeof l.unitPrice === "number" && l.unitPrice > 0);
  return { vendor, prices: priced.length, unread: lines.length - priced.length, names: priced.map((l) => l.description ?? "") };
}

export type DocState = "read" | "reading" | "check";

/** Reading while it waits or is being read; Check when it failed or some lines could not be read; Read otherwise. */
export function docState(status: string, unread: number): DocState {
  if (status === "pending" || status === "processing") return "reading";
  if (status === "error" || unread > 0) return "check";
  return "read";
}

/** How many of a document's items are among the items whose price moved. */
export function changedIn(names: string[], moved: string[]): number {
  return names.filter((n) => n && moved.some((m) => sameItem(n, m))).length;
}
