// The Price book (PriceBook.dc.html): labour, materials and assemblies, the three numbers on top, the filters, the marks that say a price moved,
// and the Add item sheet's rules. Pure, so they are tested (priceBook.test.ts). The server's shapes are routes/catalog.ts (`/api/catalog/overview`).
// The same rows feed the quote editor's price book sheet and New quote's Price list (`GET /api/catalog`): an item added here is on the next quote.

export type PriceKind = "labour" | "material" | "assembly";
export const KINDS: PriceKind[] = ["labour", "material", "assembly"];

export type BookItem = {
  id: string; nome: string; categoria: string | null; um: string; prezzoUnitario: number; note: string | null; kind: PriceKind;
  unitCost: number | null; previousPrice: number | null; priceChangedAt: string | null; parts: { name: string; amount: number }[] | null; createdAt: string; lastUsedAt: string | null;
};

export type BookOverview = { canEdit: boolean; items: BookItem[]; assemblies: number; usedThisMonth: number; usedInQuotes: number; pricesChanged: number; changedSince: string };

export type FilterKey = "all" | PriceKind;
export const FILTERS: FilterKey[] = ["all", "labour", "material", "assembly"];

/** The units the Add item sheet offers (the board's five). Other units the book already holds are shown as they are. */
export const UNITS = ["sq ft", "lin ft", "hour", "each", "day"] as const;

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function matchesSearch(i: BookItem, term: string): boolean {
  const t = fold(term).trim();
  return !t || fold(`${i.nome} ${i.categoria ?? ""}`).includes(t);
}

export const countOf = (items: BookItem[], f: FilterKey): number => (f === "all" ? items.length : items.filter((i) => i.kind === f).length);

/** The groups the board draws, in its order, each with the matching items: the ones used most recently first, then by name. */
/** `pin` is the item just added: the board puts it first. */
export function groupsOf(items: BookItem[], filter: FilterKey, term: string, pin: string | null = null): { kind: PriceKind; items: BookItem[] }[] {
  return KINDS.map((kind) => ({
    kind,
    items: items
      .filter((i) => i.kind === kind && (filter === "all" || filter === kind) && matchesSearch(i, term))
      .sort((a, b) => Number(b.id === pin) - Number(a.id === pin) || (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") || a.nome.localeCompare(b.nome)),
  })).filter((g) => g.items.length > 0);
}

/** A price counts as recently changed for 60 days. */
const RECENT_DAYS = 60;

export type Mark = { key: "changed" | "up" | "down" | "new"; tone: "warn" | "ok" | "acc"; pct?: number };

/** Materials say how far the price moved ("Up 8 %", "Down 3 %"); labour and assemblies say "Price changed". `justAdded` is the item the person just made. */
export function markOf(i: BookItem, now: Date, justAdded = false): Mark | null {
  if (justAdded) return { key: "new", tone: "acc" };
  if (!i.priceChangedAt || i.previousPrice == null || i.previousPrice <= 0) return null;
  if (now.getTime() - new Date(i.priceChangedAt).getTime() > RECENT_DAYS * 86_400_000) return null;
  if (i.kind !== "material") return { key: "changed", tone: "warn" };
  const pct = Math.round(((i.prezzoUnitario - i.previousPrice) / i.previousPrice) * 100);
  if (pct === 0) return { key: "changed", tone: "warn" };
  return pct > 0 ? { key: "up", tone: "warn", pct } : { key: "down", tone: "ok", pct: Math.abs(pct) };
}

export type MetaPart = { key: "used" | "added" | "parts" | "was"; date?: string; n?: number; price?: number };

/** What the line under the name says: how many parts, when it was last used (or added), and what the price was. */
export function metaOf(i: BookItem, now: Date): MetaPart[] {
  const out: MetaPart[] = [];
  if (i.kind === "assembly" && i.parts?.length) out.push({ key: "parts", n: i.parts.length });
  out.push(i.lastUsedAt ? { key: "used", date: i.lastUsedAt } : { key: "added", date: i.createdAt });
  if (markOf(i, now) && i.previousPrice != null) out.push({ key: "was", price: i.previousPrice });
  return out;
}

/** The parts of an assembly and what the whole costs the company: the cost typed in, else nothing (the parts are priced, not costed). */
export const costOf = (i: BookItem): number | null => (i.unitCost != null && i.unitCost > 0 ? i.unitCost : null);

/** (price - cost) / price as a whole percent; null when either is missing. */
export function marginPct(price: number, cost: number | null): number | null {
  if (cost == null || !(price > 0) || !(cost > 0)) return null;
  return Math.round(((price - cost) / price) * 100);
}

/** The Add item sheet is ready to save: a name and a price above zero. */
export const canSaveItem = (name: string, price: number): boolean => name.trim().length > 0 && price > 0;

/** The body of POST /api/catalog for what the sheet holds. */
export function newItemBody(f: { name: string; kind: PriceKind; unit: string; price: number; cost: number }): {
  nome: string; um: string; prezzoUnitario: number; kind: PriceKind; unitCost?: number;
} {
  return { nome: f.name.trim(), um: f.unit, prezzoUnitario: f.price, kind: f.kind, ...(f.cost > 0 ? { unitCost: f.cost } : null) };
}

const UNIT_KEYS: Record<string, string> = {
  "sq ft": "sqft", sqft: "sqft", sf: "sqft", "sq.ft": "sqft", "square feet": "sqft",
  "lin ft": "linft", "linear ft": "linft", "linear feet": "linft", lf: "linft", "lin.ft": "linft",
  hour: "hour", hours: "hour", hr: "hour", h: "hour",
  each: "each", ea: "each", piece: "each", pieces: "each", pcs: "each",
  day: "day", days: "day",
};

/** The translated unit's key when it is one of the board's five (or a spelling of one), else null: the unit is then shown as it was typed. */
export const unitKey = (um: string): string | null => UNIT_KEYS[um.trim().toLowerCase()] ?? null;

/** The value the Add item sheet saves for a chip (what the web app and the quote editor already write). */
export const UNIT_VALUE: Record<string, string> = { sqft: "sq ft", linft: "lin ft", hour: "hour", each: "each", day: "day" };
