import { useGetSubscription, useCreateCustomerPortalSession } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  CreditCard as CreditCardIcon,
} from "lucide-react";


function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const { t } = useLanguage();
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-navy-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t("dashboard.billing.quotesUsed")}</span>
        <span className="font-semibold">
          {used} / {limit}
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
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
      onSuccess: (r) => {
        window.open(r.url, "_blank");
      },
      onError: () =>
        toast({
          title: t("dashboard.billing.errorOpenPortal"),
          variant: "destructive",
        }),
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
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
    ? new Date(sub.periodEnd).toLocaleDateString("en-CA", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const resetDate = sub?.quotaResetDate
    ? new Date(sub.quotaResetDate).toLocaleDateString("en-CA", {
        day: "2-digit",
        month: "long",
      })
    : null;

  const handleChoosePlan = () => {
    createPortal.mutate(undefined, {
      onSuccess: (r) => { window.open(r.url, "_blank"); },
      onError: () => { window.location.href = "/#pricing"; },
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2"><CreditCardIcon className="h-7 w-7 text-navy-500" />{t("dashboard.billing.title")}</h1>
        <p className="text-slate-500 mt-1">
          {t("dashboard.billing.subtitle")}
        </p>
      </div>

      {/* Current plan card */}
      {isActive ? (
        <Card
          className={`border-2 ${isPro ? "border-amber-300 bg-gradient-to-br from-amber-50 to-navy-50" : "border-navy-200 bg-gradient-to-br from-navy-50 to-teal-50"}`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className={`h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center ${isPro ? "bg-amber-100" : "bg-navy-100"}`}
                >
                  {isPro ? (
                    <Crown className="h-6 w-6 text-amber-600" />
                  ) : (
                    <Zap className="h-6 w-6 text-navy-500" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-xl">QuoteAI {planLabel}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {planPrice}
                  </p>
                </div>
              </div>
              <Badge
                className={`text-xs ${isPro ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-navy-100 text-navy-700 border-navy-200"}`}
                variant="outline"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.billing.active")}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Quota bar — only for Starter */}
            {isStarter &&
              sub.quotaUsed != null &&
              sub.quotaLimit != null && (
                <div className="bg-card/70 rounded-[var(--radius)] p-4 border border-navy-100">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-navy-500" />
                    <span className="text-sm font-semibold">{t("dashboard.billing.monthlyUsage")}</span>
                  </div>
                  <QuotaBar
                    used={sub.quotaUsed}
                    limit={sub.quotaLimit}
                  />
                  {resetDate && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      {t("dashboard.billing.quotaResetsOn").replace("{date}", resetDate)}
                    </p>
                  )}
                  {(sub.quotaRemaining ?? 0) <= 3 && (sub.quotaRemaining ?? 0) > 0 && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[var(--radius-sm)] p-2.5">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {t("dashboard.billing.almostOutWarning")}
                    </div>
                  )}
                  {(sub.quotaRemaining ?? 0) === 0 && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-[var(--radius-sm)] p-2.5">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {t("dashboard.billing.quotaExhausted")}
                    </div>
                  )}
                </div>
              )}

            {/* Plan features */}
            <div className="bg-card/70 rounded-[var(--radius)] p-4 border border-navy-100">
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

            {/* Renewal info */}
            {renewalDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {t("dashboard.billing.nextRenewal")} <span className="font-medium text-foreground">{renewalDate}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-1">
              {isStarter && (
                <Button onClick={handleManage} disabled={createPortal.isPending} className="gap-2">
                  {createPortal.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crown className="h-4 w-4" />
                  )}
                  {t("dashboard.billing.upgradeToPro")}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleManage}
                disabled={createPortal.isPending}
                className="gap-2"
              >
                <ArrowUpRight className="h-4 w-4" />
                {t("dashboard.billing.manageSubscription")}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t("dashboard.billing.managedByStripe")}
            </p>
          </CardContent>
        </Card>
      ) : (
        /* No active subscription */
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-muted flex items-center justify-center">
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle>{t("dashboard.billing.noActiveSubTitle")}</CardTitle>
                <CardDescription className="mt-0.5">
                  {t("dashboard.billing.noActiveSubDesc")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <button
              onClick={handleChoosePlan}
              disabled={createPortal.isPending}
              className="btn-gradient inline-flex h-10 items-center justify-center px-5 text-sm font-semibold gap-2 disabled:opacity-60"
            >
              {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {t("dashboard.billing.choosePlan")}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Compare plans — only shown to non-Pro */}
      {!isPro && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.billing.comparePlansTitle")}</CardTitle>
            <CardDescription>{t("dashboard.billing.comparePlansDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
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
                <Button
                  onClick={handleManage}
                  disabled={createPortal.isPending}
                  size="sm"
                  className="gap-2"
                >
                  {createPortal.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Crown className="h-3.5 w-3.5" />
                  )}
                  {t("dashboard.billing.upgradeToProArrow")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlanFeature({ text, ok }: { text: string; ok: boolean }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-foreground" : "text-muted-foreground line-through opacity-50"}`}>
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 shrink-0" />
      )}
      {text}
    </li>
  );
}
