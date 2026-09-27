import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetQuickbooksStatus, getGetQuickbooksStatusQueryKey, useGetQuickbooksConnectUrl, getGetQuickbooksConnectUrlQueryKey, useDisconnectQuickbooks, useToggleQuickbooks,
  useGetQuickbooksAccounts, getGetQuickbooksAccountsQueryKey, useUpdateQuickbooksMapping, useGetQuickbooksSyncLog, getGetQuickbooksSyncLogQueryKey, useRetryQuickbooksSync,
  usePullQuickbooksPayments, useBackfillQuickbooksInvoices,
  useGetWaveStatus, getGetWaveStatusQueryKey, useGetWaveConnectUrl, getGetWaveConnectUrlQueryKey, useDisconnectWave, useToggleWave,
  useGetWaveAccounts, getGetWaveAccountsQueryKey, useUpdateWaveMapping, useGetWaveSyncLog, getGetWaveSyncLogQueryKey, useRetryWaveSync,
} from "@workspace/api-client-react";
import { Loader2, Plug, RefreshCw, Save, Upload } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { COST_CATEGORY_KEYS } from "@/components/jobs/cost-entry-dialog";
import { ActionRow, SettingsGroup, SettingsRow, ToggleRow } from "../ui";
import { AccountFacts, DisconnectRow, SyncLog, fmtDate, fmtDateTime, type SyncRow } from "./ui";
import { unresolvedFailures } from "./status";

type Account = { id: string; name: string };

/** One account picker row: the saved choice shows as the placeholder until something else is picked. */
function AccountSelect({ id, label, help, value, onChange, accounts, placeholder }: {
  id: string; label: string; help?: string; value: string; onChange: (v: string) => void; accounts: Account[] | undefined; placeholder: string;
}) {
  return (
    <SettingsRow label={label} help={help} htmlFor={id}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full min-w-0 [&>span]:truncate">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </SettingsRow>
  );
}

/**
 * Intuit requires its own "Connect to QuickBooks" button for app review
 * (public/brands/BRANDS.md). If the asset is missing, a plain button stands in.
 */
function ConnectToQuickBooks({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  const { t } = useLanguage();
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <button type="button" onClick={onClick} disabled={pending} className="btn btn-sm btn-navy" data-primary-action>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plug aria-hidden="true" />}
        {t("apps.quickbooks.connectButton")}
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={pending} className="app-c2qb" data-primary-action aria-label={t("apps.quickbooks.connectButton")}>
      <img src="/brands/quickbooks-connect.svg" alt="" onError={() => setBroken(true)} />
    </button>
  );
}

// ── QuickBooks Online ────────────────────────────────────────────────────────

