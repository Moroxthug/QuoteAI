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

/** "Sep 2027" / "sept. 2027" when the year is not this year's, else "Sep 29": long-lived dates (a warranty) say the year. */
export function dateWithYear(d: Date, now: Date, locale: Locale): string {
  return d.getFullYear() === now.getFullYear() ? shortDate(d, locale) : new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(d);
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

/** "Tue Sep 29" / "mar. 29 sept." (date fields; the boards drop Intl's comma in English) */
export function dayDate(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(d).replace(/,/g, "");
}

/** A sentence that ends on an abbreviation ("… at 9:12 a.m." + ".") keeps one full stop. */
export function sentence(s: string): string {
  return s.replace(/\.\.$/, ".");
}

/** "Fri" / "ven." */
export function weekdayShort(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
}

/** "September" / "septembre" */
export function monthLong(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(d);
}

/** The Home header's date: "Tue, Sep 29" / "mar. 29 sept." */
export function headerDate(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(d);
}

/**
 * When something happened, the way the boards say it: "12 min ago", "2 h ago", "today", "Mon" within the week,
 * else "Sep 12" ("il y a 2 h", "aujourd’hui", "lun.", "12 sept."). `now` is passed in so it is testable.
 */
export function relativeWhen(at: Date, now: Date, locale: Locale): string {
  const fr = locale === "fr-CA";
  const mins = Math.round((now.getTime() - at.getTime()) / 60_000);
  const ago = (n: number, unit: "min" | "h") => (fr ? `il y a ${n} ${unit}` : `${n} ${unit} ago`);
  if (mins >= 0 && mins < 60) return ago(Math.max(1, mins), "min");
  const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
  if (sameDay && mins >= 0) return mins < 60 * 12 ? ago(Math.round(mins / 60), "h") : fr ? "aujourd’hui" : "today";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days === 1) return fr ? "hier" : "yesterday";
  if (days > 1 && days < 7) return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(at);
  return shortDate(at, locale);
}

/** "Oct 5 – 7" / "5 – 7 oct." inside a month, else "Oct 5 – Nov 2" / "5 oct. – 2 nov."; one day alone when they match. */
export function dateRange(a: Date, b: Date, locale: Locale): string {
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()) return shortDate(a, locale);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return locale === "fr-CA" ? `${a.getDate()} – ${shortDate(b, locale)}` : `${shortDate(a, locale)} – ${b.getDate()}`;
  return `${shortDate(a, locale)} – ${shortDate(b, locale)}`;
}
