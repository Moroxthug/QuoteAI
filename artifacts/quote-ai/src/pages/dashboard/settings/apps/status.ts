import { useQuery } from "@tanstack/react-query";
import {
  useGetQuickbooksStatus, getGetQuickbooksStatusQueryKey, useGetQuickbooksSyncLog, getGetQuickbooksSyncLogQueryKey,
  useGetWaveStatus, getGetWaveStatusQueryKey, useGetWaveSyncLog, getGetWaveSyncLogQueryKey,
  useGetCalendarStatus, getGetCalendarStatusQueryKey, useGetCalendarSyncLog, getGetCalendarSyncLogQueryKey,
  useGetEmailConnectionsStatus, getGetEmailConnectionsStatusQueryKey,
  useGetWhatsappStatus, getGetWhatsappStatusQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { calendarApi } from "@/lib/calendar-api";
import { smsApi } from "@/lib/sms-api";
import { developerApi, financeitApi, flinksApi, googleLsaApi, metaLeadAdsApi, stripeConnectApi } from "@/lib/invoices-api";
import { useBusinessProfile } from "../data";
import { APPS, type AppId } from "./catalog";

/**
 * - `connected`: working (or switched on).
 * - `attention`: connected but something needs the owner — a failed sync, an unfinished sign-up, a send error.
 * - `paused`: connected and switched off on purpose.
 * - `off`: available, not connected — the tile says Connect.
 * - `soon`: the server has no app registration for it yet (Phase 65's `available: false`).
 * - `locked`: the plan doesn't include it.
 */
type AppState = "loading" | "locked" | "soon" | "off" | "connected" | "attention" | "paused";
export type AppStatus = { state: AppState; detail?: string | null };

type LogEntry = { entityType?: string; entityId?: string; milestoneId?: string; provider?: string; status: string };

/**
 * The sync logs are append-only (a retry adds a row). An entity needs
 * attention while its newest row is a failure; the entries come newest first.
 */
export function unresolvedFailures<T extends LogEntry>(entries: readonly T[] | undefined): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of entries ?? []) {
    const key = `${e.provider ?? ""}:${e.entityType ?? ""}:${e.entityId ?? e.milestoneId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (e.status === "failed" && e.entityType !== "payment_pull") out.push(e);
  }
  return out;
}

/** Shared query keys for the hand-written status clients (the panels invalidate these). */
export const STATUS_KEYS = {
  stripe: ["stripe-connect-status"],
  financeit: ["financeit-status"],
  flinks: ["flinks-status"],
  meta: ["meta-lead-ads-status"],
  lsa: ["google-lsa-status"],
  sms: ["sms-status"],
  feeds: ["calendar-feeds"],
  publish: ["calendar-publish"],
  apiKeys: ["developer-api-keys"],
  webhooks: ["developer-webhooks"],
} as const;

/**
 * Every app's state, for the tiles. A status endpoint is only called for an
 * app the plan includes (the others answer 403 and are shown locked anyway).
 */
export function useAppStatuses(unlocked: (id: AppId) => boolean): Record<AppId, AppStatus> {
  const { t } = useLanguage();
  const on = (id: AppId) => unlocked(id);

  const qb = useGetQuickbooksStatus({ query: { queryKey: getGetQuickbooksStatusQueryKey(), enabled: on("quickbooks") } });
  const qbLog = useGetQuickbooksSyncLog({ query: { queryKey: getGetQuickbooksSyncLogQueryKey(), enabled: on("quickbooks") && !!qb.data?.connected } });
  const wave = useGetWaveStatus({ query: { queryKey: getGetWaveStatusQueryKey(), enabled: on("wave") } });
  const waveLog = useGetWaveSyncLog({ query: { queryKey: getGetWaveSyncLogQueryKey(), enabled: on("wave") && !!wave.data?.connected } });
  const cal = useGetCalendarStatus({ query: { queryKey: getGetCalendarStatusQueryKey(), enabled: on("google_calendar") } });
  const calLog = useGetCalendarSyncLog({ query: { queryKey: getGetCalendarSyncLogQueryKey(), enabled: on("google_calendar") && (cal.data?.connections.length ?? 0) > 0 } });
  const feeds = useQuery({ queryKey: STATUS_KEYS.feeds, queryFn: () => calendarApi.feeds(), enabled: on("ics"), retry: false });
  const publish = useQuery({ queryKey: STATUS_KEYS.publish, queryFn: () => calendarApi.publishState(), enabled: on("ics"), retry: false });
  const email = useGetEmailConnectionsStatus({ query: { queryKey: getGetEmailConnectionsStatusQueryKey(), enabled: on("gmail") } });
  const wa = useGetWhatsappStatus({ query: { queryKey: getGetWhatsappStatusQueryKey(), enabled: on("whatsapp") } });
  const sms = useQuery({ queryKey: STATUS_KEYS.sms, queryFn: smsApi.status, enabled: on("sms") });
  const stripe = useQuery({ queryKey: STATUS_KEYS.stripe, queryFn: stripeConnectApi.status, enabled: on("stripe") });
  const financeit = useQuery({ queryKey: STATUS_KEYS.financeit, queryFn: financeitApi.status, enabled: on("financeit") });
  const flinks = useQuery({ queryKey: STATUS_KEYS.flinks, queryFn: flinksApi.status, enabled: on("flinks") });
  const meta = useQuery({ queryKey: STATUS_KEYS.meta, queryFn: metaLeadAdsApi.status, enabled: on("meta_leads") });
  const lsa = useQuery({ queryKey: STATUS_KEYS.lsa, queryFn: googleLsaApi.status, enabled: on("google_lsa") });
  const keys = useQuery({ queryKey: STATUS_KEYS.apiKeys, queryFn: developerApi.listKeys, enabled: on("api") });
  const hooks = useQuery({ queryKey: STATUS_KEYS.webhooks, queryFn: developerApi.listWebhooks, enabled: on("api") });
  const profile = useBusinessProfile();

  /** The common shape: not configured on the server → soon; connected and on/off; otherwise Connect. */
  const basic = (
    q: { isLoading: boolean; data?: { connected: boolean; available?: boolean; isEnabled?: boolean | null } | undefined },
    detail?: string | null,
    attention?: boolean,
  ): AppStatus => {
    if (q.isLoading) return { state: "loading" };
    const d = q.data;
    if (!d) return { state: "off" };
    if (!d.connected) return { state: d.available === false ? "soon" : "off" };
    if (attention) return { state: "attention", detail };
    if (d.isEnabled === false) return { state: "paused", detail };
    return { state: "connected", detail };
  };

  const calendarOf = (provider: "google" | "outlook"): AppStatus => {
    if (cal.isLoading) return { state: "loading" };
    const conn = cal.data?.connections.find((c) => c.provider === provider);
    if (!conn) return { state: cal.data?.available?.[provider] === false ? "soon" : "off" };
    const failing = unresolvedFailures(calLog.data?.entries).some((e) => e.provider === provider);
    if (failing) return { state: "attention", detail: t("apps.detail.syncFailed") };
    return { state: conn.isEnabled === false ? "paused" : "connected", detail: conn.accountEmail ?? null };
  };

  const qbFailures = unresolvedFailures(qb.data?.connected ? qbLog.data?.entries : undefined).length;
  const waveFailures = unresolvedFailures(wave.data?.connected ? waveLog.data?.entries : undefined).length;
  const gmail = email.data?.connections.find((c) => c.provider === "google");
  const feedList = feeds.data?.feeds ?? [];
  const flinksNeedsAccount = !!flinks.data?.connected && !flinks.data?.selectedAccount;
  const activeKeys = (keys.data?.items ?? []).filter((k) => !k.revokedAt).length;
  const webhookCount = hooks.data?.items.length ?? 0;
  const failuresText = (n: number) => (n === 1 ? t("apps.detail.oneFailed") : t("apps.detail.nFailed").replace("{n}", String(n)));

  const raw: Record<AppId, AppStatus> = {
    quickbooks: basic(qb, qbFailures ? failuresText(qbFailures) : qb.data?.companyName, qbFailures > 0),
    wave: basic(wave, waveFailures ? failuresText(waveFailures) : wave.data?.businessName, waveFailures > 0),
    google_calendar: calendarOf("google"),
    outlook_calendar: calendarOf("outlook"),
    ics: feeds.isLoading || publish.isLoading
      ? { state: "loading" }
      : feedList.some((f) => f.lastStatus === "failed")
        ? { state: "attention", detail: t("apps.detail.feedFailed") }
        : feedList.length || publish.data?.enabled
          ? { state: "connected", detail: t("apps.ics.summary").replace("{n}", String(feedList.length)).replace("{published}", publish.data?.enabled ? t("apps.ics.publishedOn") : t("apps.ics.publishedOff")) }
          : { state: "off" },
    gmail: email.isLoading
      ? { state: "loading" }
      : !gmail
        ? { state: email.data?.available?.google === false ? "soon" : "off" }
        : gmail.lastSendError
          ? { state: "attention", detail: t("dashboard.settings.emailSend.lastSendFailed") }
          : { state: gmail.isEnabled === false ? "paused" : "connected", detail: gmail.accountEmail ?? null },
    whatsapp: basic(wa, wa.data?.phoneNumber ?? null),
    sms: sms.isLoading
      ? { state: "loading" }
      : !sms.data
        ? { state: "off" }
        : sms.data.available === false
          ? { state: "soon" }
          : { state: sms.data.smsEnabled ? "connected" : "off", detail: sms.data.fromNumberHint },
    stripe: stripe.data?.connected && !stripe.data.chargesEnabled
      ? { state: "attention", detail: t("dashboard.settings.stripeConnect.onboardingIncomplete") }
      : basic(stripe),
    financeit: basic(financeit, financeit.data?.dealerId ? `${t("dashboard.settings.financeit.dealerIdLabel")}: ${financeit.data.dealerId}` : null),
    flinks: basic(flinks, flinksNeedsAccount ? t("dashboard.settings.flinks.noAccountSelected") : flinks.data?.institutionName ?? null, flinksNeedsAccount),
    meta_leads: basic(meta, meta.data?.pageName ?? null),
    google_lsa: basic(lsa, lsa.data?.lsaCustomerId ?? null),
    widget: profile.isLoading ? { state: "loading" } : profile.data?.apiKey ? { state: "connected" } : { state: "off" },
    api: keys.isLoading || hooks.isLoading
      ? { state: "loading" }
      : activeKeys || webhookCount
        ? { state: "connected", detail: t("apps.api.summary").replace("{keys}", String(activeKeys)).replace("{hooks}", String(webhookCount)) }
        : { state: "off" },
  };

  const out = {} as Record<AppId, AppStatus>;
  for (const app of APPS) out[app.id] = unlocked(app.id) ? raw[app.id] : { state: "locked" };
  return out;
}
