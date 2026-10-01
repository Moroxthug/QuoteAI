// The AI quote bar's rules (AI-QUOTE-BAR-SPEC.md), pure so they are tested (quoteBar.test.ts).

/** The budget presets: $2.5k, $5k, $7.5k, $10k. */
export const BUDGET_PRESETS = [2500, 5000, 7500, 10000] as const;

/** Digits typed into the budget field ("12,500", "12 500", "$5000") → whole dollars, or null when empty. */
export function parseBudget(input: string): number | null {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (!digits) return null;
  const n = Number(digits);
  return n > 0 ? n : null;
}

/** "2.5k", "10k": the short form on a preset (the number keeps its own locale digits through Num). */
export function presetLabel(n: number, locale: "en-CA" | "fr-CA"): string {
  const k = n / 1000;
  const s = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(k);
  return `${s} k`.replace(" k", "k");
}

export type Fit = { ratio: number; over: boolean; diff: number };

/** How the total sits against the budget: the bar's fill (0 to 1) and the dollars under or over. */
export function budgetFit(total: number, budget: number): Fit {
  const diff = Math.round(Math.abs(budget - total));
  return { ratio: Math.max(0, Math.min(1, total / budget)), over: total > budget, diff };
}

/** First two initials of a name, upper case ("Dana Whitfield" → "DW", "Harbourfront" → "H"). */
export function initialsFor(name: string): string {
  const parts = name.replace(/&/g, " ").split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

/** "Dana Whitfield" → "Dana": the client chip shows the first name. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** A job description is ready to send when it has something other than spaces. */
export function canBuild(text: string): boolean {
  return text.trim().length > 0;
}

export type NewClient = { name: string; phone: string; email: string; address: string };

/** The new-client form → the quote's clientData (the server links or creates the client from it). */
export function clientDataOf(c: NewClient): { nome: string; indirizzo: string; phone?: string; email?: string } {
  return { nome: c.name.trim(), indirizzo: c.address.trim(), ...(c.phone.trim() ? { phone: c.phone.trim() } : null), ...(c.email.trim() ? { email: c.email.trim() } : null) };
}

export function canAddClient(c: NewClient): boolean {
  return c.name.trim().length > 0;
}

/** Lines to show while the quote is built: its chapters (title and subtotal), else its flat items. */
export function previewLines(q: { capitoli?: { titolo: string; subtotale: number }[]; items?: { descrizione: string; totale: number }[] }): { name: string; amount: number }[] {
  if (q.capitoli && q.capitoli.length) return q.capitoli.map((c) => ({ name: c.titolo, amount: c.subtotale }));
  return (q.items ?? []).map((i) => ({ name: i.descrizione, amount: i.totale }));
}

/** The tax a province charges, as the total line names it ("Total incl. HST"). */
export function taxName(province: string | null | undefined): string | null {
  switch ((province ?? "").toUpperCase()) {
    case "ON": case "NB": case "NS": case "NL": case "PE": return "HST";
    case "QC": return "GST + QST";
    case "BC": case "SK": return "GST + PST";
    case "MB": return "GST + RST";
    case "AB": case "YT": case "NT": case "NU": return "GST";
    default: return null;
  }
}
