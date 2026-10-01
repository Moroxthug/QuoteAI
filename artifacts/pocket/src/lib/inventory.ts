// Inventory, "Materials" (Inventory.dc.html): the stock in the shop, on the truck and on sites, what is running low, the suggestion to reorder from the
// supplier that charged least, and the order list. Pure, so they are tested (inventory.test.ts). The server's shapes are routes/inventory.ts.

export type Level = "ok" | "low" | "short";
export type Site = { name: string; qty: number };
export type Reservation = { qty: number; job: string };

export type StockOption = { supplierId: string; name: string; terms: string; delivers: string; kind: "account" | "counter"; priceCents: number | null; beforeCents: number | null };
export type StockItem = {
  id: string; name: string; unit: string; par: number; shopQty: number; truckQty: number; sites: Site[]; reserved: Reservation[]; unitCostCents: number | null;
  total: number; level: Level; suggested: number; options: StockOption[];
};
export type OpenOrder = {
  id: string; supplierId: string; supplierName: string; inventoryItemId: string | null; itemName: string; unit: string; qty: number; unitPriceCents: number | null; destination: string;
  status: "listed" | "ordered" | "ready" | "backordered" | "delivered" | "picked_up";
};
export type InventoryOverview =
  | { enabled: false; requiredPlan: string }
  | { enabled: true; canEdit: boolean; items: StockItem[]; orders: OpenOrder[]; sites: string[] };

/** The places the segmented control picks: all, the shop, the truck, the sites. */
export const LOCATIONS = ["all", "shop", "truck", "sites"] as const;
export type Location = (typeof LOCATIONS)[number];

export const sitesQty = (i: Pick<StockItem, "sites">): number => i.sites.reduce((n, s) => n + s.qty, 0);

export function qtyAt(i: StockItem, loc: Location): number {
  switch (loc) {
    case "shop": return i.shopQty;
    case "truck": return i.truckQty;
    case "sites": return sitesQty(i);
    default: return i.total;
  }
}

/** The plural unit the board writes ("sheets") becomes singular for one. */
export const unitFor = (unit: string, n: number): string => (n === 1 ? unit.replace(/s$/, "") : unit);

/** How full the bar is: the total against twice the reorder level. */
export function fillOf(i: StockItem): number {
  const full = i.par * 2;
  return full > 0 ? Math.min(1, Math.max(0, i.total / full)) : i.total > 0 ? 1 : 0;
}

export type Where = { kind: "shop" | "truck" | "site" | "nowhere"; name?: string; n: number };

/** Where it is: the shop, the truck and each site that has some; "Nowhere" when there is none. */
export function whereOf(i: StockItem): Where[] {
  const out: Where[] = [];
  if (i.shopQty) out.push({ kind: "shop", n: i.shopQty });
  if (i.truckQty) out.push({ kind: "truck", n: i.truckQty });
  for (const s of i.sites) if (s.qty) out.push({ kind: "site", name: s.name, n: s.qty });
  return out.length ? out : [{ kind: "nowhere", n: 0 }];
}

/** The order that is on the way for an item: on the list or already ordered, not yet in. */
export const orderFor = (i: Pick<StockItem, "id">, orders: OpenOrder[]): OpenOrder | undefined => orders.find((o) => o.inventoryItemId === i.id);

/** What the "Running low" card shows: items under their reorder level, those short for a job first. */
export function lowItems(items: StockItem[]): StockItem[] {
  return items.filter((i) => i.level !== "ok").sort((a, b) => Number(b.level === "short") - Number(a.level === "short") || a.total / (a.par || 1) - b.total / (b.par || 1) || a.name.localeCompare(b.name));
}

export type Look = { tone: "info" | "bad" | "warn"; shape: "q1" | "alert" };
export const LOOK: Record<"ordered" | "short" | "low", Look> = { ordered: { tone: "info", shape: "q1" }, short: { tone: "bad", shape: "alert" }, low: { tone: "warn", shape: "alert" } };

export function statusKey(i: StockItem, order: OpenOrder | undefined): "ordered" | "short" | "low" {
  return order ? "ordered" : i.level === "short" ? "short" : "low";
}

export type Kpis = { tracked: number; places: number; low: number; short: number; onOrder: number; reservedCents: number; reservedJobs: number };

