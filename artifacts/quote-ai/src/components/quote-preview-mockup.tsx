import { Sparkles } from "lucide-react";
import type { SectorData } from "@/data/seo-data";

// Deterministic pseudo-price so the same sector always renders the same
// numbers (no client/server hydration mismatch, no real pricing claim —
// this is a visual mockup, not the actual AI output).
function priceForItem(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return 90 + (hash % 18) * 45; // ranges roughly 90–855
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);
}

export function QuotePreviewMockup({ sector }: { sector: SectorData }) {
  const items = sector.useCases.slice(0, 3).map((label) => {
    const prezzo = priceForItem(label);
    return { descrizione: label, um: "a corpo", quantita: 1, prezzo };
  });

  const subtotale = items.reduce((s, i) => s + i.prezzo, 0);
  const iva = subtotale * 0.22;
  const totale = subtotale + iva;

  return (
    <div className="relative mx-auto w-full max-w-sm lg:rotate-2 hover:lg:rotate-0 transition-transform duration-300">
      <div className="absolute -top-3 -right-3 z-10 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-lg border border-violet-100">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Generato con AI in 30s
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-4">
          <div>
            <div className="text-sm font-bold text-slate-800">La Tua Azienda</div>
            <div className="text-[11px] text-slate-400">P.IVA 01234567890</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Preventivo</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Esempio</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Preventivi {sector.labelPlural}
          </div>
          <div className="text-xs text-slate-600">Spett.le Cliente</div>
        </div>

        <div className="space-y-2.5 mb-4">
          {items.map((item) => (
            <div key={item.descrizione} className="flex items-start justify-between gap-3 text-xs">
              <span className="text-slate-600 leading-snug">{item.descrizione}</span>
              <span className="font-medium text-slate-800 whitespace-nowrap">{formatCurrency(item.prezzo)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-gray-100 pt-3 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Subtotale</span>
            <span>{formatCurrency(subtotale)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>IVA 22%</span>
            <span>{formatCurrency(iva)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
            <span>Totale</span>
            <span className="gradient-text">{formatCurrency(totale)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
