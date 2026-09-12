import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { FileSignature, Sparkles, Loader2, ArrowRight, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { contractsApi } from "@/lib/contracts-api";
import { ContractStatusBadge } from "@/pages/dashboard/contracts/[id]";

/**
 * Quote detail sidebar card: draft a contract from this quote, or jump to
 * the existing one. Drafting is available once the quote is unlocked; after
 * acceptance the automation usually has already drafted it.
 */
export function QuoteContractCard({ quoteId, quoteStatus, hasContractsFeature }: { quoteId: string; quoteStatus: string; hasContractsFeature: boolean }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({ queryKey: ["contract-by-quote", quoteId], queryFn: () => contractsApi.byQuote(quoteId), enabled: hasContractsFeature });
  const contract = data?.contract ?? null;

  const create = useMutation({
    mutationFn: () => contractsApi.createFromQuote(quoteId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["contract-by-quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      navigate(`/dashboard/contracts/${res.contract.id}`);
    },
    onError: (e: Error & { code?: string }) =>
      toast({ title: e.code === "PLAN_REQUIRED" ? t("contracts.planRequired") : t("contracts.draftError"), description: e.message, variant: "destructive" }),
  });

  const canDraft = quoteStatus === "unlocked" || quoteStatus === "accepted";
  const closed = contract && ["voided", "declined", "expired"].includes(contract.status);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-muted-foreground" />
          {t("contracts.cardTitle")}
        </CardTitle>
        <CardDescription className="text-xs">{t("contracts.cardDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {!hasContractsFeature ? (
          <Link href="/dashboard/settings?tab=billing" className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500 hover:border-violet-300 hover:text-violet-700">
            <Lock className="h-3.5 w-3.5" /> {t("contracts.cardUpgrade")}
          </Link>
        ) : isLoading ? (
          <div className="h-9 rounded-lg bg-slate-100 animate-pulse" />
        ) : contract && !closed ? (
          <Link href={`/dashboard/contracts/${contract.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800">{contract.contractNumber}</div>
              <div className="mt-1"><ContractStatusBadge status={contract.status} /></div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
          </Link>
        ) : (
          <>
            {closed && contract && (
              <div className="text-xs text-slate-500 flex items-center gap-2">{contract.contractNumber} <ContractStatusBadge status={contract.status} /></div>
            )}
            <Button className="w-full gap-2" size="sm" disabled={!canDraft || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {create.isPending ? t("contracts.drafting") : t("contracts.draftButton")}
            </Button>
            {!canDraft && <p className="text-[11px] text-slate-400 text-center">{t("contracts.unlockFirst")}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
