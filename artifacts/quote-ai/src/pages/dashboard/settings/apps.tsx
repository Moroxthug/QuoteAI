import { SettingsSection } from "./ui";
import { useState, useEffect } from "react";
import { useGetSubscription, useCreateCheckoutSession, useGetQuickbooksStatus, getGetQuickbooksStatusQueryKey, useGetQuickbooksConnectUrl, getGetQuickbooksConnectUrlQueryKey, useDisconnectQuickbooks, useToggleQuickbooks, useGetQuickbooksAccounts, getGetQuickbooksAccountsQueryKey, useUpdateQuickbooksMapping, useGetQuickbooksSyncLog, getGetQuickbooksSyncLogQueryKey, useRetryQuickbooksSync, usePullQuickbooksPayments, useBackfillQuickbooksInvoices, useGetWaveStatus, getGetWaveStatusQueryKey, useGetWaveConnectUrl, getGetWaveConnectUrlQueryKey, useDisconnectWave, useToggleWave, useGetWaveAccounts, getGetWaveAccountsQueryKey, useUpdateWaveMapping, useGetWaveSyncLog, getGetWaveSyncLogQueryKey, useRetryWaveSync, useGetCalendarStatus, getGetCalendarStatusQueryKey, useGetCalendarConnectUrl, getGetCalendarConnectUrlQueryKey, useDisconnectCalendar, useToggleCalendar, type CalendarProvider, useGetEmailConnectionsStatus, getGetEmailConnectionsStatusQueryKey, useGetEmailConnectionConnectUrl, getGetEmailConnectionConnectUrlQueryKey, useDisconnectEmailConnection, useToggleEmailConnection } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Upload, Zap, CheckCircle2, XCircle, CalendarDays, AlertCircle, RefreshCw, Link2Off, Plug, Building2, CreditCard, Landmark, KeyRound, Webhook, Copy, Trash2, Mail, Banknote, Megaphone, Search } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";
import { CalendarFeedsCard } from "@/components/dashboard/calendar-feeds-card";
import { CalendarTargetPicker } from "@/components/dashboard/calendar-target-picker";
import { COST_CATEGORY_KEYS } from "@/components/jobs/cost-entry-dialog";
import { stripeConnectApi, financeitApi, developerApi, flinksApi, metaLeadAdsApi, googleLsaApi, type AutomationEventName, type FlinksAccountDto } from "@/lib/invoices-api";
import { NotAvailableNote } from "./shared";

