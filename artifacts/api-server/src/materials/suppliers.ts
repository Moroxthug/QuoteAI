// Pocket 127.6 (Suppliers, Supplier, Inventory): which receipts belong to a supplier, how an item's price has moved at a supplier, and what is
// running low. Pure, so they are tested (suppliers.test.ts); routes/suppliers.ts and routes/inventory.ts read the rows.

/** A vendor's name without the store number or punctuation: "Home Depot #7011" becomes "home depot". */
export function normVendor(s: string): string {
  return s.toLowerCase().replace(/#\s*\d+/g, " ").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** A receipt's vendor belongs to this supplier: the same name, or one holds the other ("Home Depot" in "Home Depot Pro"). */
export function vendorMatches(vendor: string, supplierName: string): boolean {
  const a = normVendor(vendor);
  const b = normVendor(supplierName);
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && ` ${long} `.includes(` ${short} `);
}

/** An item's name as receipts and the stock list spell it, to compare them: `Drywall 1/2" 4×8` and `drywall 1/2 4x8` are the same. */
export function itemNorm(s: string): string {
  return s.toLowerCase().replace(/×/g, "x").replace(/["”“]/g, "").replace(/[^a-z0-9/.]+/g, " ").trim();
}

export function sameItem(a: string, b: string): boolean {
  const x = itemNorm(a);
  const y = itemNorm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 6 && ` ${long} `.includes(` ${short} `);
}

export type Point = { at: string; price: number };
export type ReceiptLines = { at: Date; lines: { description: string; unitPrice: number | null }[] };

/** Every price a receipt shows for an item, oldest first (two on one day keep the later one). Lines without a price are skipped. */
export function priceSeries(receipts: ReceiptLines[]): { name: string; points: Point[] }[] {
  const sorted = [...receipts].sort((a, b) => a.at.getTime() - b.at.getTime());
  const out: { name: string; points: Point[] }[] = [];
  for (const r of sorted) {
    const day = r.at.toISOString().slice(0, 10);
    for (const l of r.lines) {
      const price = l.unitPrice;
      if (!l.description?.trim() || price == null || !Number.isFinite(price) || price <= 0) continue;
      let s = out.find((x) => sameItem(x.name, l.description));
      if (!s) { s = { name: l.description.trim(), points: [] }; out.push(s); }
      const last = s.points[s.points.length - 1];
      if (last && last.at === day) last.price = price;
      else s.points.push({ at: day, price });
    }
  }
  return out;
}

export type PriceRow = { name: string; from: number; to: number; changePct: number; when: string | null; points: number[] };

/** The board's price history: items with at least two prices in the last `months`; those that moved first (the biggest move first), then the steady ones. */
export function priceHistory(series: { name: string; points: Point[] }[], now: Date, months = 6, limit = 6): PriceRow[] {
  const cut = new Date(now);
  cut.setUTCMonth(cut.getUTCMonth() - months);
  const since = cut.toISOString().slice(0, 10);
  const rows: PriceRow[] = [];
  for (const s of series) {
    const pts = s.points.filter((p) => p.at >= since);
    if (pts.length < 2) continue;
    const from = pts[0]!.price;
    const to = pts[pts.length - 1]!.price;
    let when: string | null = null;
    for (let i = pts.length - 1; i > 0; i--) if (pts[i]!.price !== pts[i - 1]!.price) { when = pts[i]!.at; break; }
    rows.push({ name: s.name, from, to, changePct: ((to - from) / from) * 100, when, points: pts.slice(-6).map((p) => p.price) });
  }
  rows.sort((a, b) => Number(b.when !== null) - Number(a.when !== null) || Math.abs(b.changePct) - Math.abs(a.changePct) || a.name.localeCompare(b.name));
  return rows.slice(0, limit);
}

/** The newest price a receipt shows for the item, and the one before it (to say "up 8 %"). */
export function latestPrice(series: { name: string; points: Point[] }[], itemName: string): { price: number; before: number | null; at: string } | null {
  const s = series.find((x) => sameItem(x.name, itemName));
  if (!s || !s.points.length) return null;
  const last = s.points[s.points.length - 1]!;
  const prev = s.points.length > 1 ? s.points[s.points.length - 2]!.price : null;
  return { price: last.price, before: prev, at: last.at };
}

// ── Stock ─────────────────────────────────────────────────────────────────────

export type Stock = { shopQty: number; truckQty: number; sites: { name: string; qty: number }[]; reserved: { qty: number; job: string }[]; par: number };

export const totalOf = (s: Pick<Stock, "shopQty" | "truckQty" | "sites">): number => s.shopQty + s.truckQty + s.sites.reduce((n, x) => n + x.qty, 0);
export const reservedOf = (s: Pick<Stock, "reserved">): number => s.reserved.reduce((n, x) => n + x.qty, 0);

/** Running low is below the reorder level; Short is when what is set aside for jobs is more than there is. */
export function stockLevel(s: Stock): "ok" | "low" | "short" {
  const total = totalOf(s);
  if (reservedOf(s) > total) return "short";
  return total < s.par ? "low" : "ok";
}

/** What to order to get back above the reorder level: up to twice it, at least one. */
export function suggestedQty(s: Stock): number {
  return Math.max(1, Math.ceil(s.par * 2 - totalOf(s)));
}