/** The three numbers: items tracked and in how many places, items running low (those not yet on order), and the value set aside for jobs. */
export function kpis(items: StockItem[], orders: OpenOrder[]): Kpis {
  const low = lowItems(items);
  const onOrder = low.filter((i) => orderFor(i, orders)).length;
  const places = (items.some((i) => i.shopQty > 0) ? 1 : 0) + (items.some((i) => i.truckQty > 0) ? 1 : 0) + (items.some((i) => sitesQty(i) > 0) ? 1 : 0);
  const jobs = new Set<string>();
  let cents = 0;
  for (const i of items) for (const r of i.reserved) { jobs.add(r.job.trim().toLowerCase()); cents += Math.round(r.qty * (i.unitCostCents ?? 0)); }
  return { tracked: items.length, places, low: low.length - onOrder, short: low.filter((i) => i.level === "short" && !orderFor(i, orders)).length, onOrder, reservedCents: cents, reservedJobs: jobs.size };
}

/** The suppliers to offer for an item, cheapest known price first (the server sorts them); the first is the suggestion. */
export const suggestedOption = (i: StockItem): StockOption | undefined => i.options[0];

export type Tag = { key: "best" | "up" | "last"; pct?: number };

/** "Best price" for the lowest of two or more known prices, "Up 8 %" when the last receipt was dearer than the one before, else "Last price". */
export function tagOf(o: StockOption, all: StockOption[]): Tag | null {
  if (o.priceCents == null) return null;
  const known = all.filter((x) => x.priceCents != null);
  if (o.beforeCents != null && o.priceCents > o.beforeCents) return { key: "up", pct: Math.round(((o.priceCents - o.beforeCents) / o.beforeCents) * 100) };
  if (known.length >= 2 && o.priceCents === Math.min(...known.map((x) => x.priceCents!))) return { key: "best" };
  return { key: "last" };
}

/** The reorder quantity moves by 5 when the suggestion is 20 or more, else by 1. */
export const qtyStep = (suggested: number): number => (suggested >= 20 ? 5 : 1);

export const lineTotalCents = (qty: number, o: Pick<StockOption, "priceCents"> | undefined): number | null => (o?.priceCents == null ? null : Math.round(qty * o.priceCents));

/** Where a reorder can go: the shop, each site the stock list knows, or a pick-up. (Stored as "shop", the site's name, or "pickup".) */
export const destinations = (sites: string[]): string[] => ["shop", ...sites, "pickup"];

/** The supplier the order list is reviewed at: the one with the most on the list (the board has one). */
export function reviewSupplier(orders: Pick<OpenOrder, "status" | "supplierId" | "supplierName">[]): { id: string; name: string } | null {
  const counts = new Map<string, { id: string; name: string; n: number }>();
  for (const o of orders) {
    if (o.status !== "listed") continue;
    const c = counts.get(o.supplierId) ?? { id: o.supplierId, name: o.supplierName, n: 0 };
    c.n++;
    counts.set(o.supplierId, c);
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return top ? { id: top.id, name: top.name } : null;
}

export const listedCount = (orders: Pick<OpenOrder, "status">[]): number => orders.filter((o) => o.status === "listed").length;

/** "Business" for "monthly_business". */
export function planName(id: string): string {
  const w = id.replace(/^monthly_/, "").replace(/_/g, " ");
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// ── The count and the add forms ──────────────────────────────────────────────

export type Count = { shopQty: number; truckQty: number; sites: Site[] };

export const countOf = (i: StockItem): Count => ({ shopQty: i.shopQty, truckQty: i.truckQty, sites: i.sites.map((s) => ({ ...s })) });
export const changedCount = (i: StockItem, c: Count): boolean => c.shopQty !== i.shopQty || c.truckQty !== i.truckQty || c.sites.some((s, n) => s.qty !== i.sites[n]?.qty);

/** A quantity moved by a step, never below nothing. */
export const stepQty = (n: number, by: number): number => Math.max(0, Math.round((n + by) * 100) / 100);

export type MaterialForm = { name: string; unit: string; par: string; shop: string };
export const EMPTY_MATERIAL: MaterialForm = { name: "", unit: "", par: "", shop: "" };
export const canSaveMaterial = (f: MaterialForm): boolean => f.name.trim().length > 0;

export function materialBody(f: MaterialForm, num: (s: string) => number) {
  return { name: f.name.trim(), unit: f.unit.trim() || "each", par: num(f.par), shopQty: num(f.shop) };
}
