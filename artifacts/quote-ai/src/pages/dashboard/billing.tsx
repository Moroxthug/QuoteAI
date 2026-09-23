import { Link } from "wouter";
import { useGetSubscription, useCreateCustomerPortalSession, useGetPlans } from "@workspace/api-client-react";
import { LEGAL_ENTITY, isLegalEntityConfigured } from "@workspace/legal-entity";
import { PlanPicker, currentPlanPriceLabel } from "@/components/billing/plan-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Crown,
  Zap,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  BarChart3,
  ArrowUpRight,
  RefreshCw,
  XCircle,
  Loader2,
  Info,
} from "lucide-react";

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const { t } = useLanguage();
  const pct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t("dashboard.billing.quotesUsed")}</span>
        <span className="font-semibold">{used} / {limit}</span>
      </div>
      <div className="hbar">
        <i style={{ width: `${pct}%`, background: pct >= 90 ? "var(--red)" : pct >= 70 ? "var(--yellow-dark)" : "var(--navy)" }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{t("dashboard.billing.remainingThisMonth").replace("{count}", String(limit - used))}</span>
        <span>{t("dashboard.billing.pctUsed").replace("{pct}", String(pct))}</span>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { t, lang } = useLanguage();
  const { data: sub, isLoading } = useGetSubscription();
  const coveredBy = (sub as { coveredBy?: { orgId: string; companyName: string | null } | null } | undefined)?.coveredBy ?? null;
  const { data: plans } = useGetPlans();
  const createPortal = useCreateCustomerPortalSession();
  const { toast } = useToast();

  const handleManage = () => {
    createPortal.mutate(undefined, {
      onSuccess: (r) => { window.open(r.url, "_blank"); },
      onError: () => toast({ title: t("dashboard.billing.errorOpenPortal"), variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-[var(--radius-mk)]" />
        <Skeleton className="h-32 w-full rounded-[var(--radius-mk)]" />
      </div>
    );
  }

  const isStarter = sub?.plan === "monthly_starter";
  const isPro = sub?.plan === "monthly_pro";
  const isActive = sub?.isActive ?? false;

  const isElite = sub?.plan === "monthly_elite";
  const planLabel = isPro ? "Pro" : isStarter ? "Starter" : isElite ? "Elite" : null;
  // Phase 73: the label follows the live cadence ("$490/year" on annual).
  const planPrice = currentPlanPriceLabel(sub, Array.isArray(plans) ? plans : undefined, t, lang)
    ?? (isPro ? t("dashboard.billing.pricePro") : isStarter ? t("dashboard.billing.priceStarter") : isElite ? t("dashboard.billing.priceElite") : null);

  const renewalDate = sub?.periodEnd
    ? new Date(sub.periodEnd).toLocaleDateString("en-CA", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const resetDate = sub?.quotaResetDate
    ? new Date(sub.quotaResetDate).toLocaleDateString("en-CA", { day: "2-digit", month: "long" })
    : null;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("dashboard.billing.title")}</h1>
          <p className="sub">{t("dashboard.billing.subtitle")}</p>
        </div>
      </div>

      <div className="stack">
        {/* Phase 90: this company's plan is paid by another company in its group. */}
        {coveredBy && (
          <div className="notice teal"><Info /><span className="grow">{t("group.coveredBy").replace("{company}", coveredBy.companyName ?? "—")}</span><span className="actions"><Link href="/dashboard/group?tab=companies" className="btn btn-sm btn-outline-navy">{t("dashboard.nav.group")}</Link></span></div>
        )}
        {/* Current plan */}
        {isActive ? (
          <div className="card">
            <div className="card-head">
              <div className="flex items-center gap-3">
                <div className="qa-ic navy">{isPro ? <Crown className="h-6 w-6" /> : <Zap className="h-6 w-6" />}</div>
                <div>
                  <h2>QuoteAI {planLabel}</h2>
                  <p className="sub">{planPrice}</p>
                </div>
              </div>
              <span className="chip chip-green"><CheckCircle2 className="h-3 w-3 mr-1" />{t("dashboard.billing.active")}</span>
            </div>

            <div className="p-5 space-y-5">
              {/* Quota bar — only for Starter */}
              {isStarter && sub.quotaUsed != null && sub.quotaLimit != null && (
                <div className="p-4 rounded-[14px]" style={{ background: "var(--soft)", border: "1px solid var(--line)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-navy-500" />
                    <span className="text-sm font-semibold">{t("dashboard.billing.monthlyUsage")}</span>
                  </div>
                  <QuotaBar used={sub.quotaUsed} limit={sub.quotaLimit} />
                  {resetDate && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      {t("dashboard.billing.quotaResetsOn").replace("{date}", resetDate)}
                    </p>
                  )}
                  {(sub.quotaRemaining ?? 0) <= 3 && (sub.quotaRemaining ?? 0) > 0 && (
                    <div className="mt-3 flex items-start gap-2 text-xs p-2.5 rounded-[10px]" style={{ background: "var(--yellow-t)", color: "var(--yellow-dark)", border: "1px solid var(--yellow-t)" }}>
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {t("dashboard.billing.almostOutWarning")}
                    </div>
                  )}
                  {(sub.quotaRemaining ?? 0) === 0 && (
                    <div className="mt-3 flex items-start gap-2 text-xs p-2.5 rounded-[10px]" style={{ background: "var(--red-t)", color: "var(--red)", border: "1px solid var(--red-t)" }}>
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {t("dashboard.billing.quotaExhausted")}
                    </div>
                  )}
                </div>
              )}

              {/* Plan features */}
              <div className="p-4 rounded-[14px]" style={{ background: "var(--soft)", border: "1px solid var(--line)" }}>
                <div className="text-sm font-semibold mb-3">{t("dashboard.billing.includedInPlan")}</div>
                <ul className="space-y-2">
                  {/* Phase 73: the live plan list is the source of truth (the old hard-coded list showed Starter's features to Elite). */}
                  {(Array.isArray(plans) ? plans.find((p) => p.id === sub?.plan)?.features : undefined)?.map((f) => <PlanFeature key={f} text={f} ok />) ?? (
                    isPro ? (
                      <>
                        <PlanFeature text={t("dashboard.billing.feature.unlimitedQuotes")} ok />
                        <PlanFeature text={t("dashboard.billing.feature.noWatermark")} ok />
                        <PlanFeature text={t("dashboard.billing.feature.ownLogo")} ok />
                      </>
                    ) : (
                      <>
                        <PlanFeature text={t("dashboard.billing.feature.upToQuotes").replace("{count}", String(sub?.quotaLimit ?? 20))} ok />
                        <PlanFeature text={t("dashboard.billing.feature.downloadablePdf")} ok />
                      </>
                    )
                  )}
                </ul>
              </div>

              {renewalDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  {t("dashboard.billing.nextRenewal")} <span className="font-medium text-foreground">{renewalDate}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                {isStarter && (
                  <button className="btn btn-navy btn-sm" onClick={handleManage} disabled={createPortal.isPending}>
                    {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                    {t("dashboard.billing.upgradeToPro")}
                  </button>
                )}
                <button className="btn btn-outline-navy btn-sm" onClick={handleManage} disabled={createPortal.isPending}>
                  <ArrowUpRight className="h-4 w-4" />
                  {t("dashboard.billing.manageSubscription")}
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                {t("dashboard.billing.managedByStripe")}
                {isLegalEntityConfigured() && <> {t("dashboard.billing.receiptsIssuedBy").replace("{entity}", LEGAL_ENTITY.legalName)}</>}
              </p>
            </div>
          </div>
        ) : (
          /* No active subscription */
          <div className="card">
            <div className="card-head">
              <div className="flex items-center gap-3">
                <div className="qa-ic" style={{ background: "var(--soft-2)", color: "var(--muted-mk)" }}><XCircle className="h-5 w-5" /></div>
                <div>
                  <h2>{t("dashboard.billing.noActiveSubTitle")}</h2>
                  <p className="sub">{t("dashboard.billing.noActiveSubDesc")}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 73: monthly / annual picker with in-place switching */}
        <div className="card">
          <div className="card-head">
            <div><h2>{t("dashboard.billing.comparePlansTitle")}</h2><p className="sub">{t("dashboard.billing.comparePlansDesc")}</p></div>
          </div>
          <div className="p-5">
            <PlanPicker />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanFeature({ text, ok }: { text: string; ok: boolean }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-foreground" : "text-[var(--muted-mk)] line-through"}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
      {text}
    </li>
  );
}
