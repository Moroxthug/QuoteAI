// The Price check screen's rules (PriceCheck.dc.html), pure so they are tested (priceCheck.test.ts). The server compares each
// priced line with the company's own references (price book, and the average of its latest receipts) and flags a line when
// the reference is 5% or more away. The board's Toronto ranges and margins need data the app does not have; this compares
// each line's price with the reference and shows a band of +/- the threshold around it.
import { recompute, round2, type Chapter } from "./quoteMath.ts";

export type Verdict = "low" | "high" | "in_range" | "no_data";

export type CheckLine = {
  chapter: string;
  index: number;
  description: string;
  um: string;
  quantita: number;
  quotedUnitPrice: number;
  referenceUnitPrice: number | null;
  referenceName: string | null;
  source: "catalog" | "receipts" | null;
  sampleCount: number | null;
  changePct: number | null;
  verdict: Verdict;
};

export const lineKey = (l: Pick<CheckLine, "chapter" | "index">) => `${l.chapter}:${l.index}`;

/** Lines the person can act on: a reference that is 5% or more away. */
export const suggestions = (lines: CheckLine[]) => lines.filter((l) => l.verdict === "low" || l.verdict === "high");

/** What one line would move the quote's pre-tax total by if repriced at its reference. */
export function lineDelta(l: CheckLine): number {
  return l.referenceUnitPrice == null ? 0 : round2((l.referenceUnitPrice - l.quotedUnitPrice) * l.quantita);
}

export type Marks = { you: number; reference: number; bandLo: number; bandHi: number };

/** Positions (0 to 100) on a bar that spans both prices with room either side; the band is the reference +/- `thresholdPct`. */
export function marks(quoted: number, reference: number, thresholdPct: number): Marks {
  const bandLoV = reference * (1 - thresholdPct / 100), bandHiV = reference * (1 + thresholdPct / 100);
  const lo = Math.min(quoted, bandLoV), hi = Math.max(quoted, bandHiV);
  const pad = (hi - lo || reference || 1) * 0.35;
  const from = Math.max(0, lo - pad), to = hi + pad;
  const pos = (v: number) => Math.round(((v - from) / (to - from)) * 1000) / 10;
  return { you: pos(quoted), reference: pos(reference), bandLo: pos(bandLoV), bandHi: pos(bandHiV) };
}

/** The quote's chapters with the chosen lines' unit prices set to their references. */
export function applyReferences(caps: Chapter[], lines: CheckLine[], applied: Set<string>): Chapter[] {
  return caps.map((c) => ({ ...c, voci: c.voci.map((v, i) => {
    const l = lines.find((x) => x.chapter === c.lettera && x.index === i);
    return l && l.referenceUnitPrice != null && applied.has(lineKey(l)) ? { ...v, prezzoUnitario: l.referenceUnitPrice } : v;
  }) }));
}

/** The total (tax and discount as the quote has them) with the chosen lines applied. */
export function totalWith(caps: Chapter[], lines: CheckLine[], applied: Set<string>, ivaPercent: number, discountPercent: number): number {
  return recompute(applyReferences(caps, lines, applied), ivaPercent, discountPercent).totale;
}

export type Headline = "checking" | "allApplied" | "allInRange" | "toLook";

export function headlineOf(o: { loading: boolean; suggested: number; applied: number }): Headline {
  if (o.loading) return "checking";
  if (o.suggested === 0) return "allInRange";
  if (o.applied >= o.suggested) return "allApplied";
  return "toLook";
}

/** Tone of the delta: more money for you is good (ok), less is a cost (warn). */
export const deltaTone = (d: number): "ok" | "bad" | "muted" => (d > 0 ? "ok" : d < 0 ? "bad" : "muted");
