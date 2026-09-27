import { useQueryClient } from "@tanstack/react-query";
import {
  useGetEmailConnectionsStatus, getGetEmailConnectionsStatusQueryKey, useGetEmailConnectionConnectUrl, getGetEmailConnectionConnectUrlQueryKey,
  useDisconnectEmailConnection, useToggleEmailConnection,
} from "@workspace/api-client-react";
import { Loader2, Plug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { ActionRow, SettingsGroup, ToggleRow } from "../ui";
import { AccountFacts, DisconnectRow, fmtDateTime } from "./ui";

// ── Gmail: quotes and invoices sent from the company's own address (Phase 20) ──

export function GmailPanel() {
  const provider = "google" as const;
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetEmailConnectionsStatus();
  const getConnectUrl = useGetEmailConnectionConnectUrl(provider, { query: { queryKey: getGetEmailConnectionConnectUrlQueryKey(provider), enabled: false } });
  const disconnect = useDisconnectEmailConnection();
  const toggle = useToggleEmailConnection();
  const conn = status?.connections.find((c) => c.provider === provider);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetEmailConnectionsStatusQueryKey() });
  const onError = () => toast({ title: t("dashboard.settings.emailSend.error"), variant: "destructive" });
  const connect = async () => {
    const r = await getConnectUrl.refetch();
    if (r.data?.url) window.location.href = r.data.url;
    else onError();
  };
  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  if (!conn) {
    return (
      <SettingsGroup>
        <ActionRow label={t("apps.gmail.connectLabel")} help={t("dashboard.settings.emailSend.desc")}>
          <button type="button" onClick={() => void connect()} disabled={getConnectUrl.isFetching} className="btn btn-sm btn-navy" data-primary-action>
            {getConnectUrl.isFetching ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plug aria-hidden="true" />}
            {t("dashboard.settings.emailSend.connectCta")}
          </button>
        </ActionRow>
      </SettingsGroup>
    );
  }

  return (
    <>
      <SettingsGroup title={t("apps.detail.account")}>
        <AccountFacts facts={[
          [t("apps.gmail.sendsFrom"), conn.accountEmail ?? "—"],
          [t("dashboard.settings.emailSend.lastSend"), conn.lastSendError ? t("dashboard.settings.emailSend.lastSendFailed") : fmtDateTime(conn.lastSendAt) ?? t("apps.detail.never")],
        ]} />
        <ToggleRow label={t("apps.gmail.sendOn")} help={t("apps.gmail.sendOnHelp")} checked={conn.isEnabled ?? true} disabled={toggle.isPending}
          onChange={(v) => toggle.mutate({ provider, data: { isEnabled: v } }, { onSuccess: invalidate, onError })} />
      </SettingsGroup>
      <DisconnectRow name="Gmail" help={t("apps.gmail.disconnectHelp")} pending={disconnect.isPending}
        onConfirm={() => disconnect.mutate({ provider }, { onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.emailSend.disconnected") }); }, onError })} />
    </>
  );
}
