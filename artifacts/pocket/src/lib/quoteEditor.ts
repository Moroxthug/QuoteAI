// The Quote editor's rules (QuoteEditor.dc.html), pure so they are tested (quoteEditor.test.ts): editing a quote's
// chapters and lines, reading the price check's flags, the payment schedule's steppers and its status.
import { round2, type Chapter, type Schedule, type Term, type Voce } from "./quoteMath.ts";

/** "1 234,50", "$18.5", "12" → number (comma or dot decimals, anything else ignored); 0 when there is nothing to read. */
export function parseAmount(input: string): number {
  const s = input.replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  // "1.234,50" (dot thousands, comma decimals) vs "1,234.50": the last separator is the decimal one.
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  const dec = Math.max(lastComma, lastDot);
  const cleaned = dec < 0 ? s : `${s.slice(0, dec).replace(/[.,]/g, "")}.${s.slice(dec + 1)}`;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export type LineField = "descrizione" | "um" | "quantita" | "prezzoUnitario";

export function editLine(caps: Chapter[], ci: number, vi: number, field: LineField, value: string | number): Chapter[] {
  return caps.map((c, i) => (i !== ci ? c : { ...c, voci: c.voci.map((v, j) => (j !== vi ? v : { ...v, [field]: field === "quantita" || field === "prezzoUnitario" ? Math.max(0, Number(value)) : String(value) })) }));
}

/** Swap a line with the one above it in the same chapter; the first line stays. */
export function moveLineUp(caps: Chapter[], ci: number, vi: number): Chapter[] {
  if (vi <= 0) return caps;
  return caps.map((c, i) => {
    if (i !== ci) return c;
    const voci = c.voci.slice();
    [voci[vi - 1], voci[vi]] = [voci[vi]!, voci[vi - 1]!];
    return { ...c, voci };
  });
}

export function newLine(o: Partial<Voce> = {}): Voce {
  return { descrizione: "", um: "ea", quantita: 1, prezzoUnitario: 0, totale: 0, ...o };
}

/** A line added to the last chapter (the board adds to the last section); a quote with no chapters gets one. */
export function addLine(caps: Chapter[], line: Voce, newChapterTitle = ""): Chapter[] {
  if (caps.length === 0) return [{ lettera: "A", titolo: newChapterTitle, voci: [line], subtotale: 0 }];
  return caps.map((c, i) => (i === caps.length - 1 ? { ...c, voci: [...c.voci, line] } : c));
}

export function removeLine(caps: Chapter[], ci: number, vi: number): Chapter[] {
  return caps.map((c, i) => (i !== ci ? c : { ...c, voci: c.voci.filter((_, j) => j !== vi) })).filter((c) => c.voci.length > 0);
}

export function lineCount(caps: Chapter[]): number {
  return caps.reduce((n, c) => n + c.voci.length, 0);
}

// ── Price check flags ─────────────────────────────────────────────────────────

export type Finding = { chapter: string; index: number; changePct: number; deltaTotal: number };
export type Flag = "low" | "high";

/** Per line (`chapterLetter:index`): "low" when the reference price is above what is quoted (you may be under-pricing), "high" when below. */
export function flagsOf(findings: Finding[]): Record<string, Flag> {
  const out: Record<string, Flag> = {};
  for (const f of findings) out[`${f.chapter}:${f.index}`] = f.changePct > 0 ? "low" : "high";
  return out;
}

export const flagKey = (c: Chapter, vi: number) => `${c.lettera}:${vi}`;

// ── The payment schedule ──────────────────────────────────────────────────────

export const PCT_STEP = 5;

export type TermRow = { id: string; label: string; trigger: string; pct: number; cents: number; /** Has a stepper (a percent the person sets). */ editable: boolean; /** Takes whatever is left, to the cent. */ rest: boolean; type: Term["type"] };
export type ScheduleView = { rows: TermRow[]; restPct: number; over: boolean; totalCents: number; holdbackOn: boolean; holdbackPct: number; holdbackCents: number };

function payable(s: Schedule): Term[] {
  return s.terms.filter((t) => t.type !== "holdback_release");
}

/** Every payable term but the last has a stepper; the last takes what is left (and the last cent). */
export function scheduleView(s: Schedule, total: number): ScheduleView {
  const terms = payable(s);
  const totalCents = Math.round(total * 100);
  const setPct = terms.slice(0, -1).reduce((n, t) => n + (t.amountType === "percent" ? t.value : 0), 0);
  const restPct = round2(100 - setPct);
  const cents = (pct: number) => Math.round((totalCents * pct) / 100);
  let used = 0;
  const rows: TermRow[] = terms.map((t, i) => {
    const last = i === terms.length - 1;
    const pct = last ? restPct : t.value;
    const c = last ? totalCents - used : cents(pct);
    used += last ? 0 : c;
    return { id: t.id, label: t.label, trigger: t.trigger, pct, cents: c, editable: !last && t.amountType === "percent", rest: last, type: t.type };
  });
  const hp = s.holdback.enabled ? s.holdback.percent : 0;
  return { rows, restPct, over: restPct < 0, totalCents, holdbackOn: s.holdback.enabled, holdbackPct: s.holdback.percent, holdbackCents: s.holdback.enabled ? cents(hp) : 0 };
}

/** Move a stepped term by one step (never below 0 or above `max`); the last term follows on its own. */
export function stepTerm(s: Schedule, id: string, dir: 1 | -1, max = 100): Schedule {
  const terms = payable(s);
  const idx = terms.findIndex((t) => t.id === id);
  if (idx < 0 || idx === terms.length - 1) return s;
  return { ...s, derived: false, terms: s.terms.map((t) => (t.id === id ? { ...t, value: Math.min(max, Math.max(0, round2(t.value + dir * PCT_STEP))) } : t)) };
}

/** The server needs the terms to add up to the total: write the last payable term's percent from the rest. */
export function normalizeSchedule(s: Schedule): Schedule {
  const terms = payable(s);
  const last = terms.at(-1);
  if (!last) return s;
  const set = terms.slice(0, -1).reduce((n, t) => n + t.value, 0);
  return { ...s, terms: s.terms.map((t) => (t.id === last.id ? { ...t, value: round2(100 - set) } : t)) };
}

export function toggleHoldback(s: Schedule): Schedule {
  return { ...s, derived: false, holdback: { ...s.holdback, enabled: !s.holdback.enabled } };
}

/** Whether the quote can go out: the schedule does not add past 100%. */
export const canSend = (s: Schedule | null | undefined, total: number) => !s || !scheduleView(s, total).over;

/** The four colours the schedule's bar and swatches cycle through (names, resolved to theme colours by the screen). */
export const SEGMENT_COLOURS = ["acc", "info", "ok-dot", "warn-dot"] as const;

/** Segment widths (percent of the bar): the payable terms, then the holdback. */
export function segments(v: ScheduleView): { id: string; pct: number }[] {
  const out = v.rows.map((r) => ({ id: r.id, pct: Math.max(0, r.pct) }));
  if (v.holdbackOn) out.push({ id: "holdback", pct: v.holdbackPct });
  return out;
}

/** "+$12.40 vs version 1" parts: the change from the total the client first saw. */
export function deltaFrom(total: number, original: number): number {
  return round2(total - original);
}
