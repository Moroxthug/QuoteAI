// Phase 79 — price check on a quote. Every line of a quote that can still be
// edited is matched by name against the company's own price data: the price
// catalog (Settings → Catalog) and the unit prices learned from scanned
// receipts (price_intelligence, Phase 18). When the reference moved away
// from the quoted unit price by more than the threshold the line is
// flagged ("lumber +8 % since this catalog price — reprice?") and the
// contractor can apply the reference price in one click. Pure matching in
// this file; the routes in routes/quotes.ts load the rows and write back.
import { db, priceCatalogItemsTable, priceIntelligenceTable, type QuoteChapter } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

/** Lines are flagged once the reference price differs from the quoted one by at least this much. */
const PRICE_CHECK_THRESHOLD_PCT = 5;
/** Learned prices: the average of the latest N receipt samples for the work type. */
const RECENT_SAMPLES = 5;
/** Learned prices need this many samples before they outrank the catalog. */
const MIN_SAMPLES = 3;
/** Word-overlap score (shared ÷ shorter side) a name needs to count as the same item. */
const MIN_MATCH_SCORE = 0.6;

const STOPWORDS = new Set([
  "and", "the", "for", "with", "per", "each", "incl", "including", "supply", "install", "installation", "labour", "labor", "material", "materials", "new", "existing",
  "et", "les", "des", "pour", "avec", "par", "fourniture", "pose", "installation", "main", "oeuvre", "sur", "dans", "une", "the", "de", "du", "la", "le",
]);

/** Lower-case, accent-free words of 3+ letters/digits, stopwords dropped, order-free. */
export function nameTokens(s: string): Set<string> {
  const norm = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const out = new Set<string>();
  for (const w of norm.split(/[^a-z0-9]+/)) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    // crude singular: "cabinets" → "cabinet", "boxes" → "box", "bardeaux" → "bardeau"
    out.add(w.endsWith("es") && w.length > 4 ? w.slice(0, -2) : (w.endsWith("s") || w.endsWith("x")) && w.length > 3 ? w.slice(0, -1) : w);
  }
  return out;
}

/** Shared tokens ÷ the smaller token set — 1 when one name is contained in the other. */
export function matchScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

const UNIT_ALIASES: Record<string, string> = {
  sqft: "sqft", sf: "sqft", ft2: "sqft", pi2: "sqft", pica: "sqft", pc2: "sqft",
  lf: "lf", ft: "lf", pi: "lf", lin: "lf", linft: "lf", pl: "lf", ml: "lf", m: "m", m2: "m2", sqm: "m2",
  hr: "hr", h: "hr", hour: "hr", hours: "hr", heure: "hr", heures: "hr",
  ea: "ea", each: "ea", unit: "ea", unite: "ea", pc: "ea", pce: "ea", piece: "ea", cad: "ea", nr: "ea", no: "ea",
  lot: "lot", forfait: "lot", ls: "lot", job: "lot", global: "lot",
  day: "day", jour: "day", days: "day", jours: "day",
  bag: "bag", sac: "bag", sheet: "sheet", feuille: "sheet", box: "box", boite: "box", gal: "gal", l: "l", kg: "kg", ton: "ton", tonne: "ton",
};

/** Normalises a unit label; "" when unknown so unknown units never block a match. */
export function normalizeUnit(u: string | null | undefined): string {
  if (!u) return "";
  const k = u.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[²]/g, "2").replace(/[^a-z0-9]/g, "");
  return UNIT_ALIASES[k] ?? k;
}

export type PriceReference = { key: string; name: string; unit: string | null; unitPrice: number; source: "catalog" | "receipts"; sampleCount: number; vendor: string | null };

type PriceCheckFinding = {
  chapter: string;
  index: number;
  description: string;
  um: string;
  quantita: number;
  quotedUnitPrice: number;
  referenceUnitPrice: number;
  referenceName: string;
  referenceUnit: string | null;
  source: "catalog" | "receipts";
  sampleCount: number;
  vendor: string | null;
  /** (reference − quoted) ÷ quoted, in percent, one decimal. */
  changePct: number;
  /** What the line total would move by if repriced at the reference. */
  deltaTotal: number;
};

export type PriceCheck = { checkedAt: string; thresholdPct: number; linesChecked: number; findings: PriceCheckFinding[]; deltaTotal: number };

function bestReference(description: string, um: string, refs: PriceReference[]): PriceReference | null {
  const tokens = nameTokens(description);
  if (tokens.size === 0) return null;
  const unit = normalizeUnit(um);
  if (unit === "lot") return null; // a lump sum has no unit price to compare
  let best: { ref: PriceReference; score: number } | null = null;
  for (const ref of refs) {
    if (ref.unitPrice <= 0) continue;
    const refUnit = normalizeUnit(ref.unit);
    if (unit && refUnit && unit !== refUnit) continue;
    const score = matchScore(tokens, nameTokens(ref.name));
    if (score < MIN_MATCH_SCORE) continue;
    // Prefer the better match; on a tie, learned prices with enough samples (fresher) over the catalog.
    if (!best || score > best.score || (score === best.score && ref.source === "receipts" && best.ref.source === "catalog")) best = { ref, score };
  }
  return best?.ref ?? null;
}

