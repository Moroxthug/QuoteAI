// AssistantActivity.dc.html. Everything the assistant did, and who asked: today's and the month's actions and how many were undone, the voice minutes
// used, a filter (All / You asked / Automatic / Messages / Money / Jobs), the rows by day with Undo (a cost, an order, a moved visit) or Open (an
// invoice), and the way back to Proposals and Permissions. States: default, empty, offline, no match, loading and can't load.
// Not drawn, for want of data or a way back: "Redo" in the toast (what was undone is gone, there is nothing to put back), the channel after the name
// ("Marco · voice": the server does not keep how it was asked), and the board's ⋯ (it draws no menu).
import { useEffect, useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { FILTERS, badge, dayFromKey, groupByDay, look, matches, voiceShare, type ActivityRow, type FilterKey } from "@/lib/assistant";
import { assistantApi } from "@/lib/assistantApi";
import { flushAssistantOutbox, outbox } from "@/lib/assistantSync";
import { dayDate, money, sentence, shortDate, time, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { ActivityLine, AssistantHead, AssistantTabs, CrossIcon, UsageCard } from "@/ui/Assistant";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Swirl } from "@/ui/Logo";
import { Num } from "@/ui/Text";
import { StatStrip } from "@/ui/Numbers";
import { ListRow, RowChevron, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Status } from "@/ui/Status";

export default function AssistantActivity() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`as.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["assistant", "activity"], queryFn: assistantApi.activity, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const overview = useQuery({ queryKey: ["assistant", "overview"], queryFn: assistantApi.overview, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const data = q.data;

  const [filter, setFilter] = useState<FilterKey>("all");
  const [done, setDone] = useState<Record<string, "done" | "pending">>({});
  const now = useMemo(() => new Date(), []);

  // What was undone offline goes out once there is a connection.
  useEffect(() => {
    if (!signedIn || !q.isSuccess) return;
    let live = true;
    void flushAssistantOutbox().then((n) => {
      if (!live || !n) return;
      setDone((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === "pending" ? "done" : v])));
      void client.invalidateQueries({ queryKey: ["assistant"] });
    });
    return () => { live = false; };
  }, [signedIn, q.isSuccess, q.dataUpdatedAt, client]);

  if (status === "out") return <Redirect href="/" />;

  const m2 = (cents: number) => money(cents / 100, locale);
  const loading = q.isPending && !data;
  const failed = q.isError && !data;
  const offline = q.isError || status === "offline";
  const locked = !!data && !data.enabled;
  const waiting = overview.data?.pending ?? [];
  const canUndo = data?.canUndo ?? false;
  const rows: ActivityRow[] = data?.rows ?? [];
  const shown = rows.filter((r) => matches(filter, r));
  const groups = groupByDay(shown, now);
  const empty = !!data && data.enabled && rows.length === 0;

  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SmartHome", t("brand"))));
  const toProposals = () => router.replace(screenHref("AssistantProposals", t("tabs.proposals")));
  const toPermissions = () => router.push(screenHref("AssistantPermissions", t("tabs.permissions")));

  const channelName = (v: string | number | undefined) => t(`a.channel.${v === "sms" ? "sms" : "email"}`);
  const textOf = (r: ActivityRow): { title: string; detail: string } => {
    const p = r.params;
    const amount = typeof p.amount === "number" ? m2(p.amount) : "";
    switch (r.kind) {
      case "reminder": {
        const days = typeof p.days === "number" ? p.days : 0;
        return { title: t("a.t.reminder", { client: p.client ?? "", number: p.number ?? "" }), detail: days > 0 ? t("a.d.reminderLate", { channel: channelName(p.channel), amount, count: days }) : t("a.d.reminder", { channel: channelName(p.channel), amount }) };
      }
      case "followup": return { title: t("a.t.followup", { client: p.client ?? "", number: p.number ?? "" }), detail: t("a.d.followup", { channel: channelName(p.channel), amount }) };
      case "order": return { title: t("a.t.order", { count: Number(p.count ?? 0), supplier: p.supplier ?? "" }), detail: t("a.d.order", { items: p.items ?? "" }) };
      case "move": return { title: t("a.t.move", { title: p.title || p.job || "" }), detail: t("a.d.move", { job: p.job ?? "" }) };
      default: return { title: r.title, detail: r.detail };
    }
  };

  const undo = async (r: ActivityRow) => {
    const void_ = r.undo === "void";
    if (offline) {
      await outbox.queue({ type: "undo", id: r.id });
      setDone((d) => ({ ...d, [r.id]: "pending" }));
      toast({ lead: t("a.toast.saved"), message: t("a.toast.later") });
      return;
    }
    try {
      const out = await assistantApi.undo(r.id);
      setDone((d) => ({ ...d, [r.id]: "done" }));
      toast({ lead: t(void_ ? "a.toast.voided" : "a.toast.undone"), message: t(`a.toast.${out.toast}`, { defaultValue: "" }) });
      void client.invalidateQueries({ queryKey: ["assistant"] });
    } catch (e) {
      if (e instanceof ApiFailure && e.offline) {
        await outbox.queue({ type: "undo", id: r.id });
        setDone((d) => ({ ...d, [r.id]: "pending" }));
        toast({ lead: t("a.toast.saved"), message: t("a.toast.later") });
        return;
      }
      toast({ message: t(e instanceof ApiFailure && (e.status === 404 || e.status === 409 || e.status === 400) ? "a.toast.gone" : "a.toast.failed") });
    }
  };

  const line = (r: ActivityRow, first: boolean) => {
    const look1 = look(r.kind);
    const { title, detail } = textOf(r);
    const local = done[r.id];
    const undone = r.undone || local === "done";
    const pending = local === "pending";
    const auto = r.whoKind === "auto";
    const who = auto ? t("a.whoAuto", { rule: tr(`as.a.rule.${r.who}`, { defaultValue: r.who }) }) : r.who;
    const void_ = r.undo === "void";
    let right: React.ReactNode = null;
    if (undone) right = <Status tone="mute" shape="x">{t(`a.word.${void_ || r.word === "Voided" ? "Voided" : "Undone"}`)}</Status>;
    else if (pending) right = <Status tone="warn" shape="clock">{t("a.word.pending")}</Status>;
    else if ((r.undo === "undo" || r.undo === "void") && canUndo) right = <Button size="sm" kind="secondary" label={t(void_ ? "a.void" : "a.undo")} accessibilityLabel={t(void_ ? "a.voidLabel" : "a.undoLabel", { title })} onPress={() => void undo(r)} />;
    else if (r.invoiceId && r.kind === "invoice") right = <Button size="sm" kind="secondary" label={t("a.open")} onPress={() => router.push(screenHref("Invoice", title, { id: r.invoiceId! }))} />;
    else if (r.word) right = <Status tone="info" shape="q1">{tr(`as.a.word.${r.word}`, { defaultValue: r.word })}</Status>;
    return <ActivityLine key={r.id} first={first} icon={look1.icon} tone={look1.tone} title={title} detail={detail} time={time(new Date(r.at), locale)} who={who} auto={auto} undone={undone} right={right} />;
  };

  const voice = data?.voice;
  const share = voice ? voiceShare(voice.used, voice.included) : { pct: 0, near: false };
  const kinds = [...new Set(waiting.map((s) => s.kind))].map((k) => t(`a.links.kind.${k}`)).join(", ");

  return (
    <Screen>
      <Header title={t("brand")} titleIcon={<Swirl />} backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={96} sticky={[0]}>
        <AssistantTabs active={1} count={waiting.length ? badge(waiting.length) : undefined} onTab={(i) => { if (i === 0) toProposals(); if (i === 2) router.replace(screenHref("AssistantPermissions", t("tabs.permissions"))); }} />
        <Section><AssistantHead title={t("a.title")} sub={t("a.sub")} /></Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={10}><Skeleton height={86} radius={22} /><Skeleton height={86} radius={22} /><Skeleton height={300} radius={22} /></Section>
        ) : locked ? (
          <Section pt={26} px={16}>
            <Empty icon="lock" title={t("locked.title")} body={t("locked.body")} action={t("locked.action")} actionKind="secondary" onAction={() => router.push(screenHref("SetPlan", t("locked.action")))} />
          </Section>
        ) : data ? (
          <>
            {offline ? <Section pt={14} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("a.offline")}</Banner></Section> : null}

            <Section delay={40} pt={16} px={16}>
              <StatStrip items={[
                { label: t("a.kpi.today"), value: String(data.today), sub: data.today ? t("a.kpi.youAsked", { count: data.todayYou }) : t("a.kpi.actions") },
                { label: t("a.kpi.month"), value: String(data.month), sub: t("a.kpi.actions") },
                { label: t("a.kpi.undone"), value: String(data.undoneMonth), sub: t("a.kpi.thisMonth") },
              ]} />
            </Section>

            <Section delay={60} pt={10} px={16}>
              <UsageCard title={t("a.voice.title")} used={String(voice?.used ?? 0)} of={t("a.voice.of", { total: voice?.included ?? 0 })} pct={share.pct / 100} label={t("a.voice.label")} caption={sentence(t("a.voice.resets", { date: shortDate(voice ? dayFromKey(voice.resets) : now, locale) }))} />
            </Section>

            {!empty ? (
              <Section delay={80} pt={18}>
                <ChipStrip label={t("a.filter.label")}>
                  {FILTERS.map((f) => <Chip key={f} label={t(`a.filter.${f}`)} count={rows.filter((r) => matches(f, r)).length} selected={filter === f} onPress={() => setFilter(f)} />)}
                </ChipStrip>
              </Section>
            ) : null}

            {groups.map((g) => (
              <Section key={g.key} delay={110} pt={20} px={16}>
                <SectionHeader title={g.key === "today" ? t("a.today") : g.key === "yesterday" ? t("a.yesterday") : dayDate(g.day, locale)} link={g.key === "today" || g.key === "yesterday" ? dayDate(g.day, locale) : undefined} />
                <Card>{g.rows.map((r, i) => line(r, i === 0))}</Card>
              </Section>
            ))}

            {!empty && groups.length === 0 ? (
              <Section><Empty icon="search" iconTone="slate" title={t("a.noMatch.title")} body={t("a.noMatch.body")} action={t("a.noMatch.action")} actionKind="secondary" onAction={() => setFilter("all")} /></Section>
            ) : null}
            {empty ? (
              <Section pt={44}><Empty icon="orb" title={t("a.empty.title")} body={t("a.empty.body")} action={t("a.empty.action")} actionKind="secondary" onAction={toPermissions} /></Section>
            ) : null}

            <Section delay={140} pt={22} px={16}>
              <Card>
                <RowList>
                  <ListRow title={t("a.links.proposals")} meta={kinds || t("a.links.none")} leading={<CrossIcon name="bell" tone="violet" />}
                    trailing={<Stack row align="center" gap={8}>{waiting.length ? <Num size={14.5} weight={600}>{String(waiting.length)}</Num> : null}<RowChevron /></Stack>} onPress={toProposals} />
                  <ListRow title={t("a.links.permissions")} meta={t("a.links.permissionsSub")} leading={<CrossIcon name="shield" tone="indigo" />} trailing={<RowChevron />} onPress={toPermissions} />
                </RowList>
              </Card>
            </Section>
          </>
        ) : null}
      </ScrollPage>
    </Screen>
  );
}