function QuickbooksMapping() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status } = useGetQuickbooksStatus();
  const { data: accounts, isLoading } = useGetQuickbooksAccounts({ query: { queryKey: getGetQuickbooksAccountsQueryKey(), enabled: !!status?.connected } });
  const updateMapping = useUpdateQuickbooksMapping();
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [incomeAccountId, setIncomeAccountId] = useState("");
  const [depositAccountId, setDepositAccountId] = useState("");
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({});
  const [taxCodeIds, setTaxCodeIds] = useState<Record<string, string>>({});
  const taxSets = status?.taxSets ?? [];
  const pick = (list: Account[] | undefined, id: string) => {
    const a = list?.find((x) => x.id === id);
    return a ? { id: a.id, name: a.name } : undefined;
  };
  const changed = !!(paymentAccountId || incomeAccountId || depositAccountId || Object.keys(categoryIds).length || Object.keys(taxCodeIds).length);

  const save = () => {
    const categoryMap: Record<string, Account | null> = {};
    for (const c of COST_CATEGORY_KEYS) {
      if (categoryIds[c]) categoryMap[c] = pick(accounts?.expenseAccounts, categoryIds[c]) ?? null;
    }
    const taxCodeMap: Record<string, Account | null> = {};
    for (const set of taxSets) {
      const code = pick(accounts?.taxCodes, taxCodeIds[set] ?? "");
      if (code) taxCodeMap[set] = code;
    }
    updateMapping.mutate(
      {
        data: {
          paymentAccount: pick(accounts?.paymentAccounts, paymentAccountId),
          incomeAccount: pick(accounts?.incomeAccounts, incomeAccountId),
          depositAccount: pick(accounts?.depositAccounts, depositAccountId),
          categoryMap,
          taxCodeMap,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetQuickbooksStatusQueryKey() });
          setPaymentAccountId(""); setIncomeAccountId(""); setDepositAccountId(""); setCategoryIds({}); setTaxCodeIds({});
          toast({ title: t("dashboard.settings.quickbooks.mappingSaved") });
        },
        onError: () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" }),
      },
    );
  };

  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  return (
    <>
      <SettingsGroup title={t("dashboard.settings.quickbooks.mappingTitle")} desc={t("dashboard.settings.quickbooks.mappingDesc")}>
        <AccountSelect id="qb-pay" label={t("dashboard.settings.quickbooks.paymentAccount")} value={paymentAccountId} onChange={setPaymentAccountId}
          accounts={accounts?.paymentAccounts} placeholder={status?.paymentAccountName ?? t("dashboard.settings.quickbooks.selectAccount")} />
        <AccountSelect id="qb-income" label={t("dashboard.settings.quickbooks.incomeAccount")} value={incomeAccountId} onChange={setIncomeAccountId}
          accounts={accounts?.incomeAccounts} placeholder={status?.incomeAccountName ?? t("dashboard.settings.quickbooks.firstIncome")} />
        <AccountSelect id="qb-deposit" label={t("dashboard.settings.quickbooks.depositAccount")} value={depositAccountId} onChange={setDepositAccountId}
          accounts={accounts?.depositAccounts} placeholder={status?.depositAccountName ?? t("dashboard.settings.quickbooks.undeposited")} />
      </SettingsGroup>
      {taxSets.length > 0 && (
        <SettingsGroup title={t("dashboard.settings.quickbooks.taxCodes")} desc={t("dashboard.settings.quickbooks.taxCodesHelp")}>
          {taxSets.map((set, i) => (
            <AccountSelect key={set} id={`qb-tax-${i}`} label={set === "none" ? t("dashboard.settings.quickbooks.noTax") : set}
              value={taxCodeIds[set] ?? ""} onChange={(v) => setTaxCodeIds((p) => ({ ...p, [set]: v }))}
              accounts={accounts?.taxCodes} placeholder={status?.taxCodeMap?.[set] ?? t("dashboard.settings.quickbooks.taxIncluded")} />
          ))}
        </SettingsGroup>
      )}
      <SettingsGroup title={t("dashboard.settings.quickbooks.categoryMapping")}>
        {COST_CATEGORY_KEYS.map((c) => (
          <AccountSelect key={c} id={`qb-cat-${c}`} label={t(`jobs.cost.${c}`)} value={categoryIds[c] ?? ""}
            onChange={(v) => setCategoryIds((p) => ({ ...p, [c]: v }))}
            accounts={accounts?.expenseAccounts} placeholder={status?.categoryMap?.[c] ?? t("dashboard.settings.quickbooks.selectAccount")} />
        ))}
        <div className="app-group-foot">
          <button type="button" onClick={save} disabled={!changed || updateMapping.isPending} className="btn btn-sm btn-navy">
            {updateMapping.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {t("dashboard.settings.quickbooks.saveMapping")}
          </button>
        </div>
      </SettingsGroup>
    </>
  );
}