/** Pure: which lines drift from their reference by ≥ threshold. */
export function priceCheckChapters(capitoli: QuoteChapter[], refs: PriceReference[], now = new Date()): PriceCheck {
  const findings: PriceCheckFinding[] = [];
  let linesChecked = 0;
  for (const cap of capitoli) {
    cap.voci.forEach((v, index) => {
      if (!(v.prezzoUnitario > 0)) return;
      linesChecked++;
      const ref = bestReference(v.descrizione, v.um, refs);
      if (!ref) return;
      const changePct = Math.round(((ref.unitPrice - v.prezzoUnitario) / v.prezzoUnitario) * 1000) / 10;
      if (Math.abs(changePct) < PRICE_CHECK_THRESHOLD_PCT) return;
      const deltaTotal = Math.round((ref.unitPrice - v.prezzoUnitario) * v.quantita * 100) / 100;
      findings.push({ chapter: cap.lettera, index, description: v.descrizione, um: v.um, quantita: v.quantita, quotedUnitPrice: v.prezzoUnitario, referenceUnitPrice: ref.unitPrice, referenceName: ref.name, referenceUnit: ref.unit, source: ref.source, sampleCount: ref.sampleCount, vendor: ref.vendor, changePct, deltaTotal });
    });
  }
  const deltaTotal = Math.round(findings.reduce((s, f) => s + f.deltaTotal, 0) * 100) / 100;
  return { checkedAt: now.toISOString(), thresholdPct: PRICE_CHECK_THRESHOLD_PCT, linesChecked, findings, deltaTotal };
}

/** Pure: fold receipt samples (newest first) into one reference per work type; below MIN_SAMPLES the type is skipped. */
export function learnedReferences(rows: { workType: string; unitPrice: string | number; unit: string | null; vendor: string | null }[]): PriceReference[] {
  const groups = new Map<string, { name: string; unit: string | null; prices: number[]; vendors: Map<string, number> }>();
  for (const r of rows) {
    const key = r.workType.trim().toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { name: r.workType.trim(), unit: r.unit, prices: [], vendors: new Map() };
      groups.set(key, g);
    }
    if (g.prices.length >= RECENT_SAMPLES) continue;
    const p = Number(r.unitPrice);
    if (!(p > 0)) continue;
    g.prices.push(p);
    if (r.vendor) g.vendors.set(r.vendor, (g.vendors.get(r.vendor) ?? 0) + 1);
  }
  const out: PriceReference[] = [];
  for (const [key, g] of groups) {
    if (g.prices.length < MIN_SAMPLES) continue;
    const avg = g.prices.reduce((a, b) => a + b, 0) / g.prices.length;
    const vendor = [...g.vendors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    out.push({ key: `receipts:${key}`, name: g.name, unit: g.unit, unitPrice: Math.round(avg * 100) / 100, source: "receipts", sampleCount: g.prices.length, vendor });
  }
  return out;
}

/** The company's references: catalog items + learned prices (newest receipts first). */
export async function loadPriceReferences(userId: string): Promise<PriceReference[]> {
  const [catalog, learned] = await Promise.all([
    db.select({ id: priceCatalogItemsTable.id, nome: priceCatalogItemsTable.nome, um: priceCatalogItemsTable.um, prezzo: priceCatalogItemsTable.prezzoUnitario }).from(priceCatalogItemsTable).where(eq(priceCatalogItemsTable.userId, userId)),
    db
      .select({ workType: priceIntelligenceTable.workType, unitPrice: priceIntelligenceTable.unitPrice, unit: priceIntelligenceTable.unit, vendor: priceIntelligenceTable.vendor })
      .from(priceIntelligenceTable)
      .where(eq(priceIntelligenceTable.userId, userId))
      .orderBy(desc(priceIntelligenceTable.createdAt))
      .limit(2000),
  ]);
  return [
    ...catalog.map((c): PriceReference => ({ key: `catalog:${c.id}`, name: c.nome, unit: c.um, unitPrice: Number(c.prezzo), source: "catalog", sampleCount: 1, vendor: null })),
    ...learnedReferences(learned),
  ];
}

/** Applies new unit prices to the given lines and recomputes every total (chapters, subtotal, discount base, tax, total). */
export function repriceChapters(
  capitoli: QuoteChapter[],
  changes: { chapter: string; index: number; unitPrice: number }[],
  taxRatePct: number,
  discountPct: number,
): { capitoli: QuoteChapter[]; subtotale: number; sconto: { percentuale: number; importoScontato: number } | null; ivaValore: number; totale: number; applied: number } {
  let applied = 0;
  const next = capitoli.map((cap) => {
    const voci = cap.voci.map((v, i) => {
      const c = changes.find((x) => x.chapter === cap.lettera && x.index === i);
      const prezzoUnitario = c ? c.unitPrice : v.prezzoUnitario;
      if (c && c.unitPrice !== v.prezzoUnitario) applied++;
      return { ...v, prezzoUnitario, totale: Math.round(v.quantita * prezzoUnitario * 100) / 100 };
    });
    return { ...cap, voci, subtotale: Math.round(voci.reduce((s, v) => s + v.totale, 0) * 100) / 100 };
  });
  const subtotale = Math.round(next.reduce((s, c) => s + c.subtotale, 0) * 100) / 100;
  const imponibile = discountPct > 0 ? Math.round(subtotale * (1 - discountPct / 100) * 100) / 100 : subtotale;
  const ivaValore = Math.round(imponibile * (taxRatePct / 100) * 100) / 100;
  const totale = Math.round((imponibile + ivaValore) * 100) / 100;
  return { capitoli: next, subtotale, sconto: discountPct > 0 ? { percentuale: discountPct, importoScontato: imponibile } : null, ivaValore, totale, applied };
}
