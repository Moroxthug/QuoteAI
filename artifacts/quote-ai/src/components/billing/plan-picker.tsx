import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetPlans, useGetSubscription, useChangePlan, getGetSubscriptionQueryKey, type Plan, type SubscriptionInfo } from "@workspace/api-client-react";
import { CheckCircle2, Crown, Zap, Loader2, Sparkles, Info, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { forgetPilotPromo, pilotPromo } from "@/lib/pilot-promo";
import { cn } from "@/lib/utils";

// Phase 73: the one plan grid used by /dashboard/billing and Settings →
// Billing. Monthly / annual toggle (annual = 10 × monthly, "2 months free"),
// three tiers, and an in-place switch with proration for an active
// subscriber — or a Checkout redirect for everyone else.

type Interval = "month" | "year";
type Tier = "monthly_starter" | "monthly_pro" | "monthly_elite";
const TIERS: readonly Tier[] = ["monthly_starter", "monthly_pro", "monthly_elite"];

function money(n: number, lang: string): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
}

export function PlanPicker({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sub } = useGetSubscription();
  const { data: plans } = useGetPlans();
  const changePlan = useChangePlan();

  const annualAvailable = sub?.annualAvailable ?? false;
  const currentInterval: Interval = sub?.isActive && sub.interval === "year" ? "year" : "month";
  const [interval, setInterval] = useState<Interval>(annualAvailable ? currentInterval : "month");
  const [confirming, setConfirming] = useState<Tier | null>(null);
  const [pending, setPending] = useState<Tier | null>(null);

  const tiers = TIERS.map((id) => (Array.isArray(plans) ? plans.find((p) => p.id === id) : undefined)).filter((p): p is Plan => !!p);
  if (tiers.length === 0) return null;

  const effectiveInterval: Interval = interval === "year" && annualAvailable ? "year" : "month";
  const isCurrent = (tier: Tier) => !!sub?.isActive && sub.plan === tier && currentInterval === effectiveInterval;

  // Phase 81: the code the visitor picked up on /pilot. The server ignores
  // anything that is not its own configured pilot code, so this is a
  // convenience, not a grant — and it only reaches Checkout, which is the
  // only path that can apply a discount.
  const promoCode = sub?.isActive ? undefined : pilotPromo();

  const run = (tier: Tier) => {
    setPending(tier);
    setConfirming(null);
    changePlan.mutate(
      { data: { planType: tier, interval: effectiveInterval, ...(promoCode ? { promoCode } : {}) } },
      {
        onSuccess: async (r) => {
          if (r.mode === "checkout" && r.url) { window.location.href = r.url; return; }
          forgetPilotPromo();
          setPending(null);
          await queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
          toast({ title: t("billing.picker.switched"), description: t("billing.picker.switchedDesc") });
        },
        onError: () => {
          setPending(null);
          toast({ title: t("dashboard.settings.billing.errorStartPayment"), variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg seg-2" data-period={effectiveInterval === "year" ? "y" : "m"} role="group" aria-label={t("billing.picker.cadence")}>
          <div className="seg-thumb" aria-hidden="true" />
          <button type="button" className="seg-b" onClick={() => setInterval("month")} aria-pressed={effectiveInterval === "month"}>{t("billing.picker.monthly")}</button>
          <button type="button" className="seg-b" onClick={() => setInterval("year")} aria-pressed={effectiveInterval === "year"} disabled={!annualAvailable} title={annualAvailable ? undefined : t("billing.picker.annualUnavailable")}>
            {t("billing.picker.annual")}
          </button>
        </div>
        {annualAvailable ? (
          <span className="chip chip-green"><Sparkles className="h-3 w-3 mr-1" />{t("billing.picker.twoMonthsFree")}</span>
        ) : (
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3.5 w-3.5" />{t("billing.picker.annualUnavailable")}</span>
        )}
      </div>

      {promoCode && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 shrink-0" />
          {t("billing.picker.promoApplied").replace("{code}", promoCode)}
        </p>
      )}

      <div className={cn("grid gap-4", compact ? "sm:grid-cols-3" : "md:grid-cols-3")}>
        {tiers.map((plan) => {
          const tier = plan.id as Tier;
          const isPro = tier === "monthly_pro";
          const isElite = tier === "monthly_elite";
          const yearly = plan.yearlyPrice ?? plan.price * 10;
          const price = effectiveInterval === "year" ? yearly : plan.price;
          const current = isCurrent(tier);
          const busy = pending === tier;
          const features = compact ? plan.features.slice(0, 4) : plan.features;
          return (
            <div key={plan.id} className={cn("card flex flex-col", current ? "border-2 border-emerald-300" : isPro ? "border-2 border-navy-300" : isElite ? "border-2 border-amber-300" : "")}>
              <div className="card-head pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isElite ? <Crown className="h-4 w-4 text-amber-600" /> : isPro ? <Crown className="h-4 w-4 text-navy-500" /> : <Zap className="h-4 w-4 text-navy-500" />}
                    <h2 className="text-lg">{plan.name}</h2>
                  </div>
                  {current ? (
                    <span className="chip chip-green"><CheckCircle2 className="h-3 w-3 mr-1" />{t("billing.picker.current")}</span>
                  ) : isPro ? (
                    <span className="chip chip-teal">{t("dashboard.settings.billing.mostPopular")}</span>
                  ) : null}
                </div>
                <p className="text-2xl font-extrabold mt-1">
                  {money(price, lang)}
                  <span className="text-sm font-normal text-muted-foreground">{effectiveInterval === "year" ? t("billing.picker.perYear") : t("billing.picker.perMonth")}</span>
                </p>
                {effectiveInterval === "year" && (
                  <p className="text-xs text-muted-foreground">{t("billing.picker.perMonthEquivalent").replace("{amount}", money(Math.round((yearly / 12) * 100) / 100, lang))}</p>
                )}
              </div>
              <div className="p-5 pt-3 flex-1">
                <ul className="space-y-1.5">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isElite ? "text-amber-500" : "text-navy-500")} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-foot pt-3 space-y-2">
                {confirming === tier && sub?.isActive ? (
                  <>
                    <p className="text-xs text-muted-foreground">{t("billing.picker.prorationNote")}</p>
                    <div className="flex flex-col gap-2">
                      <button type="button" className="btn btn-navy btn-sm w-full" onClick={() => run(tier)}>{t("billing.picker.confirmSwitch")}</button>
                      <button type="button" className="btn btn-outline-navy btn-sm w-full" onClick={() => setConfirming(null)}>{t("billing.picker.cancel")}</button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className={cn("btn w-full gap-2", current ? "btn-outline-navy" : isElite ? "btn-navy bg-amber-500 hover:bg-amber-600 border-0" : "btn-navy")}
                    disabled={current || busy || changePlan.isPending}
                    onClick={() => (sub?.isActive ? setConfirming(tier) : run(tier))}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                    {current
                      ? t("billing.picker.current")
                      : busy
                        ? t("dashboard.settings.billing.pleaseWait")
                        : sub?.isActive
                          ? t("billing.picker.switchTo").replace("{name}", plan.name)
                          : t("dashboard.settings.billing.choosePlan").replace("{name}", plan.name)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t("billing.picker.taxesNote")}</p>
    </div>
  );
}

/** "$49/month" / "$490/year" for the current-plan header, from the live plan list. */
export function currentPlanPriceLabel(sub: SubscriptionInfo | undefined, plans: Plan[] | undefined, t: (k: string) => string, lang: string): string | null {
  if (!sub?.isActive || !sub.plan || !Array.isArray(plans)) return null;
  const plan = plans.find((p) => p.id === sub.plan);
  if (!plan) return null;
  if (sub.interval === "year") return `${money(plan.yearlyPrice ?? plan.price * 10, lang)}${t("billing.picker.perYear")}`;
  return `${money(plan.price, lang)}${t("billing.picker.perMonth")}`;
}