export function QuickbooksPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetQuickbooksStatus();
  const { data: log } = useGetQuickbooksSyncLog({ query: { queryKey: getGetQuickbooksSyncLogQueryKey(), enabled: !!status?.connected } });
  const getConnectUrl = useGetQuickbooksConnectUrl({ query: { queryKey: getGetQuickbooksConnectUrlQueryKey(), enabled: false } });
  const disconnect = useDisconnectQuickbooks();
  const toggle = useToggleQuickbooks();
  const updateMapping = useUpdateQuickbooksMapping();
  const pull = usePullQuickbooksPayments();
  const backfill = useBackfillQuickbooksInvoices();
  const retry = useRetryQuickbooksSync();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetQuickbooksStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetQuickbooksSyncLogQueryKey() });
  };
  const onError = () => toast({ title: t("dashboard.settings.quickbooks.error"), variant: "destructive" });

  const connect = async () => {
    const r = await getConnectUrl.refetch();
    if (r.data?.url) window.location.href = r.data.url;
    else onError();
  };

  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  if (!status?.connected) {
    return (
      <SettingsGroup>
        <ActionRow label={t("apps.quickbooks.connectLabel")} help={t("dashboard.settings.quickbooks.connectDesc")}>
          <ConnectToQuickBooks onClick={() => void connect()} pending={getConnectUrl.isFetching} />
        </ActionRow>
      </SettingsGroup>
    );
  }

  const failed = new Set(unresolvedFailures(log?.entries).map((e) => e.id));
  const rows: SyncRow[] = (log?.entries ?? []).filter((e) => e.status !== "failed" || failed.has(e.id)).map((e) => ({
    id: e.id,
    ok: e.status !== "failed",
    label: t(`dashboard.settings.quickbooks.entity.${e.entityType}`),
    error: e.status === "failed" ? e.error : null,
    when: fmtDateTime(e.createdAt),
    retry: e.entityType === "payment_pull" ? undefined : () => retry.mutate(
      { data: { entityType: e.entityType as "invoice" | "cost_entry" | "invoice_payment", entityId: e.entityId } },
      { onSuccess: () => { refresh(); toast({ title: t("dashboard.settings.quickbooks.retried") }); }, onError },
    ),
  }));

  return (
    <>
      <SettingsGroup title={t("apps.detail.account")}>
        <AccountFacts facts={[
          [t("apps.detail.company"), status.companyName || "—"],
          [t("apps.detail.connectedSince"), fmtDate(status.connectedAt) ?? "—"],
          [t("apps.detail.lastSync"), fmtDateTime(status.lastSyncedAt) ?? t("apps.detail.never")],
        ]} />
        <ToggleRow
          label={t("apps.quickbooks.syncOn")}
          help={t("apps.quickbooks.syncOnHelp")}
          checked={status.isEnabled ?? true}
          disabled={toggle.isPending}
          onChange={(v) => toggle.mutate({ data: { isEnabled: v } }, { onSuccess: refresh, onError })}
        />
      </SettingsGroup>
      <QuickbooksMapping />
      <SettingsGroup title={t("dashboard.settings.quickbooks.twoWayTitle")} desc={t("dashboard.settings.quickbooks.twoWayDesc")}>
        <ToggleRow
          label={t("dashboard.settings.quickbooks.pullPayments")}
          help={status.paymentsPulledAt ? `${t("dashboard.settings.quickbooks.lastPulled")} ${fmtDateTime(status.paymentsPulledAt)}` : t("dashboard.settings.quickbooks.neverPulled")}
          checked={status.pullPayments ?? true}
          disabled={updateMapping.isPending}
          onChange={(v) => updateMapping.mutate({ data: { pullPayments: v } }, { onSuccess: refresh, onError })}
        />
        <ActionRow label={t("dashboard.settings.quickbooks.pullNow")} help={t("dashboard.settings.quickbooks.twoWayFoot")}>
          <button type="button" className="btn btn-sm btn-outline-navy" disabled={pull.isPending}
            onClick={() => pull.mutate(undefined, {
              onSuccess: (r) => { refresh(); toast({ title: t("dashboard.settings.quickbooks.pulled").replace("{n}", String(r.recorded)).replace("{c}", String(r.conflicts)) }); },
              onError,
            })}>
            {pull.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            {t("apps.detail.runNow")}
          </button>
        </ActionRow>
        <ActionRow label={t("dashboard.settings.quickbooks.backfill")} help={t("apps.quickbooks.backfillHelp")}>
          <button type="button" className="btn btn-sm btn-outline-navy" disabled={backfill.isPending}
            onClick={() => backfill.mutate(undefined, {
              onSuccess: (r) => { refresh(); toast({ title: t("dashboard.settings.quickbooks.backfilled").replace("{n}", String(r.invoices)).replace("{p}", String(r.payments)) }); },
              onError,
            })}>
            {backfill.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            {t("apps.detail.send")}
          </button>
        </ActionRow>
      </SettingsGroup>
      <SyncLog title={t("dashboard.settings.quickbooks.syncLogTitle")} rows={rows} retrying={retry.isPending} empty={t("apps.detail.logEmpty")} />
      {/* Intuit's wording, the counterpart of its Connect button. */}
      <DisconnectRow name="QuickBooks" label={t("apps.quickbooks.disconnectLabel")} pending={disconnect.isPending}
        onConfirm={() => disconnect.mutate(undefined, { onSuccess: () => { refresh(); toast({ title: t("dashboard.settings.quickbooks.disconnected") }); }, onError })} />
    </>
  );
}

// ── Wave ─────────────────────────────────────────────────────────────────────

function WaveMapping() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status } = useGetWaveStatus();
  const { data: accounts, isLoading } = useGetWaveAccounts({ query: { queryKey: getGetWaveAccountsQueryKey(), enabled: !!status?.connected } });
  const updateMapping = useUpdateWaveMapping();
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [incomeAccountId, setIncomeAccountId] = useState("");
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({});
  const pick = (list: Account[] | undefined, id: string) => {
    const a = list?.find((x) => x.id === id);
    return a ? { id: a.id, name: a.name } : undefined;
  };
  const changed = !!(paymentAccountId || incomeAccountId || Object.keys(categoryIds).length);

  const save = () => {
    const categoryMap: Record<string, Account | null> = {};
    for (const c of COST_CATEGORY_KEYS) {
      if (categoryIds[c]) categoryMap[c] = pick(accounts?.expenseAccounts, categoryIds[c]) ?? null;
    }
    updateMapping.mutate(
      { data: { paymentAccount: pick(accounts?.paymentAccounts, paymentAccountId), incomeAccount: pick(accounts?.incomeAccounts, incomeAccountId), categoryMap } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWaveStatusQueryKey() });
          setPaymentAccountId(""); setIncomeAccountId(""); setCategoryIds({});
          toast({ title: t("dashboard.settings.wave.mappingSaved") });
        },
        onError: () => toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" }),
      },
    );
  };

  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  return (
    <SettingsGroup title={t("dashboard.settings.wave.mappingTitle")} desc={t("dashboard.settings.wave.mappingDesc")}>
      <AccountSelect id="wave-pay" label={t("dashboard.settings.wave.paymentAccount")} value={paymentAccountId} onChange={setPaymentAccountId}
        accounts={accounts?.paymentAccounts} placeholder={status?.paymentAccountName ?? t("dashboard.settings.wave.selectAccount")} />
      <AccountSelect id="wave-income" label={t("dashboard.settings.wave.incomeAccount")} value={incomeAccountId} onChange={setIncomeAccountId}
        accounts={accounts?.incomeAccounts} placeholder={status?.incomeAccountName ?? t("dashboard.settings.wave.selectAccount")} />
      {COST_CATEGORY_KEYS.map((c) => (
        <AccountSelect key={c} id={`wave-cat-${c}`} label={t(`jobs.cost.${c}`)} value={categoryIds[c] ?? ""}
          onChange={(v) => setCategoryIds((p) => ({ ...p, [c]: v }))}
          accounts={accounts?.expenseAccounts} placeholder={status?.categoryMap?.[c] ?? t("dashboard.settings.wave.selectAccount")} />
      ))}
      <div className="app-group-foot">
        <button type="button" onClick={save} disabled={!changed || updateMapping.isPending} className="btn btn-sm btn-navy">
          {updateMapping.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {t("dashboard.settings.wave.saveMapping")}
        </button>
      </div>
    </SettingsGroup>
  );
}

