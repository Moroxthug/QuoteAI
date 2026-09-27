import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { googleLsaApi, metaLeadAdsApi } from "@/lib/invoices-api";
import { ActionRow, SettingsGroup, SettingsRow, ToggleRow } from "../ui";
import { AccountFacts, DisconnectRow, SyncLog, fmtDate, fmtDateTime } from "./ui";
import { STATUS_KEYS } from "./status";

// ── Meta Lead Ads (Facebook / Instagram) ─────────────────────────────────────

export function MetaLeadsPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: STATUS_KEYS.meta, queryFn: metaLeadAdsApi.status });
  const { data: log } = useQuery({ queryKey: ["meta-lead-ads-import-log"], queryFn: metaLeadAdsApi.importLog, enabled: !!status?.connected });
  const connectUrl = useQuery({ queryKey: ["meta-lead-ads-connect-url"], queryFn: metaLeadAdsApi.connectUrl, enabled: false });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: STATUS_KEYS.meta });
  const onError = () => toast({ title: t("dashboard.settings.metaLeadAds.error"), variant: "destructive" });
  const toggle = useMutation({ mutationFn: (v: boolean) => metaLeadAdsApi.toggle(v), onSuccess: invalidate, onError });
  const disconnect = useMutation({
    mutationFn: metaLeadAdsApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.metaLeadAds.disconnected") }); },
    onError,
  });
  const connect = async () => {
    const r = await connectUrl.refetch();
    if (r.data?.url) window.location.href = r.data.url;
    else onError();
  };
  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  if (!status?.connected) {
    return (
      <SettingsGroup>
        <ActionRow label={t("apps.meta_leads.connectLabel")} help={t("dashboard.settings.metaLeadAds.connectHelp")}>
          <button type="button" onClick={() => void connect()} disabled={connectUrl.isFetching} className="btn btn-sm btn-navy" data-primary-action>
            {connectUrl.isFetching ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plug aria-hidden="true" />}
            {t("dashboard.settings.metaLeadAds.connectCta")}
          </button>
        </ActionRow>
      </SettingsGroup>
    );
  }

  return (
    <>
      <SettingsGroup title={t("apps.detail.account")}>
        <AccountFacts facts={[
          [t("apps.meta_leads.page"), status.pageName ?? "—"],
          [t("apps.detail.connectedSince"), fmtDate(status.connectedAt) ?? "—"],
          [t("dashboard.settings.metaLeadAds.lastLead"), fmtDateTime(status.lastLeadAt) ?? t("apps.detail.never")],
        ]} />
        <ToggleRow label={t("apps.leads.importOn")} help={t("apps.leads.importOnHelp")} checked={status.isEnabled ?? true} disabled={toggle.isPending} onChange={(v) => toggle.mutate(v)} />
      </SettingsGroup>
      <SyncLog
        title={t("dashboard.settings.metaLeadAds.importLogTitle")}
        rows={(log?.entries ?? []).map((e) => ({ id: e.id, ok: e.status !== "failed", label: fmtDateTime(e.createdAt) ?? "", error: e.error }))}
        empty={t("apps.leads.logEmpty")}
      />
      <DisconnectRow name="Meta Lead Ads" pending={disconnect.isPending} onConfirm={() => disconnect.mutate()} />
    </>
  );
}

// ── Google Local Services Ads ────────────────────────────────────────────────

export function GoogleLsaPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: STATUS_KEYS.lsa, queryFn: googleLsaApi.status });
  const { data: log } = useQuery({ queryKey: ["google-lsa-import-log"], queryFn: googleLsaApi.importLog, enabled: !!status?.connected });
  const [customerId, setCustomerId] = useState("");
  const invalidate = () => queryClient.invalidateQueries({ queryKey: STATUS_KEYS.lsa });
  const onError = () => toast({ title: t("dashboard.settings.googleLsa.error"), variant: "destructive" });
  const toggle = useMutation({ mutationFn: (v: boolean) => googleLsaApi.toggle(v), onSuccess: invalidate, onError });
  const disconnect = useMutation({
    mutationFn: googleLsaApi.disconnect,
    onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.googleLsa.disconnected") }); },
    onError,
  });
  const connect = useMutation({
    mutationFn: (id: string) => googleLsaApi.connectUrl(id),
    onSuccess: (r) => { if (r.url) window.location.href = r.url; else onError(); },
    onError,
  });
  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  if (!status?.connected) {
    return (
      <SettingsGroup>
        <SettingsRow label={t("apps.google_lsa.customerId")} help={t("dashboard.settings.googleLsa.connectHelp")} htmlFor="lsa-customer">
          <input id="lsa-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder={t("dashboard.settings.googleLsa.customerIdPlaceholder")} inputMode="numeric" autoComplete="off" />
        </SettingsRow>
        <div className="app-group-foot">
          <button type="button" onClick={() => connect.mutate(customerId.trim())} disabled={connect.isPending || !customerId.trim()} className="btn btn-sm btn-navy" data-primary-action>
            {connect.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plug aria-hidden="true" />}
            {t("dashboard.settings.googleLsa.connectCta")}
          </button>
        </div>
      </SettingsGroup>
    );
  }

  return (
    <>
      <SettingsGroup title={t("apps.detail.account")}>
        <AccountFacts facts={[
          [t("apps.google_lsa.customerId"), status.lsaCustomerId ?? "—"],
          [t("apps.detail.connectedSince"), fmtDate(status.connectedAt) ?? "—"],
          [t("dashboard.settings.googleLsa.lastLead"), fmtDateTime(status.lastLeadAt) ?? t("apps.detail.never")],
        ]} />
        <ToggleRow label={t("apps.leads.importOn")} help={t("apps.leads.importOnHelp")} checked={status.isEnabled ?? true} disabled={toggle.isPending} onChange={(v) => toggle.mutate(v)} />
      </SettingsGroup>
      <SyncLog
        title={t("dashboard.settings.googleLsa.importLogTitle")}
        rows={(log?.entries ?? []).map((e) => ({ id: e.id, ok: e.status !== "failed", label: fmtDateTime(e.createdAt) ?? "", error: e.error }))}
        empty={t("apps.leads.logEmpty")}
      />
      <DisconnectRow name="Google Local Services" pending={disconnect.isPending} onConfirm={() => disconnect.mutate()} />
    </>
  );
}
