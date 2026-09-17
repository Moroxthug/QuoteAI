import { useGetSubscription, useCreateCustomerPortalSession } from "@workspace/api-client-react";
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
  const { t } = useLanguage();
  const { data: sub, isLoading } = useGetSubscription();
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
  const planPrice = isPro ? t("dashboard.billing.pricePro") : isStarter ? t("dashboard.billing.priceStarter") : isElite ? t("dashboard.billing.priceElite") : null;

  const renewalDate = sub?.periodEnd
    ? new Date(sub.periodEnd).toLocaleDateString("en-CA", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const resetDate = sub?.quotaResetDate
    ? new Date(sub.quotaResetDate).toLocaleDateString("en-CA", { day: "2-digit", month: "long" })
    : null;

  const handleChoosePlan = () => {
    createPortal.mutate(undefined, {
      onSuccess: (r) => { window.open(r.url, "_blank"); },
      onError: () => { window.location.href = "/#pricing"; },
    });
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("dashboard.billing.title")}</h1>
          <p className="sub">{t("dashboard.billing.subtitle")}</p>
        </div>
      </div>

      <div className="stack">
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
                  {isPro ? (
                    <>
                      <PlanFeature text={t("dashboard.billing.feature.unlimitedQuotes")} ok />
                      <PlanFeature text={t("dashboard.billing.feature.noWatermark")} ok />
                      <PlanFeature text={t("dashboard.billing.feature.ownLogo")} ok />
                      <PlanFeature text={t("dashboard.billing.feature.customBranding")} ok />
                      <PlanFeature text={t("dashboard.billing.feature.aiPriority")} ok />
                    </>
                  ) : (
                    <>
                      <PlanFeature text={t("dashboard.billing.feature.upToQuotes").replace("{count}", String(sub?.quotaLimit ?? 20))} ok />
                      <PlanFeature text={t("dashboard.billing.feature.downloadablePdf")} ok />
                      <PlanFeature text={t("dashboard.billing.feature.emailSupport")} ok />
                      <PlanFeature text={t("dashboard.billing.feature.noWatermark")} ok={false} />
                      <PlanFeature text={t("dashboard.billing.feature.customLogo")} ok={false} />
                    </>
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

              <p className="text-xs text-muted-foreground">{t("dashboard.billing.managedByStripe")}</p>
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
            <div className="p-5">
              <button
                onClick={handleChoosePlan}
                disabled={createPortal.isPending}
                className="btn btn-navy"
              >
                {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                {t("dashboard.billing.choosePlan")}
              </button>
            </div>
          </div>
        )}

        {/* Compare plans — only shown to non-Pro */}
        {!isPro && (
          <div className="card">
            <div className="card-head">
              <div><h2>{t("dashboard.billing.comparePlansTitle")}</h2><p className="sub">{t("dashboard.billing.comparePlansDesc")}</p></div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Zap className="h-4 w-4 text-navy-500" />
                    {t("dashboard.billing.starterPlanLabel")}
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-navy-400 shrink-0" />
                      {t("dashboard.billing.compare.starterQuotes")}
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-navy-400 shrink-0" />
                      {t("dashboard.billing.compare.professionalPdf")}
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground line-through opacity-50">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      {t("dashboard.billing.compare.customLogo")}
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground line-through opacity-50">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      {t("dashboard.billing.compare.noWatermarkPdf")}
                    </li>
                  </ul>
                </div>
                <div className="space-y-2 border-l pl-4">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Crown className="h-4 w-4 text-amber-500" />
                    {t("dashboard.billing.proPlanLabel")}
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {t("dashboard.billing.compare.unlimitedQuotes")}
                    </li>
                    <li className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {t("dashboard.billing.compare.premiumPdf")}
                    </li>
                    <li className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {t("dashboard.billing.compare.ownLogo")}
                    </li>
                    <li className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {t("dashboard.billing.compare.noWatermark")}
                    </li>
                  </ul>
                </div>
              </div>
              {isStarter && (
                <div className="mt-5 pt-4 border-t flex justify-end">
                  <button className="btn btn-navy btn-sm" onClick={handleManage} disabled={createPortal.isPending}>
                    {createPortal.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />}
                    {t("dashboard.billing.upgradeToProArrow")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanFeature({ text, ok }: { text: string; ok: boolean }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-foreground" : "text-muted-foreground line-through opacity-50"}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
      {text}
    </li>
  );
}