function QuickbooksUpsellCard() {
  const { t } = useLanguage();
  const createCheckout = useCreateCheckoutSession();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckout = () => {
    setLoading(true);
    createCheckout.mutate(
      { data: { planType: "monthly_business" } },
      {
        onSuccess: (r) => { window.location.href = r.url; },
        onError: () => {
          setLoading(false);
          toast({ title: t("dashboard.settings.billing.errorStartPayment"), variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="card border-navy-200 bg-gradient-to-br from-navy-50 to-teal-50">
      <div className="card-head">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-navy-100 flex items-center justify-center">
            <Plug className="h-6 w-6 text-navy-500" />
          </div>
          <div>
            <h2>{t("dashboard.settings.quickbooksUpsell.title")}</h2>
            <p className="sub mt-0.5">{t("dashboard.settings.quickbooksUpsell.desc")}</p>
          </div>
        </div>
      </div>
      <div className="card-foot">
        <button onClick={handleCheckout} disabled={loading} className="btn btn-navy gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {t("dashboard.settings.quickbooksUpsell.cta")}
        </button>
      </div>
    </div>
  );
}

function QuickbooksMappingCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status } = useGetQuickbooksStatus();
  const { data: accounts, isLoading: loadingAccounts } = useGetQuickbooksAccounts({ query: { queryKey: getGetQuickbooksAccountsQueryKey(), enabled: !!status?.connected } });
  const updateMapping = useUpdateQuickbooksMapping();

  const [paymentAccountId, setPaymentAccountId] = useState<string>("");
  const [categoryAccountIds, setCategoryAccountIds] = useState<Record<string, string>>({});
  // Phase 88: the rest of the chart-of-accounts mapping, instead of fixed guesses.
  const [incomeAccountId, setIncomeAccountId] = useState<string>("");
  const [depositAccountId, setDepositAccountId] = useState<string>("");
  const [taxCodeIds, setTaxCodeIds] = useState<Record<string, string>>({});

  const paymentAccount = accounts?.paymentAccounts.find(a => a.id === paymentAccountId);
  const incomeAccount = accounts?.incomeAccounts.find(a => a.id === incomeAccountId);
  const depositAccount = accounts?.depositAccounts.find(a => a.id === depositAccountId);
  const taxSets = status?.taxSets ?? [];

  const handleSave = () => {
    const categoryMap: Record<string, { id: string; name: string } | null> = {};
    for (const c of COST_CATEGORY_KEYS) {
      const id = categoryAccountIds[c];
      const account = accounts?.expenseAccounts.find(a => a.id === id);
      categoryMap[c] = account ? { id: account.id, name: account.name } : null;
    }
    const taxCodeMap: Record<string, { id: string; name: string } | null> = {};
    for (const set of taxSets) {
      const code = accounts?.taxCodes.find(a => a.id === taxCodeIds[set]);
      if (code) taxCodeMap[set] = { id: code.id, name: code.name };
    }
    updateMapping.mutate(
      {
        data: {
          paymentAccount: paymentAccount ? { id: paymentAccount.id, name: paymentAccount.name } : undefined,
          categoryMap,
          incomeAccount: incomeAccount ? { id: incomeAccount.id, name: incomeAccount.name } : undefined,
          depositAccount: depositAccount ? { id: depositAccount.id, name: depositAccount.name } : undefined,
          taxCodeMap,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQuickbooksStatusQueryKey() });
          toast({ title: t("dashboard.settings.quickbooks.mappingSaved") });
        },
        onError: () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" }),
      }
    );
  };

  if (loadingAccounts) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.quickbooks.mappingTitle")}</h2>
        <p className="sub">{t("dashboard.settings.quickbooks.mappingDesc")}</p>
      </div>
      <div className="p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" id="qb-pay-label">{t("dashboard.settings.quickbooks.paymentAccount")}</label>
          <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
            <SelectTrigger id="qb-pay" aria-labelledby="qb-pay-label qb-pay">
              <SelectValue placeholder={status?.paymentAccountName ?? t("dashboard.settings.quickbooks.selectAccount")} />
            </SelectTrigger>
            <SelectContent>
              {accounts?.paymentAccounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" id="qb-income-label">{t("dashboard.settings.quickbooks.incomeAccount")}</label>
            <Select value={incomeAccountId} onValueChange={setIncomeAccountId}>
              <SelectTrigger id="qb-income" aria-labelledby="qb-income-label qb-income">
                <SelectValue placeholder={status?.incomeAccountName ?? t("dashboard.settings.quickbooks.firstIncome")} />
              </SelectTrigger>
              <SelectContent>
                {accounts?.incomeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" id="qb-deposit-label">{t("dashboard.settings.quickbooks.depositAccount")}</label>
            <Select value={depositAccountId} onValueChange={setDepositAccountId}>
              <SelectTrigger id="qb-deposit" aria-labelledby="qb-deposit-label qb-deposit">
                <SelectValue placeholder={status?.depositAccountName ?? t("dashboard.settings.quickbooks.undeposited")} />
              </SelectTrigger>
              <SelectContent>
                {accounts?.depositAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {taxSets.length > 0 && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t("dashboard.settings.quickbooks.taxCodes")}</label>
              <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.quickbooks.taxCodesHelp")}</p>
            </div>
            {taxSets.map((set, i) => (
              <div key={set} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-32 shrink-0" id={`qb-tax-${i}-label`}>{set === "none" ? t("dashboard.settings.quickbooks.noTax") : set}</span>
                {/* Phase 96: min-w-0 so a long placeholder ("Not mapped (tax included)") truncates at 375 instead of pushing the row wider than the phone. */}
                <div className="min-w-0 flex-1">
                  <Select value={taxCodeIds[set] ?? ""} onValueChange={(v) => setTaxCodeIds(prev => ({ ...prev, [set]: v }))}>
                    <SelectTrigger id={`qb-tax-${i}`} aria-labelledby={`qb-tax-${i}-label qb-tax-${i}`} className="w-full min-w-0 [&>span]:truncate">
                      <SelectValue placeholder={status?.taxCodeMap?.[set] ?? t("dashboard.settings.quickbooks.taxIncluded")} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.taxCodes.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-3">
          <label className="text-sm font-medium">{t("dashboard.settings.quickbooks.categoryMapping")}</label>
          {COST_CATEGORY_KEYS.map((c) => (
            <div key={c} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-32 shrink-0" id={`qb-cat-${c}-label`}>{t(`jobs.cost.${c}`)}</span>
              <Select
                value={categoryAccountIds[c] ?? ""}
                onValueChange={(v) => setCategoryAccountIds(prev => ({ ...prev, [c]: v }))}
              >
                <SelectTrigger id={`qb-cat-${c}`} aria-labelledby={`qb-cat-${c}-label qb-cat-${c}`}>
                  <SelectValue placeholder={status?.categoryMap?.[c] ?? t("dashboard.settings.quickbooks.selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.expenseAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
      <div className="card-foot">
        <button onClick={handleSave} disabled={updateMapping.isPending} className="btn btn-navy gap-2">
          {updateMapping.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("dashboard.settings.quickbooks.saveMapping")}
        </button>
      </div>
    </div>
  );
}

/** Phase 88: payments recorded in QuickBooks come back; invoices already out go over. */
function QuickbooksTwoWayCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status } = useGetQuickbooksStatus();
  const updateMapping = useUpdateQuickbooksMapping();
  const pull = usePullQuickbooksPayments();
  const backfill = useBackfillQuickbooksInvoices();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetQuickbooksStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetQuickbooksSyncLogQueryKey() });
  };
  const onError = () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" });
  const pullOn = status?.pullPayments ?? true;

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.quickbooks.twoWayTitle")}</h2>
        <p className="sub">{t("dashboard.settings.quickbooks.twoWayDesc")}</p>
      </div>
      <div className="p-5 space-y-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={pullOn}
            disabled={updateMapping.isPending}
            onChange={(e) => updateMapping.mutate({ data: { pullPayments: e.target.checked } }, { onSuccess: refresh, onError })}
          />
          <span>
            <span className="font-medium">{t("dashboard.settings.quickbooks.pullPayments")}</span>
            <span className="block text-xs text-muted-foreground">
              {status?.paymentsPulledAt ? `${t("dashboard.settings.quickbooks.lastPulled")} ${new Date(status.paymentsPulledAt).toLocaleString()}` : t("dashboard.settings.quickbooks.neverPulled")}
            </span>
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn btn-outline-navy btn-sm gap-2"
            disabled={pull.isPending}
            onClick={() => pull.mutate(undefined, {
              onSuccess: (r) => { refresh(); toast({ title: t("dashboard.settings.quickbooks.pulled").replace("{n}", String(r.recorded)).replace("{c}", String(r.conflicts)) }); },
              onError,
            })}
          >
            {pull.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {t("dashboard.settings.quickbooks.pullNow")}
          </button>
          <button
            className="btn btn-outline-navy btn-sm gap-2"
            disabled={backfill.isPending}
            onClick={() => backfill.mutate(undefined, {
              onSuccess: (r) => { refresh(); toast({ title: t("dashboard.settings.quickbooks.backfilled").replace("{n}", String(r.invoices)).replace("{p}", String(r.payments)) }); },
              onError,
            })}
          >
            {backfill.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {t("dashboard.settings.quickbooks.backfill")}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t("dashboard.settings.quickbooks.twoWayFoot")}</p>
      </div>
    </div>
  );
}

function QuickbooksSyncLogCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: log } = useGetQuickbooksSyncLog();
  const retry = useRetryQuickbooksSync();

  if (!log || log.entries.length === 0) return null;

  const handleRetry = (entityType: string, entityId: string) => {
    retry.mutate(
      { data: { entityType: entityType as "invoice" | "cost_entry" | "invoice_payment", entityId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQuickbooksSyncLogQueryKey() });
          toast({ title: t("dashboard.settings.quickbooks.retried") });
        },
        onError: () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" }),
      }
    );
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.quickbooks.syncLogTitle")}</h2>
      </div>
      <div className="p-5 space-y-2">
        {log.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {e.status === "synced" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{t(`dashboard.settings.quickbooks.entity.${e.entityType}`)}</p>
                {e.error && <p className="text-xs text-red-600 truncate">{e.error}</p>}
              </div>
            </div>
            {e.status === "failed" && e.entityType !== "payment_pull" && (
              <button className="btn btn-outline-navy btn-sm gap-1.5 shrink-0" onClick={() => handleRetry(e.entityType, e.entityId)} disabled={retry.isPending}>
                <RefreshCw className="h-3.5 w-3.5" /> {t("dashboard.settings.quickbooks.retry")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickbooksTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetQuickbooksStatus();
  const { data: subscription } = useGetSubscription();
  const getConnectUrl = useGetQuickbooksConnectUrl({ query: { queryKey: getGetQuickbooksConnectUrlQueryKey(), enabled: false } });
  const disconnectQb = useDisconnectQuickbooks();
  const toggleQb = useToggleQuickbooks();

  const isElite = (subscription?.plan === "monthly_business" || subscription?.plan === "monthly_elite") && subscription?.isActive;
  const isConnected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" });
  };

  const handleDisconnect = () => {
    disconnectQb.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuickbooksStatusQueryKey() });
        toast({ title: t("dashboard.settings.quickbooks.disconnected") });
      },
      onError: () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" }),
    });
  };

  const handleToggle = () => {
    toggleQb.mutate(
      { data: { isEnabled: !isEnabled } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetQuickbooksStatusQueryKey() }),
        onError: () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;
  if (!isElite) return <QuickbooksUpsellCard />;

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-emerald-100 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2>{t("dashboard.settings.quickbooks.connectTitle")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.quickbooks.connectDesc")}</p>
            </div>
          </div>
        </div>
        <div className="card-foot">
          {status?.available === false ? <NotAvailableNote /> : (
            <button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="btn btn-navy gap-2">
              {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("dashboard.settings.quickbooks.connectCta")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
        <div className="card-head pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-emerald-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg">{status?.companyName || t("dashboard.settings.quickbooks.connectedTitle")}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.settings.quickbooks.connectedSince")} {status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ""}</p>
              </div>
            </div>
            <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
              {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
            </span>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {status?.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.quickbooks.lastSynced")} {new Date(status.lastSyncedAt).toLocaleString()}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            <button onClick={handleToggle} disabled={toggleQb.isPending} className="btn btn-navy btn-sm gap-2">
              {toggleQb.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
            </button>
            <button onClick={handleDisconnect} disabled={disconnectQb.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
              {disconnectQb.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              {t("dashboard.settings.quickbooks.disconnect")}
            </button>
          </div>
        </div>
      </div>
      <QuickbooksMappingCard />
          <QuickbooksTwoWayCard />
      <QuickbooksSyncLogCard />
    </div>
  );
}

function WaveUpsellCard() {
  const { t } = useLanguage();
  const createCheckout = useCreateCheckoutSession();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckout = () => {
    setLoading(true);
    createCheckout.mutate(
      { data: { planType: "monthly_business" } },
      {
        onSuccess: (r) => { window.location.href = r.url; },
        onError: () => {
          setLoading(false);
          toast({ title: t("dashboard.settings.billing.errorStartPayment"), variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="card border-navy-200 bg-gradient-to-br from-navy-50 to-teal-50">
      <div className="card-head">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-navy-100 flex items-center justify-center">
            <Plug className="h-6 w-6 text-navy-500" />
          </div>
          <div>
            <h2>{t("dashboard.settings.waveUpsell.title")}</h2>
            <p className="sub mt-0.5">{t("dashboard.settings.waveUpsell.desc")}</p>
          </div>
        </div>
      </div>
      <div className="card-foot">
        <button onClick={handleCheckout} disabled={loading} className="btn btn-navy gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {t("dashboard.settings.waveUpsell.cta")}
        </button>
      </div>
    </div>
  );
}

function WaveMappingCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status } = useGetWaveStatus();
  const { data: accounts, isLoading: loadingAccounts } = useGetWaveAccounts({ query: { queryKey: getGetWaveAccountsQueryKey(), enabled: !!status?.connected } });
  const updateMapping = useUpdateWaveMapping();

  const [paymentAccountId, setPaymentAccountId] = useState<string>("");
  const [incomeAccountId, setIncomeAccountId] = useState<string>("");
  const [categoryAccountIds, setCategoryAccountIds] = useState<Record<string, string>>({});

  const paymentAccount = accounts?.paymentAccounts.find(a => a.id === paymentAccountId);
  const incomeAccount = accounts?.incomeAccounts.find(a => a.id === incomeAccountId);

  const handleSave = () => {
    const categoryMap: Record<string, { id: string; name: string } | null> = {};
    for (const c of COST_CATEGORY_KEYS) {
      const id = categoryAccountIds[c];
      const account = accounts?.expenseAccounts.find(a => a.id === id);
      categoryMap[c] = account ? { id: account.id, name: account.name } : null;
    }
    updateMapping.mutate(
      {
        data: {
          paymentAccount: paymentAccount ? { id: paymentAccount.id, name: paymentAccount.name } : undefined,
          incomeAccount: incomeAccount ? { id: incomeAccount.id, name: incomeAccount.name } : undefined,
          categoryMap,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWaveStatusQueryKey() });
          toast({ title: t("dashboard.settings.wave.mappingSaved") });
        },
        onError: () => toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" }),
      }
    );
  };

  if (loadingAccounts) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.wave.mappingTitle")}</h2>
        <p className="sub">{t("dashboard.settings.wave.mappingDesc")}</p>
      </div>
      <div className="p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("dashboard.settings.wave.paymentAccount")}</label>
          <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
            <SelectTrigger>
              <SelectValue placeholder={status?.paymentAccountName ?? t("dashboard.settings.wave.selectAccount")} />
            </SelectTrigger>
            <SelectContent>
              {accounts?.paymentAccounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("dashboard.settings.wave.incomeAccount")}</label>
          <Select value={incomeAccountId} onValueChange={setIncomeAccountId}>
            <SelectTrigger>
              <SelectValue placeholder={status?.incomeAccountName ?? t("dashboard.settings.wave.selectAccount")} />
            </SelectTrigger>
            <SelectContent>
              {accounts?.incomeAccounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <label className="text-sm font-medium">{t("dashboard.settings.wave.categoryMapping")}</label>
          {COST_CATEGORY_KEYS.map((c) => (
            <div key={c} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-32 shrink-0">{t(`jobs.cost.${c}`)}</span>
              <Select
                value={categoryAccountIds[c] ?? ""}
                onValueChange={(v) => setCategoryAccountIds(prev => ({ ...prev, [c]: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={status?.categoryMap?.[c] ?? t("dashboard.settings.wave.selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.expenseAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
      <div className="card-foot">
        <button onClick={handleSave} disabled={updateMapping.isPending} className="btn btn-navy gap-2">
          {updateMapping.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("dashboard.settings.wave.saveMapping")}
        </button>
      </div>
    </div>
  );
}

function WaveSyncLogCard() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: log } = useGetWaveSyncLog();
  const retry = useRetryWaveSync();

  if (!log || log.entries.length === 0) return null;

  const handleRetry = (entityType: string, entityId: string) => {
    retry.mutate(
      { data: { entityType: entityType as "invoice" | "cost_entry", entityId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWaveSyncLogQueryKey() });
          toast({ title: t("dashboard.settings.wave.retried") });
        },
        onError: () => toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" }),
      }
    );
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.wave.syncLogTitle")}</h2>
      </div>
      <div className="p-5 space-y-2">
        {log.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {e.status === "synced" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{e.entityType === "invoice" ? t("dashboard.settings.wave.invoice") : t("dashboard.settings.wave.costEntry")}</p>
                {e.error && <p className="text-xs text-red-600 truncate">{e.error}</p>}
              </div>
            </div>
            {e.status === "failed" && (
              <button className="btn btn-outline-navy btn-sm gap-1.5 shrink-0" onClick={() => handleRetry(e.entityType, e.entityId)} disabled={retry.isPending}>
                <RefreshCw className="h-3.5 w-3.5" /> {t("dashboard.settings.wave.retry")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WaveTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetWaveStatus();
  const { data: subscription } = useGetSubscription();
  const getConnectUrl = useGetWaveConnectUrl({ query: { queryKey: getGetWaveConnectUrlQueryKey(), enabled: false } });
  const disconnectWaveMutation = useDisconnectWave();
  const toggleWaveMutation = useToggleWave();

  const isElite = (subscription?.plan === "monthly_business" || subscription?.plan === "monthly_elite") && subscription?.isActive;
  const isConnected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" });
  };

  const handleDisconnect = () => {
    disconnectWaveMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWaveStatusQueryKey() });
        toast({ title: t("dashboard.settings.wave.disconnected") });
      },
      onError: () => toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" }),
    });
  };

  const handleToggle = () => {
    toggleWaveMutation.mutate(
      { data: { isEnabled: !isEnabled } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWaveStatusQueryKey() }),
        onError: () => toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-[var(--radius)]" />;
  if (!isElite) return <WaveUpsellCard />;

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-emerald-100 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2>{t("dashboard.settings.wave.connectTitle")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.wave.connectDesc")}</p>
            </div>
          </div>
        </div>
        <div className="card-foot">
          {status?.available === false ? <NotAvailableNote /> : (
            <button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="btn btn-navy gap-2">
              {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("dashboard.settings.wave.connectCta")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
        <div className="card-head pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-emerald-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg">{status?.businessName || t("dashboard.settings.wave.connectedTitle")}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("dashboard.settings.wave.connectedSince")} {status?.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ""}</p>
              </div>
            </div>
            <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
              {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
            </span>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {status?.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.wave.lastSynced")} {new Date(status.lastSyncedAt).toLocaleString()}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            <button onClick={handleToggle} disabled={toggleWaveMutation.isPending} className="btn btn-navy btn-sm gap-2">
              {toggleWaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
            </button>
            <button onClick={handleDisconnect} disabled={disconnectWaveMutation.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
              {disconnectWaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              {t("dashboard.settings.wave.disconnect")}
            </button>
          </div>
        </div>
      </div>
      <WaveMappingCard />
      <WaveSyncLogCard />
    </div>
  );
}

function StripeConnectTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: subscription } = useGetSubscription();
  const { data: status, isLoading } = useQuery({ queryKey: ["stripe-connect-status"], queryFn: stripeConnectApi.status });
  const onboard = useMutation({
    mutationFn: stripeConnectApi.onboard,
    onSuccess: (r) => { window.location.href = r.url; },
    onError: () => toast({ title: t("dashboard.settings.stripeConnect.error"), variant: "destructive" }),
  });

  const isElite = (subscription?.plan === "monthly_business" || subscription?.plan === "monthly_elite") && subscription?.isActive;
  if (!isElite) return null; // the Integrations tab itself is Elite-only, but this keeps the card self-contained if that ever changes
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const chargesEnabled = status?.chargesEnabled ?? false;

  return (
    <div className={cn("card", connected && chargesEnabled ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50" : undefined)}>
      <div className="card-head">
        <div className="flex items-center gap-3">
          <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", connected && chargesEnabled ? "bg-emerald-100" : "bg-navy-100")}>
            <CreditCard className={cn("h-6 w-6", connected && chargesEnabled ? "text-emerald-600" : "text-navy-500")} />
          </div>
          <div>
            <h2>{t("dashboard.settings.stripeConnect.title")}</h2>
            <p className="sub mt-0.5">{t("dashboard.settings.stripeConnect.desc")}</p>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {connected && (
          <span className={cn("chip", chargesEnabled ? "chip-green" : "chip-yellow")}>
            {chargesEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.stripeConnect.active")}</> : <><AlertCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.stripeConnect.onboardingIncomplete")}</>}
          </span>
        )}
        {/* Phase 73: the platform fee is disclosed up front, before connecting. */}
        {status && (
          <p className="text-xs text-muted-foreground">
            {(status.applicationFeeBps ?? 0) > 0
              ? t("dashboard.settings.stripeConnect.fee").replace("{pct}", status.applicationFeePercent ?? "0")
              : t("dashboard.settings.stripeConnect.feeNone")}
          </p>
        )}
      </div>
      <div className="card-foot">
        {status?.available === false ? <NotAvailableNote /> : (
          <button onClick={() => onboard.mutate()} disabled={onboard.isPending} className="btn btn-navy gap-2">
            {onboard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {connected ? (chargesEnabled ? t("dashboard.settings.stripeConnect.manage") : t("dashboard.settings.stripeConnect.finishOnboarding")) : t("dashboard.settings.stripeConnect.connectCta")}
          </button>
        )}
      </div>
    </div>
  );
}

function FinanceitTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const { data: status, isLoading } = useQuery({ queryKey: ["financeit-status"], queryFn: financeitApi.status });
  const [dealerId, setDealerId] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["financeit-status"] });

  const saveDealer = useMutation({
    mutationFn: () => financeitApi.saveDealer(dealerId.trim()),
    onSuccess: () => { invalidate(); setDealerId(""); toast({ title: t("dashboard.settings.financeit.connected") }); },
    onError: () => toast({ title: t("dashboard.settings.financeit.error"), variant: "destructive" }),
  });
  const toggle = useMutation({
    mutationFn: (isEnabled: boolean) => financeitApi.toggle(isEnabled),
    onSuccess: invalidate,
    onError: () => toast({ title: t("dashboard.settings.financeit.error"), variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: financeitApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.financeit.disconnected") }); },
    onError: () => toast({ title: t("dashboard.settings.financeit.error"), variant: "destructive" }),
  });

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null; // the Integrations tab itself is Elite-only, but this keeps the card self-contained if that ever changes
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  return (
    <div className={cn("card", connected && isEnabled ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50" : undefined)}>
      <div className="card-head">
        <div className="flex items-center gap-3">
          <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", connected && isEnabled ? "bg-amber-100" : "bg-navy-100")}>
            <Landmark className={cn("h-6 w-6", connected && isEnabled ? "text-amber-600" : "text-navy-500")} />
          </div>
          <div>
            <h2>{t("dashboard.settings.financeit.title")}</h2>
            <p className="sub mt-0.5">{t("dashboard.settings.financeit.desc")}</p>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {connected ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.financeit.active")}</> : t("dashboard.settings.financeit.paused")}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">{t("dashboard.settings.financeit.dealerIdLabel")}: {status?.dealerId}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.financeit.dealerIdHelp")}</p>
            <Input
              value={dealerId}
              onChange={(e) => setDealerId(e.target.value)}
              placeholder={t("dashboard.settings.financeit.dealerIdPlaceholder")}
            />
          </div>
        )}
      </div>
      <div className="card-foot gap-2">
        {connected ? (
          <>
            <button onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="btn btn-outline-navy btn-sm gap-2">
              {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEnabled ? t("dashboard.settings.financeit.pause") : t("dashboard.settings.financeit.resume")}
            </button>
            <button onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
              {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              {t("dashboard.settings.financeit.disconnect")}
            </button>
          </>
        ) : status?.available === false ? (
          <NotAvailableNote />
        ) : (
          <button onClick={() => saveDealer.mutate()} disabled={!dealerId.trim() || saveDealer.isPending} className="btn btn-navy gap-2">
            {saveDealer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            {t("dashboard.settings.financeit.connectCta")}
          </button>
        )}
      </div>
    </div>
  );
}

function FlinksConnectDialog({ open, onOpenChange, onConnected }: { open: boolean; onOpenChange: (open: boolean) => void; onConnected: (accounts: FlinksAccountDto[]) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: connectUrlData, isLoading } = useQuery({ queryKey: ["flinks-connect-url"], queryFn: flinksApi.connectUrl, enabled: open, retry: false });
  const connectMutation = useMutation({
    mutationFn: ({ loginId, institutionName }: { loginId: string; institutionName: string }) => flinksApi.connect(loginId, institutionName),
    onSuccess: (r) => { onConnected(r.accounts); onOpenChange(false); },
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });

  useEffect(() => {
    if (!open) return;
    function handleMessage(event: MessageEvent) {
      const data = event.data as { step?: string; loginId?: string; institution?: string } | undefined;
      if (data?.step === "REDIRECT" && data.loginId) {
        connectMutation.mutate({ loginId: data.loginId, institutionName: data.institution ?? "Bank account" });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" tall>
        <DialogHeader>
          <DialogTitle>{t("dashboard.settings.flinks.connectTitle")}</DialogTitle>
          <DialogDescription>{t("dashboard.settings.flinks.connectDialogDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flush">
          {isLoading || !connectUrlData?.url ? (
            <div className="card-empty" style={{ flex: 1, display: "grid", placeItems: "center" }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--faint)" }} /></div>
          ) : (
            <iframe src={connectUrlData.url} title="Flinks Connect" style={{ width: "100%", height: "100%", border: 0, flex: 1 }} />
          )}
          {connectMutation.isPending && (
            <p className="foot-note" style={{ padding: "10px 22px", borderTop: "1px solid var(--soft)", display: "flex", alignItems: "center", gap: 8 }}><Loader2 className="h-3 w-3 animate-spin" /> {t("dashboard.settings.flinks.connecting")}</p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function FlinksAccountPicker({ accounts, onPick, isPending }: { accounts: FlinksAccountDto[]; onPick: (a: FlinksAccountDto) => void; isPending: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t("dashboard.settings.flinks.pickAccountHelp")}</p>
      {accounts.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={isPending}
          onClick={() => onPick(a)}
          className="w-full text-left px-3 py-2 rounded-[var(--radius-sm)] border border-border hover:border-amber-300 hover:bg-amber-50 transition-colors text-sm flex items-center justify-between disabled:opacity-50"
        >
          <span>{a.name}{a.last4 ? ` ••••${a.last4}` : ""}</span>
          <span className="text-xs text-muted-foreground">{a.institution}</span>
        </button>
      ))}
    </div>
  );
}

/** Phase 88: reconciliation moved to Books, where bank lines match payments as well as costs. */
function FlinksReconcileLink() {
  const { t } = useLanguage();
  return (
    <div className="card">
      <div className="card-foot" style={{ borderTop: "none" }}>
        <span className="text-sm text-muted-foreground">{t("dashboard.settings.flinks.movedToBooks")}</span>
        <Link href="/dashboard/books?tab=bank" className="btn btn-outline-navy btn-sm">{t("dashboard.settings.flinks.openBooks")}</Link>
      </div>
    </div>
  );
}

function FlinksTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const { data: status, isLoading } = useQuery({ queryKey: ["flinks-status"], queryFn: flinksApi.status });
  const [showConnect, setShowConnect] = useState(false);
  const [pendingAccounts, setPendingAccounts] = useState<FlinksAccountDto[] | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["flinks-status"] });
  const selectAccountMutation = useMutation({
    mutationFn: (a: FlinksAccountDto) => flinksApi.selectAccount(a),
    onSuccess: () => { invalidate(); setPendingAccounts(null); toast({ title: t("dashboard.settings.flinks.connected") }); },
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });
  const toggle = useMutation({
    mutationFn: (isEnabled: boolean) => flinksApi.toggle(isEnabled),
    onSuccess: invalidate,
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: flinksApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.flinks.disconnected") }); },
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });
  const sync = useMutation({
    mutationFn: flinksApi.sync,
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ["flinks-transactions"] }); },
    onError: () => toast({ title: t("dashboard.settings.flinks.error"), variant: "destructive" }),
  });

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null; // the Integrations tab itself is Elite-only, but this keeps the card self-contained if that ever changes
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;
  const hasAccount = !!status?.selectedAccount;

  return (
    <div className="space-y-4">
      <div className={cn("card", connected && hasAccount && isEnabled ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50" : undefined)}>
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", connected && hasAccount ? "bg-amber-100" : "bg-navy-100")}>
              <Banknote className={cn("h-6 w-6", connected && hasAccount ? "text-amber-600" : "text-navy-500")} />
            </div>
            <div>
              <h2>{t("dashboard.settings.flinks.title")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.flinks.desc")}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {!connected && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.flinks.connectHelp")}</p>
          )}
          {connected && !hasAccount && (
            pendingAccounts ? (
              <FlinksAccountPicker accounts={pendingAccounts} onPick={(a) => selectAccountMutation.mutate(a)} isPending={selectAccountMutation.isPending} />
            ) : (
              <p className="text-xs text-muted-foreground">{t("dashboard.settings.flinks.noAccountSelected")}</p>
            )
          )}
          {connected && hasAccount && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
                  {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.financeit.active")}</> : t("dashboard.settings.financeit.paused")}
                </span>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {status?.institutionName} — {status?.selectedAccount?.name}{status?.selectedAccount?.last4 ? ` ••••${status.selectedAccount.last4}` : ""}
                </p>
                {status?.lastSyncedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.flinks.lastSynced")} {new Date(status.lastSyncedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="card-foot gap-2 flex-wrap">
          {!connected ? (
            status?.available === false ? <NotAvailableNote /> : (
              <button onClick={() => setShowConnect(true)} className="btn btn-navy gap-2">
                <Plug className="h-4 w-4" />
                {t("dashboard.settings.flinks.connectCta")}
              </button>
            )
          ) : (
            <>
              {hasAccount && (
                <button onClick={() => sync.mutate()} disabled={sync.isPending} className="btn btn-outline-navy btn-sm gap-2">
                  {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t("dashboard.settings.flinks.syncNow")}
                </button>
              )}
              <button onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="btn btn-outline-navy btn-sm gap-2">
                {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.financeit.pause") : t("dashboard.settings.financeit.resume")}
              </button>
              <button onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.flinks.disconnect")}
              </button>
            </>
          )}
        </div>
      </div>
      {connected && hasAccount && <FlinksReconcileLink />}
      <FlinksConnectDialog
        open={showConnect}
        onOpenChange={setShowConnect}
        onConnected={(accounts) => { setPendingAccounts(accounts); invalidate(); }}
      />
    </div>
  );
}

function MetaLeadAdsImportLogCard() {
  const { t } = useLanguage();
  const { data: log } = useQuery({ queryKey: ["meta-lead-ads-import-log"], queryFn: metaLeadAdsApi.importLog });

  if (!log || log.entries.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.metaLeadAds.importLogTitle")}</h2>
      </div>
      <div className="p-5 space-y-2">
        {log.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {e.status === "imported" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{new Date(e.createdAt).toLocaleString()}</p>
                {e.error && <p className="text-xs text-red-600 truncate">{e.error}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetaLeadAdsTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const { data: status, isLoading } = useQuery({ queryKey: ["meta-lead-ads-status"], queryFn: metaLeadAdsApi.status });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["meta-lead-ads-status"] });
  const getConnectUrl = useQuery({ queryKey: ["meta-lead-ads-connect-url"], queryFn: metaLeadAdsApi.connectUrl, enabled: false });
  const toggle = useMutation({
    mutationFn: (isEnabled: boolean) => metaLeadAdsApi.toggle(isEnabled),
    onSuccess: invalidate,
    onError: () => toast({ title: t("dashboard.settings.metaLeadAds.error"), variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: metaLeadAdsApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.metaLeadAds.disconnected") }); },
    onError: () => toast({ title: t("dashboard.settings.metaLeadAds.error"), variant: "destructive" }),
  });

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null; // the Integrations tab itself is Elite-only, but this keeps the card self-contained if that ever changes
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.metaLeadAds.error"), variant: "destructive" });
  };

  return (
    <div className="space-y-4">
      <div className={cn("card", connected && isEnabled ? "border-blue-200 bg-gradient-to-br from-blue-50 to-navy-50" : undefined)}>
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", connected ? "bg-blue-100" : "bg-navy-100")}>
              <Megaphone className={cn("h-6 w-6", connected ? "text-blue-600" : "text-navy-500")} />
            </div>
            <div>
              <h2>{t("dashboard.settings.metaLeadAds.title")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.metaLeadAds.desc")}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {!connected && (
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.metaLeadAds.connectHelp")}</p>
          )}
          {connected && (
            <div>
              <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">{status?.pageName}</p>
              {status?.lastLeadAt && (
                <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.metaLeadAds.lastLead")} {new Date(status.lastLeadAt).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
        <div className="card-foot gap-2 flex-wrap">
          {!connected ? (
            status?.available === false ? <NotAvailableNote /> : (
              <button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="btn btn-navy gap-2">
                {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                {t("dashboard.settings.metaLeadAds.connectCta")}
              </button>
            )
          ) : (
            <>
              <button onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="btn btn-outline-navy btn-sm gap-2">
                {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
              </button>
              <button onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.metaLeadAds.disconnect")}
              </button>
            </>
          )}
        </div>
      </div>
      {connected && <MetaLeadAdsImportLogCard />}
    </div>
  );
}

function GoogleLsaImportLogCard() {
  const { t } = useLanguage();
  const { data: log } = useQuery({ queryKey: ["google-lsa-import-log"], queryFn: googleLsaApi.importLog });

  if (!log || log.entries.length === 0) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="text-base">{t("dashboard.settings.googleLsa.importLogTitle")}</h2>
      </div>
      <div className="p-5 space-y-2">
        {log.entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {e.status === "imported" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{new Date(e.createdAt).toLocaleString()}</p>
                {e.error && <p className="text-xs text-red-600 truncate">{e.error}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoogleLsaTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const { data: status, isLoading } = useQuery({ queryKey: ["google-lsa-status"], queryFn: googleLsaApi.status });
  const [lsaCustomerId, setLsaCustomerId] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["google-lsa-status"] });
  const toggle = useMutation({
    mutationFn: (isEnabled: boolean) => googleLsaApi.toggle(isEnabled),
    onSuccess: invalidate,
    onError: () => toast({ title: t("dashboard.settings.googleLsa.error"), variant: "destructive" }),
  });
  const disconnect = useMutation({
    mutationFn: googleLsaApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.googleLsa.disconnected") }); },
    onError: () => toast({ title: t("dashboard.settings.googleLsa.error"), variant: "destructive" }),
  });
  const connect = useMutation({
    mutationFn: (id: string) => googleLsaApi.connectUrl(id),
    onSuccess: (result) => { if (result.url) window.location.href = result.url; else toast({ title: t("dashboard.settings.googleLsa.error"), variant: "destructive" }); },
    onError: () => toast({ title: t("dashboard.settings.googleLsa.error"), variant: "destructive" }),
  });

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;
  if (!isElite) return null; // the Integrations tab itself is Elite-only, but this keeps the card self-contained if that ever changes
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  const connected = status?.connected ?? false;
  const isEnabled = status?.isEnabled ?? true;

  return (
    <div className="space-y-4">
      <div className={cn("card", connected && isEnabled ? "border-blue-200 bg-gradient-to-br from-blue-50 to-navy-50" : undefined)}>
        <div className="card-head">
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center", connected ? "bg-blue-100" : "bg-navy-100")}>
              <Search className={cn("h-6 w-6", connected ? "text-blue-600" : "text-navy-500")} />
            </div>
            <div>
              <h2>{t("dashboard.settings.googleLsa.title")}</h2>
              <p className="sub mt-0.5">{t("dashboard.settings.googleLsa.desc")}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {!connected && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("dashboard.settings.googleLsa.connectHelp")}</p>
              <Input
                value={lsaCustomerId}
                onChange={(e) => setLsaCustomerId(e.target.value)}
                placeholder={t("dashboard.settings.googleLsa.customerIdPlaceholder")}
                className="max-w-xs"
              />
            </div>
          )}
          {connected && (
            <div>
              <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
                {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
              </span>
              <p className="text-xs text-muted-foreground mt-1.5">{status?.lsaCustomerId}</p>
              {status?.lastLeadAt && (
                <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.googleLsa.lastLead")} {new Date(status.lastLeadAt).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
        <div className="card-foot gap-2 flex-wrap">
          {!connected ? (
            status?.available === false ? <NotAvailableNote /> : (
              <button onClick={() => connect.mutate(lsaCustomerId)} disabled={connect.isPending || !lsaCustomerId.trim()} className="btn btn-navy gap-2">
                {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                {t("dashboard.settings.googleLsa.connectCta")}
              </button>
            )
          ) : (
            <>
              <button onClick={() => toggle.mutate(!isEnabled)} disabled={toggle.isPending} className="btn btn-outline-navy btn-sm gap-2">
                {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
              </button>
              <button onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
                {t("dashboard.settings.googleLsa.disconnect")}
              </button>
            </>
          )}
        </div>
      </div>
      {connected && <GoogleLsaImportLogCard />}
    </div>
  );
}

function DeveloperApiTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const { data: keysData, isLoading: keysLoading } = useQuery({ queryKey: ["developer-api-keys"], queryFn: developerApi.listKeys });
  const { data: webhooksData, isLoading: webhooksLoading } = useQuery({ queryKey: ["developer-webhooks"], queryFn: developerApi.listWebhooks });
  const [keyName, setKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<AutomationEventName[]>([]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const isElite = subscription?.plan === "monthly_elite" && subscription?.isActive;

  const createKey = useMutation({
    mutationFn: () => developerApi.createKey(keyName.trim()),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["developer-api-keys"] });
      setKeyName("");
      setRevealedKey(res.rawKey);
    },
    onError: () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" }),
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => developerApi.revokeKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-api-keys"] }),
    onError: () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" }),
  });
  const createWebhook = useMutation({
    mutationFn: () => developerApi.createWebhook(webhookUrl.trim(), webhookEvents),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] });
      setWebhookUrl("");
      setWebhookEvents([]);
      setRevealedSecret(res.secret);
    },
    onError: () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" }),
  });
  const toggleWebhook = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => developerApi.toggleWebhook(id, isEnabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] }),
    onError: () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" }),
  });
  const deleteWebhook = useMutation({
    mutationFn: (id: string) => developerApi.deleteWebhook(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["developer-webhooks"] }),
    onError: () => toast({ title: t("dashboard.settings.developerApi.error"), variant: "destructive" }),
  });

  if (!isElite) return null;

  const keys = keysData?.items ?? [];
  const events = keysData?.events ?? webhooksData?.events ?? [];
  const webhooks = webhooksData?.items ?? [];

  return (
    <div className="card">
      <div className="card-head">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center bg-slate-100">
            <KeyRound className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h2>{t("dashboard.settings.developerApi.title")}</h2>
            <p className="sub mt-0.5">{t("dashboard.settings.developerApi.desc")}</p>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-6">
        {/* API keys */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t("dashboard.settings.developerApi.apiKeys")}</h3>
          {revealedKey && (
            <div className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-xs text-amber-800">{t("dashboard.settings.developerApi.keyRevealWarning")}</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-card border rounded px-2 py-1.5 flex-1 overflow-x-auto">{revealedKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(revealedKey); toast({ title: t("dashboard.settings.developerApi.copied") }); }} className="btn btn-outline-navy btn-sm">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <button onClick={() => setRevealedKey(null)} className="btn btn-outline-navy btn-sm">{t("dashboard.settings.developerApi.dismiss")}</button>
            </div>
          )}
          {keysLoading ? <Skeleton className="h-16 w-full rounded-[var(--radius-sm)]" /> : (
            <div className="space-y-2">
              {keys.filter(k => !k.revokedAt).map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border p-2.5">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground">{k.keyPrefix}••••••••• · {k.role}</p>
                  </div>
                  <button className="btn btn-outline-navy btn-sm text-red-600 hover:text-red-700" onClick={() => revokeKey.mutate(k.id)} disabled={revokeKey.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder={t("dashboard.settings.developerApi.keyNamePlaceholder")} className="max-w-xs" />
            <button onClick={() => createKey.mutate()} disabled={!keyName.trim() || createKey.isPending} className="btn btn-navy btn-sm gap-2">
              {createKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {t("dashboard.settings.developerApi.createKey")}
            </button>
          </div>
        </div>

        {/* Webhooks */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Webhook className="h-4 w-4" /> {t("dashboard.settings.developerApi.webhooks")}</h3>
          {revealedSecret && (
            <div className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-xs text-amber-800">{t("dashboard.settings.developerApi.secretRevealWarning")}</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-card border rounded px-2 py-1.5 flex-1 overflow-x-auto">{revealedSecret}</code>
                <button onClick={() => { navigator.clipboard.writeText(revealedSecret); toast({ title: t("dashboard.settings.developerApi.copied") }); }} className="btn btn-outline-navy btn-sm">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <button onClick={() => setRevealedSecret(null)} className="btn btn-outline-navy btn-sm">{t("dashboard.settings.developerApi.dismiss")}</button>
            </div>
          )}
          {webhooksLoading ? <Skeleton className="h-16 w-full rounded-[var(--radius-sm)]" /> : (
            <div className="space-y-2">
              {webhooks.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border p-2.5">
                  <div>
                    <p className="text-sm font-medium break-all">{w.url}</p>
                    <p className="text-xs text-muted-foreground">{w.events.join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleWebhook.mutate({ id: w.id, isEnabled: !w.isEnabled })} disabled={toggleWebhook.isPending} className="btn btn-outline-navy btn-sm">
                      {w.isEnabled ? t("dashboard.settings.developerApi.pause") : t("dashboard.settings.developerApi.resume")}
                    </button>
                    <button className="btn btn-outline-navy btn-sm text-red-600 hover:text-red-700" onClick={() => deleteWebhook.mutate(w.id)} disabled={deleteWebhook.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder={t("dashboard.settings.developerApi.webhookUrlPlaceholder")} />
            <div className="flex flex-wrap gap-1.5">
              {events.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => setWebhookEvents((prev) => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev])}
                  className={cn("text-xs px-2 py-1 rounded-full border", webhookEvents.includes(ev) ? "bg-gray-900 text-white border-gray-900" : "bg-card text-muted-foreground border-border")}
                >
                  {ev}
                </button>
              ))}
            </div>
            <button onClick={() => createWebhook.mutate()} disabled={!webhookUrl.trim() || webhookEvents.length === 0 || createWebhook.isPending} className="btn btn-navy btn-sm gap-2">
              {createWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
              {t("dashboard.settings.developerApi.addWebhook")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const CALENDAR_PROVIDER_LABEL: Record<CalendarProvider, string> = { google: "Google Calendar", outlook: "Outlook" };

function CalendarProviderCard({ provider }: { provider: CalendarProvider }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetCalendarStatus();
  const getConnectUrl = useGetCalendarConnectUrl(provider, { query: { queryKey: getGetCalendarConnectUrlQueryKey(provider), enabled: false } });
  const disconnectCal = useDisconnectCalendar();
  const toggleCal = useToggleCalendar();

  const conn = status?.connections.find((c) => c.provider === provider);
  const isConnected = !!conn;
  const isEnabled = conn?.isEnabled ?? true;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetCalendarStatusQueryKey() });

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.calendar.error"), variant: "destructive" });
  };

  const handleDisconnect = () => {
    disconnectCal.mutate(
      { provider },
      { onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.calendar.disconnected") }); }, onError: () => toast({ title: t("dashboard.settings.calendar.error"), variant: "destructive" }) }
    );
  };

  const handleToggle = () => {
    toggleCal.mutate(
      { provider, data: { isEnabled: !isEnabled } },
      { onSuccess: invalidate, onError: () => toast({ title: t("dashboard.settings.calendar.error"), variant: "destructive" }) }
    );
  };

  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-head pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-sky-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-sky-600" />
            </div>
            <h2 className="text-base">{CALENDAR_PROVIDER_LABEL[provider]}</h2>
          </div>
        </div>
        <div className="card-foot">
          {status?.available?.[provider] === false ? <NotAvailableNote /> : (
            <button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="btn btn-outline-navy btn-sm gap-2">
              {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("dashboard.settings.calendar.connectCta")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card border-sky-200 bg-gradient-to-br from-sky-50 to-teal-50">
      <div className="card-head pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-sky-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-base">{CALENDAR_PROVIDER_LABEL[provider]}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{conn?.accountEmail}</p>
            </div>
          </div>
          <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
            {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
          </span>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {conn?.lastSyncedAt && (
          <p className="text-xs text-muted-foreground">{t("dashboard.settings.calendar.lastSynced")} {new Date(conn.lastSyncedAt).toLocaleString()}</p>
        )}
        {/* Phase 96: which of the account's calendars the events go to. */}
        <CalendarTargetPicker provider={provider} calendarId={conn?.calendarId ?? "primary"} calendarName={conn?.calendarName ?? null} onReconnect={() => void handleConnect()} />
        <div className="flex flex-wrap gap-3">
          <button onClick={handleToggle} disabled={toggleCal.isPending} className="btn btn-navy btn-sm gap-2">
            {toggleCal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
          </button>
          <button onClick={handleDisconnect} disabled={disconnectCal.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
            {disconnectCal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
            {t("dashboard.settings.calendar.disconnect")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarSyncTab() {
  const { t } = useLanguage();
  const { data: subscription } = useGetSubscription();
  const isElite = (subscription?.plan === "monthly_business" || subscription?.plan === "monthly_elite") && subscription?.isActive;
  if (!isElite) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{t("dashboard.settings.calendar.title")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.settings.calendar.desc")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CalendarProviderCard provider="google" />
        <CalendarProviderCard provider="outlook" />
      </div>
      {/* Phase 85: the half that needs no OAuth app — subscribe to any .ics
          feed, and publish our own schedule as one. */}
      <CalendarFeedsCard />
    </div>
  );
}


export function EmailConnectionCard() {
  const provider = "google" as const;
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetEmailConnectionsStatus();
  const getConnectUrl = useGetEmailConnectionConnectUrl(provider, { query: { queryKey: getGetEmailConnectionConnectUrlQueryKey(provider), enabled: false } });
  const disconnectEmail = useDisconnectEmailConnection();
  const toggleEmail = useToggleEmailConnection();

  const conn = status?.connections.find((c) => c.provider === provider);
  const isConnected = !!conn;
  const isEnabled = conn?.isEnabled ?? true;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetEmailConnectionsStatusQueryKey() });

  const handleConnect = async () => {
    const result = await getConnectUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
    else toast({ title: t("dashboard.settings.emailSend.error"), variant: "destructive" });
  };

  const handleDisconnect = () => {
    disconnectEmail.mutate(
      { provider },
      { onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.emailSend.disconnected") }); }, onError: () => toast({ title: t("dashboard.settings.emailSend.error"), variant: "destructive" }) }
    );
  };

  const handleToggle = () => {
    toggleEmail.mutate(
      { provider, data: { isEnabled: !isEnabled } },
      { onSuccess: invalidate, onError: () => toast({ title: t("dashboard.settings.emailSend.error"), variant: "destructive" }) }
    );
  };

  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-head pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-rose-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-rose-600" />
            </div>
            <h2 className="text-base">Gmail</h2>
          </div>
        </div>
        <div className="card-foot">
          {status?.available?.google === false ? <NotAvailableNote /> : (
            <button onClick={handleConnect} disabled={getConnectUrl.isFetching} className="btn btn-outline-navy btn-sm gap-2">
              {getConnectUrl.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {t("dashboard.settings.emailSend.connectCta")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50">
      <div className="card-head pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-rose-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-base">Gmail</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{conn?.accountEmail}</p>
            </div>
          </div>
          <span className={cn("chip", isEnabled ? "chip-green" : "chip-grey")}>
            {isEnabled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.active")}</> : <><XCircle className="h-3 w-3 mr-1" /> {t("dashboard.settings.whatsapp.disabled")}</>}
          </span>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {conn?.lastSendError ? (
          <p className="text-xs text-red-600">{t("dashboard.settings.emailSend.lastSendFailed")}</p>
        ) : conn?.lastSendAt ? (
          <p className="text-xs text-muted-foreground">{t("dashboard.settings.emailSend.lastSend")} {new Date(conn.lastSendAt).toLocaleString()}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button onClick={handleToggle} disabled={toggleEmail.isPending} className="btn btn-navy btn-sm gap-2">
            {toggleEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEnabled ? t("dashboard.settings.whatsapp.disable") : t("dashboard.settings.whatsapp.enable")}
          </button>
          <button onClick={handleDisconnect} disabled={disconnectEmail.isPending} className="btn btn-outline-navy btn-sm gap-2 text-red-600 hover:text-red-700">
            {disconnectEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
            {t("dashboard.settings.emailSend.disconnect")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Connected apps: payments, financing, accounting, bank feeds, lead sources,
 * calendars and the developer API — moved here as they were. Phase 103 turns
 * this into a directory of tiles.
 */
export function AppsSection() {
  const { t } = useLanguage();
  return (
    <SettingsSection title={t("settings.section.apps")} intro={t("settings.intro.apps")}>
      <StripeConnectTab />
      <FinanceitTab />
      <QuickbooksTab />
      <WaveTab />
      <FlinksTab />
      <MetaLeadAdsTab />
      <GoogleLsaTab />
      <CalendarSyncTab />
      <DeveloperApiTab />
    </SettingsSection>
  );
}
