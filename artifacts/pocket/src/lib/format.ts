// COMPONENTS §1 / CLAUDE.md: money, numbers and dates through Intl with the user's locale,
// never assembled by hand. en-CA: $4,131.05 · Sep 29 · 2:30 p.m.; fr-CA: 4 131,05 $ · 29 sept. · 14 h 30.
export type Locale = "en-CA" | "fr-CA";

export function money(amount: number, locale: Locale, opts: { cents?: boolean } = {}): string {
  const cents = opts.cents ?? true;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(amount);
}

export function number(n: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function percent(n: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** "Sep 29" / "29 sept." */
export function shortDate(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(d);
}

/** "2:30 p.m." / "14 h 30" */
export function time(d: Date, locale: Locale): string {
  if (locale === "fr-CA") {
    // Intl gives "14 h 30" for fr-CA on current ICU; normalise older "14:30".
    const s = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
    return s.includes("h") ? s : s.replace(":", " h ");
  }
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
}
