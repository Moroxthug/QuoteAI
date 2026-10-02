// Imports: the pure parts. A spreadsheet's columns are matched to what quoteAI keeps (a client's name, phone, email, address, notes; a price item's name, unit, price, category, notes),
// the person can change any match, and the rows become what the server takes. Source: Imports.dc.html.
export type Kind = "clients" | "prices" | "jobs";
export const KINDS: Kind[] = ["clients", "prices", "jobs"];

/** The fields of each kind, in the order the match button cycles through them; "skip" is last. */
export const FIELDS: Record<Exclude<Kind, "jobs">, string[]> = {
  clients: ["name", "phone", "email", "address", "notes", "skip"],
  prices: ["name", "unit", "price", "category", "notes", "skip"],
};

const ALIASES: Record<string, string[]> = {
  name: ["name", "clientname", "client", "customer", "customername", "fullname", "company", "item", "itemname", "description", "product", "service", "nom"],
  phone: ["phone", "phonenumber", "tel", "telephone", "cell", "mobile", "cellulaire"],
  email: ["email", "emailaddress", "ecourriel", "courriel", "mail"],
  address: ["address", "street", "streetaddress", "adresse", "rue"],
  notes: ["notes", "note", "comments", "comment", "commentaires", "memo"],
  unit: ["unit", "um", "uom", "unite"],
  price: ["price", "unitprice", "rate", "cost", "amount", "prix"],
  category: ["category", "type", "group", "categorie"],
};
const norm = (h: string): string => h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** For each column the index of the field it most likely is (each field used once, the first column wins), or the last index ("skip"). */
export function suggest(headers: string[], kind: Exclude<Kind, "jobs">): number[] {
  const fields = FIELDS[kind];
  const skip = fields.length - 1;
  const used = new Set<number>();
  return headers.map((h) => {
    const n = norm(h);
    const i = fields.findIndex((f, fi) => fi < skip && !used.has(fi) && (ALIASES[f] ?? []).includes(n));
    if (i < 0) return skip;
    used.add(i);
    return i;
  });
}

/** The next field for a column (the pick button cycles), never a field another column has unless it is "skip". */
export function nextField(map: number[], col: number, kind: Exclude<Kind, "jobs">): number {
  const fields = FIELDS[kind];
  const skip = fields.length - 1;
  const taken = new Set(map.filter((m, i) => i !== col && m !== skip));
  for (let step = 1; step <= fields.length; step++) {
    const c = (map[col]! + step) % fields.length;
    if (c === skip || !taken.has(c)) return c;
  }
  return skip;
}

export type ClientRow = { row: number; name: string; phone?: string; email?: string; address?: string; notes?: string };
export type PriceRow = { row: number; name: string; unit: string; price: number | null; category?: string; notes?: string };

const cell = (row: string[], map: number[], fieldIndex: number): string => { const c = map.indexOf(fieldIndex); return c < 0 ? "" : (row[c] ?? "").trim(); };

/** Spreadsheet rows count from 2 (row 1 is the header). */
export function clientRows(rows: string[][], map: number[]): ClientRow[] {
  return rows.map((r, i) => ({ row: i + 2, name: cell(r, map, 0), phone: cell(r, map, 1) || undefined, email: cell(r, map, 2) || undefined, address: cell(r, map, 3) || undefined, notes: cell(r, map, 4) || undefined }));
}

/** "$1,234.50" and "12,50" are prices; text is not. */
export function priceOf(s: string): number | null {
  const t = s.replace(/[$\s]/g, "");
  if (!t) return null;
  const n = /,\d{1,2}$/.test(t) && !t.includes(".") ? Number(t.replace(",", ".")) : Number(t.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function priceRows(rows: string[][], map: number[]): PriceRow[] {
  return rows.map((r, i) => ({ row: i + 2, name: cell(r, map, 0), unit: cell(r, map, 1) || "ea", price: priceOf(cell(r, map, 2)), category: cell(r, map, 3) || undefined, notes: cell(r, map, 4) || undefined }));
}

export type PriceProblem = { row: number; name: string; why: "no_name" | "bad_price" };
/** The price rows that can be added (not already in the book by name and unit), those already there, and those with a mistake. */
export function planPrices(rows: PriceRow[], existing: { nome: string; um: string }[]): { clean: PriceRow[]; skipped: number; errors: PriceProblem[] } {
  const seen = new Set(existing.map((e) => `${e.nome.trim().toLowerCase()}|${e.um.trim().toLowerCase()}`));
  const clean: PriceRow[] = [];
  const errors: PriceProblem[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (!r.name.trim()) { errors.push({ row: r.row, name: "", why: "no_name" }); continue; }
    if (r.price === null) { errors.push({ row: r.row, name: r.name, why: "bad_price" }); continue; }
    const k = `${r.name.trim().toLowerCase()}|${r.unit.trim().toLowerCase()}`;
    if (seen.has(k)) { skipped++; continue; }
    seen.add(k);
    clean.push(r);
  }
  return { clean, skipped, errors };
}

/** The ring's stroke offset for a percentage (a 62 radius circle: 389.6 around). */
export const ringOffset = (pct: number): number => Math.round(389.6 * (1 - Math.max(0, Math.min(100, pct)) / 100) * 10) / 10;