export function WavePanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetWaveStatus();
  const { data: log } = useGetWaveSyncLog({ query: { queryKey: getGetWaveSyncLogQueryKey(), enabled: !!status?.connected } });
  const getConnectUrl = useGetWaveConnectUrl({ query: { queryKey: getGetWaveConnectUrlQueryKey(), enabled: false } });
  const disconnect = useDisconnectWave();
  const toggle = useToggleWave();
  const retry = useRetryWaveSync();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetWaveStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetWaveSyncLogQueryKey() });
  };
  const onError = () => toast({ title: t("dashboard.settings.wave.error"), variant: "destructive" });

  const connect = async () => {
    const r = await getConnectUrl.refetch();
    if (r.data?.url) window.location.href = r.data.url;
    else onError();
  };

  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius)]" />;

  if (!status?.connected) {
    return (
      <SettingsGroup>
        <ActionRow label={t("apps.wave.connectLabel")} help={t("dashboard.settings.wave.connectDesc")}>
          <button type="button" onClick={() => void connect()} disabled={getConnectUrl.isFetching} className="btn btn-sm btn-navy" data-primary-action>
            {getConnectUrl.isFetching ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plug aria-hidden="true" />}
            {t("dashboard.settings.wave.connectCta")}
          </button>
        </ActionRow>
      </SettingsGroup>
    );
  }

  const failed = new Set(unresolvedFailures(log?.entries).map((e) => e.id));
  const rows: SyncRow[] = (log?.entries ?? []).filter((e) => e.status !== "failed" || failed.has(e.id)).map((e) => ({
    id: e.id,
    ok: e.status !== "failed",
    label: e.entityType === "invoice" ? t("dashboard.settings.wave.invoice") : t("dashboard.settings.wave.costEntry"),
    error: e.status === "failed" ? e.error : null,
    when: fmtDateTime(e.createdAt),
    retry: () => retry.mutate(
      { data: { entityType: e.entityType as "invoice" | "cost_entry", entityId: e.entityId } },
      { onSuccess: () => { refresh(); toast({ title: t("dashboard.settings.wave.retried") }); }, onError },
    ),
  }));

  return (
    <>
      <SettingsGroup title={t("apps.detail.account")}>
        <AccountFacts facts={[
          [t("apps.detail.business"), status.businessName || "—"],
          [t("apps.detail.connectedSince"), fmtDate(status.connectedAt) ?? "—"],
          [t("apps.detail.lastSync"), fmtDateTime(status.lastSyncedAt) ?? t("apps.detail.never")],
        ]} />
        <ToggleRow
          label={t("apps.wave.syncOn")}
          help={t("apps.wave.syncOnHelp")}
          checked={status.isEnabled ?? true}
          disabled={toggle.isPending}
          onChange={(v) => toggle.mutate({ data: { isEnabled: v } }, { onSuccess: refresh, onError })}
        />
      </SettingsGroup>
      <WaveMapping />
      <SyncLog title={t("dashboard.settings.wave.syncLogTitle")} rows={rows} retrying={retry.isPending} empty={t("apps.detail.logEmpty")} />
      <DisconnectRow name="Wave" pending={disconnect.isPending}
        onConfirm={() => disconnect.mutate(undefined, { onSuccess: () => { refresh(); toast({ title: t("dashboard.settings.wave.disconnected") }); }, onError })} />
    </>
  );
}
