import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { FileSignature, Sparkles, Loader2, ArrowRight, Lock } from "lucide-react";
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
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2"><FileSignature className="h-4 w-4" style={{ color: "var(--faint)" }} /> {t("contracts.cardTitle")}</h2>
          <p className="sub">{t("contracts.cardDesc")}</p>
        </div>
      </div>
      {!hasContractsFeature ? (
        <div className="act-list">
          <Link href="/dashboard/settings?tab=billing" className="add-dashed" style={{ padding: 10, fontSize: 13 }}>
            <Lock /> {t("contracts.cardUpgrade")}
          </Link>
        </div>
      ) : isLoading ? (
        <div className="act-list"><div className="h-10 rounded-xl animate-pulse" style={{ background: "var(--soft)" }} /></div>
      ) : contract && !closed ? (
        <Link href={`/dashboard/contracts/${contract.id}`} className="item-row" style={{ borderTop: "none" }}>
          <div className="grow">
            <b className="ttl">{contract.contractNumber}</b>
            <span className="sub" style={{ marginTop: 4 }}><ContractStatusBadge status={contract.status} /></span>
          </div>
          <ArrowRight className="h-4 w-4" style={{ color: "var(--faint)" }} />
        </Link>
      ) : (
        <div className="act-list">
          {closed && contract && (
            <span className="foot-note flex items-center gap-2">{contract.contractNumber} <ContractStatusBadge status={contract.status} /></span>
          )}
          <button type="button" className="btn btn-sm btn-navy" style={{ justifyContent: "center" }} disabled={!canDraft || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {create.isPending ? t("contracts.drafting") : t("contracts.draftButton")}
          </button>
          {!canDraft && <span className="foot-note" style={{ textAlign: "center" }}>{t("contracts.unlockFirst")}</span>}
        </div>
      )}
    </section>
  );
}
