// The quote's own arithmetic and rules for the Quote and Quote editor screens (quoteMath.test.ts). The server stores
// a quote's totals as the app sends them (PUT /api/quotes/:id takes subtotale, ivaValore and totale), so the same
// rounding the web editor uses is here: every line and chapter to the cent, the discount before the tax.

export type Voce = { descrizione: string; um: string; quantita: number; prezzoUnitario: number; totale: number };
export type Chapter = { lettera: string; titolo: string; osservazione?: string; voci: Voce[]; subtotale: number };
export type Discount = { percentuale: number; importoScontato: number } | null;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type Totals = { capitoli: Chapter[]; subtotale: number; imponibile: number; ivaValore: number; totale: number; sconto: Discount };

/** Totals for chapters at a tax rate (percent) and a discount (percent, before tax). */
export function recompute(caps: Chapter[], ivaPercentuale: number, discountPercent = 0): Totals {
  const capitoli = caps.map((c) => {
    const voci = c.voci.map((v) => ({ ...v, totale: round2(v.quantita * v.prezzoUnitario) }));
    return { ...c, voci, subtotale: round2(voci.reduce((s, v) => s + v.totale, 0)) };
  });
  const subtotale = round2(capitoli.reduce((s, c) => s + c.subtotale, 0));
  const imponibile = discountPercent > 0 ? round2(subtotale * (1 - discountPercent / 100)) : subtotale;
  const ivaValore = round2(imponibile * (ivaPercentuale / 100));
  return { capitoli, subtotale, imponibile, ivaValore, totale: round2(imponibile + ivaValore), sconto: discountPercent > 0 ? { percentuale: discountPercent, importoScontato: imponibile } : null };
}

/** A lump sum ("lot", "forfait", one of something) shows "fixed"; a measured line gets the stepper. */
const LUMP = /^(lot|lots|ls|l\.s\.|forfait|forf\.?|job|lump|lump sum|global|—|-)?$/i;
const EACH = /^(cad|ea|each|u|unit|units|pc|pcs|pz|un|unité|unités)$/i;
export const isFixed = (v: Pick<Voce, "um" | "quantita">) => LUMP.test(v.um.trim()) || (EACH.test(v.um.trim()) && v.quantita <= 1);

/** How far one tap of the stepper moves a quantity: about a fiftieth of it, on a round number. */
export function stepOf(quantity: number, um: string): number {
  if (EACH.test(um.trim())) return 1;
  const raw = Math.abs(quantity) / 50;
  for (const s of [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500]) if (raw <= s) return s;
  return 1000;
}

/** A line's quantity moved by one step (never below zero). */
export function stepQuantity(v: Voce, dir: 1 | -1): number {
  return Math.max(0, round2(v.quantita + dir * stepOf(v.quantita, v.um)));
}

export function setLineQuantity(caps: Chapter[], ci: number, vi: number, quantity: number): Chapter[] {
  return caps.map((c, i) => (i !== ci ? c : { ...c, voci: c.voci.map((x, j) => (j !== vi ? x : { ...x, quantita: Math.max(0, round2(quantity)) })) }));
}

// ── The deposit switch (the payment schedule's "on signing" term) ─────────────

export type Term = { id: string; type: "deposit" | "milestone" | "completion" | "holdback_release"; label: string; trigger: string; milestoneKey?: string; offsetDays?: number; amountType: "percent" | "fixed"; value: number; dueDays: number };
export type Schedule = { currency: "CAD"; terms: Term[]; holdback: { enabled: boolean; percent: number }; derived: boolean };

export const DEFAULT_DEPOSIT_PERCENT = 30;

export function depositTerm(s: Schedule | null | undefined): Term | null {
  return s?.terms.find((x) => x.type === "deposit" && x.amountType === "percent") ?? null;
}

/** The switch can only move a deposit when every term is a percent (a fixed-amount term would not stay at 100%). */
export function canToggleDeposit(s: Schedule | null | undefined): boolean {
  if (!s) return false;
  const last = s.terms.filter((x) => x.type !== "holdback_release").at(-1);
  return !!last && s.terms.every((x) => x.amountType === "percent");
}

/**
 * Turn the deposit on or off. Off: the deposit's percent goes to the last term. On: the percent (30 by default)
 * comes off the last term and becomes a term due on signing at the front. The schedule stays at 100%.
 */
export function toggleDeposit(s: Schedule, newId: string, label: string): Schedule {
  const dep = depositTerm(s);
  let terms = s.terms.map((x) => ({ ...x }));
  const isTail = (x: Term) => x.type !== "holdback_release";
  if (dep) {
    terms = terms.filter((x) => x.id !== dep.id);
    const tail = terms.filter(isTail).at(-1);
    if (tail) tail.value = round2(tail.value + dep.value);
  } else {
    const tail = terms.filter(isTail).at(-1);
    if (!tail) return s;
    const p = Math.min(DEFAULT_DEPOSIT_PERCENT, Math.max(0, tail.value));
    tail.value = round2(tail.value - p);
    terms = [{ id: newId, type: "deposit", label, trigger: "on_signing", amountType: "percent", value: p, dueDays: 0 }, ...terms.filter((x) => x.value > 0 || x.type === "holdback_release")];
  }
  return { ...s, terms, derived: false };
}

/** What is due on acceptance, in dollars: the deposit's percent of the total. */
export function depositAmount(s: Schedule | null | undefined, total: number): number | null {
  const d = depositTerm(s);
  return d ? round2((total * d.value) / 100) : null;
}

// ── Sending ───────────────────────────────────────────────────────────────────

export type Channel = "email" | "sms" | "wa";

export const maskEmail = (e: string) => `${(e.split("@")[0] ?? "").slice(0, 6)}@…`;
export const maskPhone = (p: string) => `… ${p.replace(/\D/g, "").slice(-4)}`;

/** The channel to start on: email when there is one, else SMS when the company has SMS and the client a number. */
export function defaultChannel(email: string, phone: string, smsOk: boolean): Channel {
  return email ? "email" : phone && smsOk ? "sms" : "email";
}

/** An address that can take a quote: something@something. */
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
/** A number with enough digits to text (10 or 11, North American). */
export const validPhone = (p: string) => { const d = p.replace(/\D/g, ""); return d.length === 10 || (d.length === 11 && d.startsWith("1")); };
