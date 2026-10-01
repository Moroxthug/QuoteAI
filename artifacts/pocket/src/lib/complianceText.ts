// The words for a deadline or reminder (title, line under it, status word), shared by Compliance and the accountant's view.
import { useTranslation } from "react-i18next";
import { dayDate, periodLabel, wordOf, type Item, type PeriodLabel } from "./compliance";
import { monthLong, shortDate, type Locale } from "./format";

export function useComplianceText() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const c = (k: string, o?: Record<string, unknown>): string => t(`cp.${k}`, o);
  const d = (day: string): string => shortDate(dayDate(day), locale);
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

  const taxName = (tax: string): string => (tax ? c(`tax.${tax}`) : "");
  const rangeText = (start: string, end: string): string => c("period.range", { start: d(start), end: d(end) });
  const periodText = (p: PeriodLabel): string => {
    switch (p.kind) {
      case "month": return cap(monthLong(dayDate(`${p.month}-01`), locale));
      case "quarter": return c("period.quarter", { n: p.quarter });
      case "range": return rangeText(p.start, p.end);
      case "year": return c("period.year", { end: d(p.end) });
    }
  };
  const periodOf = (i: Item): string => (i.period ? periodText(periodLabel(i.period)) : "");

  /** "HST return, Q3" / the reminder's own title. */
  const title = (i: Item): string => (i.source === "reminder" ? i.title : c(`titles.${i.kind}`, { tax: taxName(i.tax), period: periodOf(i), year: i.period?.key ?? "" }));

  /** The line under the title: what the period covers, or what the reminder is. */
  const sub = (i: Item): string => {
    if (i.source === "reminder") {
      const own = [i.authority, i.note].filter(Boolean).join(" · ");
      return own || c(`subs.repeats.${i.recurrence ?? "none"}`);
    }
    if (i.look === "filed") {
      const paid = i.kind === "sales_tax_payment" || i.kind === "gst_instalment";
      if (i.filedToday && !i.note) return c("subs.today");
      const o = { date: i.filedOn ? d(i.filedOn) : "", note: i.note };
      return c(i.note ? (paid ? "subs.paidNote" : "subs.filedNote") : paid ? "subs.paid" : "subs.filed", o);
    }
    if (i.kind === "t5018") return c("subs.t5018", { year: i.period?.key ?? "" });
    const range = i.period ? rangeText(i.period.start, i.period.end) : "";
    return i.kind === "sales_tax" || i.kind === "pst" ? c("subs.sheetReady", { range }) : c("subs.range", { range });
  };

  /** The status pill's word. */
  const word = (i: Item): string => {
    const w = wordOf(i);
    switch (w.kind) {
      case "late": return c("words.late", { count: w.days });
      case "due": return c(w.verb === "renews" ? "words.renews" : "words.due", { date: d(i.due) });
      default: return c(`words.${w.kind}`);
    }
  };

  /** "Oct 20 · in 21 days" for the strip's selected deadline. */
  const when = (i: Item): string => (i.daysLeft === 0 ? c("calendar.today", { date: d(i.due) }) : i.daysLeft > 0 ? c("calendar.in", { date: d(i.due), count: i.daysLeft }) : c("calendar.ago", { date: d(i.due), count: -i.daysLeft }));

  return { c, d, locale, taxName, rangeText, periodText, periodOf, title, sub, word, when, cap };
}
