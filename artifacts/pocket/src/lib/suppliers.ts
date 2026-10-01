// Suppliers and Supplier (Suppliers.dc.html, Supplier.dc.html): the stores the company buys from, grouped by how they are paid, filtered by what
// they sell, searched by name, rep or account; and one supplier's price history, orders and receipts. Pure, so they are tested (suppliers.test.ts).
// The server's shapes are routes/suppliers.ts.

export type SupplierKind = "account" | "counter";

export type SupplierDto = {
  id: string; name: string; category: string; repName: string; repRole: string; kind: SupplierKind; accountNo: string; terms: string; proDiscountPct: number | null;
  phone: string; email: string; address: string; delivers: string; hours: string; notes: string;
};
export type SupplierRow = SupplierDto & { spendMonthCents: number; lastOrderAt: string | null };

export type SuppliersOverview = {
  canEdit: boolean; items: SupplierRow[]; spendMonthCents: number; purchasesMonth: number; spendYearCents: number; priceChanges: number; priceUps: number;
  /** How many materials are running low; null when the plan has no inventory. */
  lowCount: number | null;
};

export type OrderStatus = "listed" | "ordered" | "ready" | "delivered" | "picked_up" | "backordered";
export type OrderDto = {
  id: string; supplierId: string; inventoryItemId: string | null; itemName: string; unit: string; qty: number; unitPriceCents: number | null; destination: string;
  status: OrderStatus; orderedAt: string | null; createdAt: string;
};
export type PriceRow = { name: string; from: number; to: number; changePct: number; when: string | null; points: number[] };
export type Nudge = {
  itemId: string; itemName: string; supplierPrice: number; bookPrice: number; newPrice: number; newCost: number | null; changePct: number; quoteId: string | null; openQuotes: number;
};
export type ReceiptDto = { id: string; date: string; description: string; totalCents: number; projectId: string | null; projectName: string | null };

export type SupplierDetail = {
  canEdit: boolean; canMatch: boolean; supplier: SupplierDto; spendYearCents: number; spendMonthCents: number; prices: PriceRow[]; nudge: Nudge | null;
  orders: OrderDto[]; receipts: ReceiptDto[]; receiptsMatched: number; receiptsTotal: number;
};

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function matchesSearch(s: SupplierDto, term: string): boolean {
  const t = fold(term).trim();
  return !t || fold([s.name, s.repName, s.repRole, s.accountNo, s.category].join(" ")).includes(t);
}

/** The categories the chips offer: the ones the company's suppliers have, each once (the first spelling), with how many suppliers. */
export function categoriesOf(items: SupplierDto[]): { key: string; label: string; count: number }[] {
  const seen = new Map<string, { key: string; label: string; count: number }>();
  for (const s of items) {
    const label = s.category.trim();
    if (!label) continue;
    const key = fold(label);
    const cur = seen.get(key);
    if (cur) cur.count++;
    else seen.set(key, { key, label, count: 1 });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** The words the board's chips use for the four it knows; any other category shows as it was typed. */
export const KNOWN_CATEGORIES = ["building", "paint", "lumber", "tools"] as const;
export const isKnownCategory = (key: string): key is (typeof KNOWN_CATEGORIES)[number] => (KNOWN_CATEGORIES as readonly string[]).includes(key);

export type Group = "account" | "counter";
export const GROUPS: Group[] = ["account", "counter"];

export function groupsOf(items: SupplierRow[], filter: string, term: string): { kind: Group; items: SupplierRow[] }[] {
  return GROUPS.map((kind) => ({
    kind,
    items: items.filter((s) => s.kind === kind && (filter === "all" || fold(s.category.trim()) === filter) && matchesSearch(s, term)),
  })).filter((g) => g.items.length > 0);
}

/** "Rachel Kim, Pro desk": the rep and their role. */
export const contactOf = (s: SupplierDto): string => [s.repName, s.repRole].map((x) => x.trim()).filter(Boolean).join(", ");

/** The digits a phone can dial. */
export const dialable = (phone: string): string => phone.replace(/[^\d+]/g, "");

export function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// ── The order list ───────────────────────────────────────────────────────────

export const ORDER_LOOK: Record<OrderStatus, { tone: "mute" | "info" | "ok" | "warn"; shape: "draft" | "q1" | "check" | "clock" }> = {
  listed: { tone: "mute", shape: "draft" },
  ordered: { tone: "info", shape: "q1" },
  ready: { tone: "ok", shape: "check" },
  delivered: { tone: "ok", shape: "check" },
  picked_up: { tone: "mute", shape: "check" },
  backordered: { tone: "warn", shape: "clock" },
};

/** What an order costs: the quantity times the supplier's price; null when the price isn't known. */
export const orderCents = (o: Pick<OrderDto, "qty" | "unitPriceCents">): number | null => (o.unitPriceCents == null ? null : Math.round(o.qty * o.unitPriceCents));

/** "Home Depot Pro" is the rep's store; the order list shares as plain text a rep can read: one line per item, then where it goes. */
export function shareText(heading: string, orders: OrderDto[], dest: (d: string) => string): string {
  const lines = orders.map((o) => `- ${trimQty(o.qty)} ${o.unit} ${o.itemName}${o.destination ? ` (${dest(o.destination)})` : ""}`);
  return [heading, ...lines].join("\n");
}

const trimQty = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// ── Price history ────────────────────────────────────────────────────────────

export type PriceLook = { color: "warn" | "ok" | "faint" };
export const priceLook = (p: PriceRow): PriceLook => ({ color: p.changePct > 0.05 ? "warn" : p.changePct < -0.05 ? "ok" : "faint" });

/** "+8.4 %" / "−3.2 %" / "0 %", by the locale. */
export function deltaText(pct: number, locale: string): string {
  if (Math.abs(pct) < 0.05) return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(0);
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(pct / 100).replace("-", "−");
}

// ── The forms ────────────────────────────────────────────────────────────────

export type SupplierForm = { name: string; category: string; kind: SupplierKind; repName: string; repRole: string; phone: string; email: string; accountNo: string; terms: string; address: string; delivers: string; hours: string; notes: string; proDiscount: string };

export const EMPTY_FORM: SupplierForm = { name: "", category: "", kind: "account", repName: "", repRole: "", phone: "", email: "", accountNo: "", terms: "", address: "", delivers: "", hours: "", notes: "", proDiscount: "" };

export function formOf(s: SupplierDto): SupplierForm {
  return {
    name: s.name, category: s.category, kind: s.kind, repName: s.repName, repRole: s.repRole, phone: s.phone, email: s.email, accountNo: s.accountNo, terms: s.terms, address: s.address,
    delivers: s.delivers, hours: s.hours, notes: s.notes, proDiscount: s.proDiscountPct == null ? "" : String(s.proDiscountPct),
  };
}

export const canSaveSupplier = (f: SupplierForm): boolean => f.name.trim().length > 0 && (f.email.trim() === "" || /^\S+@\S+\.\S+$/.test(f.email.trim()));

/** The body of POST and PUT /api/suppliers: every field, trimmed, so a cleared field clears the supplier's. */
export function supplierBody(f: SupplierForm, discount: number | null) {
  return {
    name: f.name.trim(), category: f.category.trim(), kind: f.kind, repName: f.repName.trim(), repRole: f.repRole.trim(), phone: f.phone.trim(), email: f.email.trim(), accountNo: f.accountNo.trim(),
    terms: f.terms.trim(), address: f.address.trim(), delivers: f.delivers.trim(), hours: f.hours.trim(), notes: f.notes.trim(), proDiscountPct: discount,
  };
}
