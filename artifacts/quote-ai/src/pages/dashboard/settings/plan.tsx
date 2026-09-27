import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetSubscription, useGetPlans, useCreateCustomerPortalSession, getGetSubscriptionQueryKey } from "@workspace/api-client-react";
import { AlertCircle, ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { usageApi } from "@/lib/usage-api";
import { moneyLocale } from "@/lib/money";
import { PlanPicker, currentPlanPriceLabel } from "@/components/billing/plan-picker";
import { LEGAL_ENTITY, isLegalEntityConfigured } from "@workspace/legal-entity";
import { ActionRow, SettingsGroup, SettingsSection } from "./ui";

export function planLabelOf(plan: string | null | undefined): string | null {
  return plan === "monthly_elite" ? "Elite" : plan === "monthly_business" ? "Business" : plan === "monthly_pro" ? "Pro" : plan === "monthly_starter" ? "Starter" : null;
}

/**
 * Plan & billing: the plan, this month's usage and the plan cards. Usage is
 * everyone's; the plan and its buttons need settings:full (the owner), as the
 * old Plan & Billing tab did.
 */
export function PlanSection() {
  const { t } = useLanguage();
  const can = useCan();
  const canBill = can("settings", "full");
  return (
    <SettingsSection title={t("settings.section.plan")} intro={canBill ? t("settings.intro.plan") : t("settings.intro.planMember")}>
      {canBill && <CurrentPlan />}
      <Usage />
      {canBill && <ComparePlans />}
    </SettingsSection>
  );
}

function useSyncSubscription() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const sync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/payments/sync-subscription", { method: "POST", credentials: "include" });
      const data = (await res.json()) as { synced: boolean; active?: boolean; plan?: string; message?: string };
      if (data.synced && data.active) {
        await queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
        toast({ title: t("dashboard.settings.billing.syncedTitle"), description: t("dashboard.settings.billing.syncedDesc").replace("{plan}", data.plan ?? "") });
      } else {
        toast({ title: t("dashboard.settings.billing.noSubFoundTitle"), description: data.message ?? t("dashboard.settings.billing.checkStripeDesc"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("dashboard.settings.billing.errorSync"), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };
  return { sync, syncing };
}

function CurrentPlan() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { data: sub, isLoading } = useGetSubscription();
  const { data: plans } = useGetPlans();
  const createPortal = useCreateCustomerPortalSession();
  const { sync, syncing } = useSyncSubscription();

  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const syncButton = (
    <button type="button" onClick={sync} disabled={syncing} className="btn btn-outline-navy btn-sm gap-2">
      {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {t("dashboard.settings.billing.verifySubscription")}
    </button>
  );

  if (!sub?.isActive) {
    return (
      <SettingsGroup>
        <ActionRow label={t("dashboard.billing.noActiveSubTitle")} help={t("dashboard.settings.billing.noActiveSubDesc")}>{syncButton}</ActionRow>
      </SettingsGroup>
    );
  }

  const isStarter = sub.plan === "monthly_starter";
  const label = planLabelOf(sub.plan);
  const price = currentPlanPriceLabel(sub, Array.isArray(plans) ? plans : undefined, t, lang)
    ?? (sub.plan === "monthly_elite" ? t("dashboard.billing.priceElite") : sub.plan === "monthly_business" ? t("dashboard.billing.priceBusiness") : sub.plan === "monthly_pro" ? t("dashboard.billing.pricePro") : isStarter ? t("dashboard.billing.priceStarter") : null);
  const renewal = sub.periodEnd ? new Date(sub.periodEnd).toLocaleDateString(moneyLocale(), { day: "2-digit", month: "long", year: "numeric" }) : null;
  const resetDate = sub.quotaResetDate ? new Date(sub.quotaResetDate).toLocaleDateString(moneyLocale(), { day: "2-digit", month: "long" }) : null;
  const manage = () => createPortal.mutate(undefined, {
    onSuccess: (r) => { window.open(r.url, "_blank"); },
    onError: () => toast({ title: t("dashboard.settings.billing.portalUnavailableTitle"), description: t("dashboard.settings.billing.portalUnavailableDesc"), variant: "destructive" }),
  });

  return (
    <SettingsGroup
      title={`QuoteAI ${label ?? ""}`.trim()}
      desc={[price, renewal && `${t("dashboard.billing.nextRenewal")} ${renewal}`].filter(Boolean).join(" · ")}
      action={<span className="chip chip-green">{t("dashboard.billing.active")}</span>}
    >
      {isStarter && sub.quotaUsed != null && sub.quotaLimit != null && (
        <div className="sgroup-pad">
          <Meter label={t("dashboard.billing.quotesUsed")} used={sub.quotaUsed} allowance={sub.quotaLimit} />
          {resetDate && <p className="smeter-note">{t("dashboard.billing.quotaResetsOn").replace("{date}", resetDate)}</p>}
          {(sub.quotaRemaining ?? 0) <= 3 && (sub.quotaRemaining ?? 0) > 0 && (
            <p className="notice warn" style={{ marginTop: 10 }}><AlertCircle aria-hidden="true" /><span>{t("dashboard.settings.billing.almostOutShort")}</span></p>
          )}
        </div>
      )}
      <ActionRow label={t("dashboard.billing.manageSubscription")} help={<>{t("dashboard.settings.billing.managedByStripeShort")}{isLegalEntityConfigured() && <> {t("dashboard.billing.receiptsIssuedBy").replace("{entity}", LEGAL_ENTITY.legalName)}</>}</>}>
        <button type="button" onClick={manage} disabled={createPortal.isPending} className="btn btn-outline-navy btn-sm gap-2">
          {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
          {t("settings.plan.openStripe")}
        </button>
      </ActionRow>
      <ActionRow label={t("dashboard.settings.billing.undetectedSubTitle")} help={t("dashboard.settings.billing.undetectedSubDesc")}>{syncButton}</ActionRow>
    </SettingsGroup>
  );
}

function Meter({ label, used, allowance }: { label: string; used: number; allowance: number | null }) {
  const pct = allowance ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  return (
    <div className="smeter">
      <div className="smeter-top">
        <span>{label}</span>
        <span>{used} {allowance !== null ? `/ ${allowance}` : "(unlimited)"}</span>
      </div>
      {allowance !== null && (
        <div className="hbar">
          <i style={{ width: `${pct}%`, background: pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--yellow-dark)" : "var(--green)" }} />
        </div>
      )}
    </div>
  );
}

function Usage() {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({ queryKey: ["usage-summary"], queryFn: usageApi.summary });
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;
  if (!data) return null;
  return (
    <SettingsGroup title={t("dashboard.settings.tabs.usage")} desc={t("dashboard.settings.usage.subtitle")}>
      <div className="sgroup-pad smeters">
        <Meter label={t("dashboard.settings.usage.receiptScans")} used={data.receiptScans.used} allowance={data.receiptScans.allowance} />
        <Meter label={t("dashboard.settings.usage.whatsappMessages")} used={data.whatsappMessages.used} allowance={data.whatsappMessages.allowance} />
        <Meter label={t("dashboard.settings.usage.smsMessages")} used={data.smsMessages?.used ?? 0} allowance={data.smsMessages?.allowance ?? null} />
        <p className="smeter-note">{t("dashboard.settings.usage.resetNote")}</p>
      </div>
    </SettingsGroup>
  );
}

function ComparePlans() {
  const { t } = useLanguage();
  return (
    <SettingsGroup title={t("dashboard.billing.comparePlansTitle")} desc={t("dashboard.billing.comparePlansDesc")}>
      <div className="sgroup-pad">
        <PlanPicker compact currentFirst />
      </div>
    </SettingsGroup>
  );
}
