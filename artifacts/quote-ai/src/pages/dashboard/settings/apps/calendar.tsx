import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCalendarStatus, getGetCalendarStatusQueryKey, useGetCalendarConnectUrl, getGetCalendarConnectUrlQueryKey, useDisconnectCalendar, useToggleCalendar,
  useGetCalendarSyncLog, getGetCalendarSyncLogQueryKey, type CalendarProvider,
} from "@workspace/api-client-react";
import { Loader2, Plug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { CalendarFeedsCard } from "@/components/dashboard/calendar-feeds-card";
import { CalendarTargetPicker } from "@/components/dashboard/calendar-target-picker";
import { ActionRow, SettingsGroup, ToggleRow } from "../ui";
import { AccountFacts, DisconnectRow, SyncLog, fmtDateTime } from "./ui";
import { unresolvedFailures } from "./status";

const PROVIDER_NAME: Record<CalendarProvider, string> = { google: "Google Calendar", outlook: "Outlook" };

// ── Google Calendar / Outlook: job milestones pushed to the owner's calendar ──

function CalendarPanel({ provider }: { provider: CalendarProvider }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetCalendarStatus();
  const conn = status?.connections.find((c) => c.provider === provider);
  const { data: log } = useGetCalendarSyncLog({ query: { queryKey: getGetCalendarSyncLogQueryKey(), enabled: !!conn } });
  const getConnectUrl = useGetCalendarConnectUrl(provider, { query: { queryKey: getGetCalendarConnectUrlQueryKey(provider), enabled: false } });
  const disconnect = useDisconnectCalendar();
  const toggle = useToggleCalendar();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetCalendarStatusQueryKey() });
  const onError = () => toast({ title: t("dashboard.settings.calendar.error"), variant: "destructive" });
  const connect = async () => {
    const r = await getConnectUrl.refetch();
    if (r.data?.url) window.location.href = r.data.url;
    else onError();
  };
  if (isLoading) return <Skeleton className="h-32 w-full rounded-[var(--radius)]" />;

  if (!conn) {
    return (
      <SettingsGroup>
        <ActionRow label={t("apps.calendar.connectLabel").replace("{name}", t(`apps.${provider === "google" ? "google_calendar" : "outlook_calendar"}.name`))} help={t("dashboard.settings.calendar.desc")}>
          <button type="button" onClick={() => void connect()} disabled={getConnectUrl.isFetching} className="btn btn-sm btn-navy" data-primary-action>
            {getConnectUrl.isFetching ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plug aria-hidden="true" />}
            {t("dashboard.settings.calendar.connectCta")}
          </button>
        </ActionRow>
      </SettingsGroup>
    );
  }

  const failures = unresolvedFailures((log?.entries ?? []).filter((e) => e.provider === provider));

  return (
    <>
      <SettingsGroup title={t("apps.detail.account")}>
        <AccountFacts facts={[
          [t("apps.detail.signedInAs"), conn.accountEmail ?? "—"],
          [t("apps.detail.lastSync"), fmtDateTime(conn.lastSyncedAt) ?? t("apps.detail.never")],
        ]} />
        <div className="sgroup-pad app-picker">
          {/* Phase 96: which of the account's calendars the events go to. */}
          <CalendarTargetPicker provider={provider} calendarId={conn.calendarId ?? "primary"} calendarName={conn.calendarName ?? null} onReconnect={() => void connect()} />
        </div>
        <ToggleRow label={t("apps.calendar.syncOn")} help={t("apps.calendar.syncOnHelp")} checked={conn.isEnabled ?? true} disabled={toggle.isPending}
          onChange={(v) => toggle.mutate({ provider, data: { isEnabled: v } }, { onSuccess: invalidate, onError })} />
      </SettingsGroup>
      <SyncLog
        title={t("apps.calendar.logTitle")}
        rows={failures.map((e) => ({ id: e.id, ok: false, label: t("apps.calendar.eventFailed"), error: e.error, when: fmtDateTime(e.updatedAt) }))}
      />
      <DisconnectRow name={PROVIDER_NAME[provider]} pending={disconnect.isPending}
        onConfirm={() => disconnect.mutate({ provider }, { onSuccess: () => { invalidate(); toast({ title: t("dashboard.settings.calendar.disconnected") }); }, onError })} />
    </>
  );
}

export const GoogleCalendarPanel = () => <CalendarPanel provider="google" />;
export const OutlookCalendarPanel = () => <CalendarPanel provider="outlook" />;

/** Calendar feeds (.ics): subscribe to any calendar's link, and publish the schedule as one. */
export function IcsPanel() {
  return <CalendarFeedsCard />;
}
