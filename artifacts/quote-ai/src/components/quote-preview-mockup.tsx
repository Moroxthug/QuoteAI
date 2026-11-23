import { Sparkles } from "lucide-react";
import type { SectorData } from "@/data/seo-data";
import { formatCad } from "@/lib/money";
import { useLanguage } from "@/i18n/LanguageContext";

// A sample quote, shown beside the trade-page hero. It is labelled as a
// sample: the line items are the trade's own use cases and the amounts are
// illustrative. Deterministic pseudo-prices keep the server and client render
// identical. Taxes follow the page's language: Ontario HST on English pages,
// Québec GST + QST on French ones.
function priceForItem(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return 90 + (hash % 18) * 45; // roughly 90–855
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function QuotePreviewMockup({ sector, lang }: { sector: SectorData; lang: "en" | "fr" }) {
  const { t } = useLanguage();
  const labels = (lang === "fr" ? sector.fr.useCases : sector.useCases).slice(0, 3);
  const items = labels.map((label) => ({ label, amount: priceForItem(sector.slug + label) }));
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxes =
    lang === "fr"
      ? [
          { label: t("seo.sampleQuote.gst"), amount: round2(subtotal * 0.05) },
          { label: t("seo.sampleQuote.qst"), amount: round2(subtotal * 0.09975) },
        ]
      : [{ label: t("seo.sampleQuote.hst"), amount: round2(subtotal * 0.13) }];
  const total = round2(subtotal + taxes.reduce((s, x) => s + x.amount, 0));
  const money = (n: number) => formatCad(n, lang);

  return (
    <div className="relative mx-auto w-full max-w-sm lg:rotate-2 hover:lg:rotate-0 transition-transform duration-300">
      <div className="absolute -top-3 -right-3 z-10 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 shadow-lg border border-navy-100">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {t("seo.sampleQuote.badge")}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-4">
          <div>
            <div className="text-sm font-bold text-slate-800">{t("seo.sampleQuote.company")}</div>
            <div className="text-[11px] text-slate-400">{t("seo.sampleQuote.taxNumber")}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t("seo.sampleQuote.title")}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{t("seo.sampleQuote.sample")}</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            {lang === "fr" ? sector.fr.label : sector.label}
          </div>
          <div className="text-xs text-slate-600">{t("seo.sampleQuote.client")}</div>
        </div>

        <div className="space-y-2.5 mb-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-3 text-xs">
              <span className="text-slate-600 leading-snug">{item.label}</span>
              <span className="font-medium text-slate-800 whitespace-nowrap">{money(item.amount)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-gray-100 pt-3 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>{t("seo.sampleQuote.subtotal")}</span>
            <span>{money(subtotal)}</span>
          </div>
          {taxes.map((x) => (
            <div key={x.label} className="flex justify-between text-slate-500">
              <span>{x.label}</span>
              <span>{money(x.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
            <span>{t("seo.sampleQuote.total")}</span>
            <span className="gradient-text">{money(total)}</span>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-slate-400">{t("seo.sampleQuote.note")}</p>
      </div>
    </div>
  );
}
