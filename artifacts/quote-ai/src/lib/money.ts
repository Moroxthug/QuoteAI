// Phase 94: one place that formats dollars in the app's language.
//
// Money used to be formatted with a hard-coded "en-CA" in two dozen places,
// so a French dashboard read "$12,345.00" instead of "12 345,00 $". The
// helpers here follow the language the LanguageProvider last rendered with
// (it calls setMoneyLang on every render, before any child formats a number),
// so the plain function signatures every caller already uses keep working.
//
// Documents that carry their own language (a sent invoice, a contract, the
// client portal) keep formatting with that document's language instead.
// Same union as i18n/translations Lang; kept local so the API tests can import this file.
type Lang = "en" | "fr";

let current: Lang = "en";
const cache = new Map<string, Intl.NumberFormat>();

/** Called by LanguageProvider; not for general use. */
export function setMoneyLang(lang: Lang): void {
  current = lang;
}

export const moneyLocale = (lang: Lang = current) => (lang === "fr" ? "fr-CA" : "en-CA");

function fmt(key: string, lang: Lang, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const k = `${lang}|${key}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat(moneyLocale(lang), { style: "currency", currency: "CAD", ...opts });
    cache.set(k, f);
  }
  return f;
}

/** Dollars with cents: "$1,234.50" / "1 234,50 $". */
export const formatCad = (n: number, lang: Lang = current) => fmt("2", lang, {}).format(n);

/** Whole dollars: "$1,235" / "1 235 $". */
export const formatCadWhole = (n: number, lang: Lang = current) =>
  fmt("0", lang, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export const formatCents = (c: number, lang: Lang = current) => formatCad(c / 100, lang);

/**
 * Chart axis ticks: "$1.5K" / "1,5 k $". One decimal, so ticks 1 500 and 2 000
 * no longer both read "2k $" (the old formatter rounded to whole thousands).
 */
export const formatCadShort = (n: number, lang: Lang = current) =>
  Math.abs(n) < 1_000
    ? formatCadWhole(n, lang)
    : fmt("c", lang, { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** A plain number with two decimals, in the app's language ("1 234,50"). */
export const formatAmount = (n: number, lang: Lang = current) =>
  n.toLocaleString(moneyLocale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
