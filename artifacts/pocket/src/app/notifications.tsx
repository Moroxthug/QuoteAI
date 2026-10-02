// Notifications.dc.html. What the server told the company: quotes viewed, payments, hours to approve, overdue invoices, blockers; All / Unread, grouped
// Today and Earlier, a dot while unread (the title is 600), the one button some rows carry (Confirm, Review hours, Send a reminder, each opening where it
// is done), Mark all read. A tap marks the row read and opens what it is about. States: list, opt-in (the sheet that asks to turn notifications on),
// empty, loading and can't load.
// The text of a notification is the one the server wrote when it happened (it can't be rewritten in the other language). The opt-in sheet's "Turn on" opens the
// phone's own settings for the app (native) or asks the browser (web): the app has no push module yet, so nothing is registered for push from here.
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform } from "react-native";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FILTERS, actionOf, groupNotifications, isUnread, look, targetOf, whenLabel, type Filter, type NotificationDto } from "@/lib/notifications";
import { notificationsApi } from "@/lib/notificationsApi";
import { money, shortDate, time, weekdayShort, type Locale } from "@/lib/format";
import { kvGet, kvSet } from "@/lib/kv";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { ScrollPage, Section } from "@/ui/Layout";
import { AskBody, NotificationRow, PushStage } from "@/ui/Notifications";
import { SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";

const ASKED_KEY = "quoteai_notifications_asked";

export default function Notifications() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`nt.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["notifications", "list"], queryFn: notificationsApi.list, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const [filter, setFilter] = useState<Filter>("all");
  const [ask, setAsk] = useState(false);
  const [readNow, setReadNow] = useState<string[]>([]);
  const now = useMemo(() => new Date(), []);
  const data = q.data;

  // The first visit asks once whether to turn notifications on (the sheet is the board's "opt-in" state).
  useEffect(() => {
    if (!signedIn || !q.isSuccess) return;
    let live = true;
    void kvGet(ASKED_KEY).then((v) => { if (live && !v) setAsk(true); });
    return () => { live = false; };
  }, [signedIn, q.isSuccess]);

  if (status === "out") return <Redirect href="/" />;

  const items: NotificationDto[] = (data?.items ?? []).map((n) => (readNow.includes(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n));
  const unread = items.filter(isUnread).length;
  const loading = q.isPending && !data;
  const failed = q.isError && !data;
  const groups = groupNotifications(items, filter, now);
  const refresh = () => { void client.invalidateQueries({ queryKey: ["notifications"] }); void client.invalidateQueries({ queryKey: ["home-unread"] }); };
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SmartHome", t("title"))));

  const markRead = async (ids?: string[]) => {
    setReadNow((r) => [...r, ...(ids ?? items.filter(isUnread).map((n) => n.id))]);
    try { await notificationsApi.read(ids); refresh(); } catch { setReadNow([]); toast({ message: t("toast.failed") }); }
  };
  const open = (n: NotificationDto) => {
    if (isUnread(n)) void markRead([n.id]);
    const target = targetOf(n);
    if (target) router.push(screenHref(target.screen, n.title, target.params));
  };
  const act = (n: NotificationDto) => {
    if (isUnread(n)) void markRead([n.id]);
    const target = targetOf(n);
    router.push(target ? screenHref(target.screen, n.title, target.params) : screenHref("SmartHome", n.title));
  };

  const closeAsk = async (turnOn: boolean) => {
    setAsk(false);
    await kvSet(ASKED_KEY, "1");
    if (!turnOn) return;
    // Web asks the browser; on the phone the app's own settings are where it is turned on (no push module in this build yet).
    if (Platform.OS === "web") {
      try { const r = await globalThis.Notification?.requestPermission(); if (r === "denied") toast({ message: t("ask.denied") }); } catch { toast({ message: t("ask.unavailable") }); }
    } else {
      try { await Linking.openSettings(); } catch { toast({ message: t("ask.unavailable") }); }
    }
  };

  const clock = (d: Date) => time(d, locale);
  const clockWords = (d: Date) => weekdayShort(d, locale);
  const dateWords = (d: Date) => shortDate(d, locale);

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={40}>
        <Section px={20} pt={2} row align="center" justify="space-between" gap={12}>
          <PageTitle>{t("title")}</PageTitle>
          <Button size="sm" kind="secondary" label={t("markAll")} disabled={unread === 0 || !data} onPress={() => void markRead()} />
        </Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={20} px={16} gap={12}><Skeleton height={44} radius={22} /><Skeleton height={300} radius={22} /></Section>
        ) : (
          <>
            <Section delay={40} pt={16}>
              <ChipStrip label={t("filterLabel")}>
                {FILTERS.map((f) => <Chip key={f} label={t(`filter.${f}`)} count={f === "all" ? items.length : unread} selected={filter === f} onPress={() => setFilter(f)} />)}
              </ChipStrip>
            </Section>
            {groups.map((g) => (
              <Section key={g.key} delay={80} pt={20} px={16}>
                <SectionHeader title={t(g.key)} />
                <Card>
                  {g.rows.map((n, i) => {
                    const l = look(n.type);
                    const a = actionOf(n.type);
                    const u = isUnread(n);
                    return (
                      <NotificationRow key={n.id} first={i === 0} icon={l.icon} tone={l.tone} title={n.title} body={n.body} unread={u}
                        time={whenLabel(new Date(n.createdAt), now, clock, clockWords, dateWords)} label={u ? t("unreadLabel", { title: n.title }) : n.title}
                        action={a ? t(`action.${a}`) : undefined} onAction={() => act(n)} onPress={() => open(n)} />
                    );
                  })}
                </Card>
              </Section>
            ))}
            {groups.length === 0 ? (
              <Section pt={70}><Empty icon="bell" title={t("empty.title")} body={t("empty.body")} action={filter === "unread" ? t("empty.action") : undefined} actionKind="secondary" onAction={() => setFilter("all")} /></Section>
            ) : null}
          </>
        )}
      </ScrollPage>

      <Sheet open={ask} onClose={() => void closeAsk(false)} label={t("ask.label")} closeLabel={t("close")}>
        <AskBody stage={<PushStage app={t("ask.app")} now={t("ask.now")} title={t("ask.sampleTitle")} body={t("ask.sampleBody")} amount={money(4131.05, locale)} />} title={t("ask.title")} body={t("ask.body")}>
          <Button size="lg" label={t("ask.on")} block onPress={() => void closeAsk(true)} />
          <Button kind="ghost" label={t("ask.later")} block onPress={() => void closeAsk(false)} />
        </AskBody>
      </Sheet>
    </Screen>
  );
}
