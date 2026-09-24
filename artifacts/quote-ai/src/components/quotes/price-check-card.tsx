// Phase 79 — "Price check" on the quote page sidebar. Lines whose catalog
// price or learned receipt price moved ≥ 5 % from the quoted unit price,
// with a one-click reprice per line or for all of them. Only shown while
// the quote can still be edited and something was flagged.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetQuoteQueryKey, getListQuotesQueryKey } from "@workspace/api-client-react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { priceCheckApi, type PriceCheckFindingDto } from "@/lib/analytics-api";
import { formatCad } from "@/lib/money";

const cad = (v: number) => formatCad(v);
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${cad(Math.abs(v))}`;

const priceCheckQueryKey = (quoteId: string) => ["quote-price-check", quoteId] as const;

export function PriceCheckCard({ quoteId, enabled }: { quoteId: string; enabled: boolean }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const check = useQuery({ queryKey: priceCheckQueryKey(quoteId), queryFn: () => priceCheckApi.check(quoteId), enabled, retry: false, staleTime: 30_000 });

  const reprice = useMutation({
    mutationFn: (items: { chapter: string; index: number; unitPrice: number }[]) => priceCheckApi.reprice(quoteId, items),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: getGetQuoteQueryKey(quoteId) });
      queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      queryClient.invalidateQueries({ queryKey: priceCheckQueryKey(quoteId) });
      toast({ title: t("dashboard.priceCheck.applied").replace("{n}", String(r.applied)), description: t("dashboard.priceCheck.appliedDesc").replace("{from}", cad(r.totale.from)).replace("{to}", cad(r.totale.to)) });
    },
    onError: (err: Error & { code?: string }) => toast({ title: err.code === "LOCKED" ? t("dashboard.quoteDetail.lockedAfterDownload") : t("dashboard.quoteDetail.error"), variant: "destructive" }),
    onSettled: () => setBusyKey(null),
  });

  if (!enabled || !check.data || !check.data.editable || check.data.findings.length === 0) return null;
  const { findings, deltaTotal, thresholdPct } = check.data;
  const applyOne = (f: PriceCheckFindingDto) => {
    setBusyKey(`${f.chapter}:${f.index}`);
    reprice.mutate([{ chapter: f.chapter, index: f.index, unitPrice: f.referenceUnitPrice }]);
  };
  const applyAll = () => {
    setBusyKey("all");
    reprice.mutate(findings.map((f) => ({ chapter: f.chapter, index: f.index, unitPrice: f.referenceUnitPrice })));
  };

  return (
    <section className="card" data-testid="price-check-card">
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2"><TrendingUp className="h-4 w-4" style={{ color: "var(--faint)" }} /> {t("dashboard.priceCheck.title")}</h2>
          <p className="sub">{t("dashboard.priceCheck.subtitle").replace("{n}", String(findings.length)).replace("{pct}", String(thresholdPct))}</p>
        </div>
      </div>
      <div>
        {findings.map((f) => {
          const key = `${f.chapter}:${f.index}`;
          const up = f.changePct > 0;
          const source = f.source === "receipts"
            ? t("dashboard.priceCheck.fromReceipts").replace("{n}", String(f.sampleCount)) + (f.vendor ? ` · ${f.vendor}` : "")
            : t("dashboard.priceCheck.fromCatalog").replace("{name}", f.referenceName);
          return (
            <div key={key} className="fu-row" style={{ alignItems: "flex-start" }}>
              <div className="min-w-0 flex-1">
                <b className="truncate">{f.chapter}. {f.description}</b>
                <span className="block">
                  {cad(f.quotedUnitPrice)} → {cad(f.referenceUnitPrice)}{f.um ? ` / ${f.um}` : ""} · {source}
                </span>
                <span className="block" style={{ color: "var(--muted-mk)" }}>
                  {t("dashboard.priceCheck.lineDelta").replace("{qty}", String(f.quantita)).replace("{delta}", signed(f.deltaTotal))}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={cn("chip", up ? "chip-yellow" : "chip-green")}>
                  {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {f.changePct > 0 ? "+" : ""}{f.changePct} %
                </span>
                <button type="button" className="btn btn-sm btn-outline-navy" disabled={reprice.isPending} onClick={() => applyOne(f)}>
                  {busyKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t("dashboard.priceCheck.apply")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card-foot">
        <span className="text-sm font-semibold" style={{ color: deltaTotal > 0 ? "var(--yellow-dark)" : "var(--green-dark)" }}>
          {t("dashboard.priceCheck.total").replace("{delta}", signed(deltaTotal))}
        </span>
        {findings.length > 1 && (
          <button type="button" className="btn btn-sm btn-navy" disabled={reprice.isPending} onClick={applyAll}>
            {busyKey === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("dashboard.priceCheck.applyAll")}
          </button>
        )}
      </div>
    </section>
  );
}
