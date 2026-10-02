// Leads.dc.html. The pipeline: five tabs (New, Contacted, Quoted, Won, Lost) with counts, a card for each lead that
// opens in place (the full request, where it came from, the follow-up plan with its channel, a suggested reply with
// Send, Call and Make quote, Mark lost), "New lead" as an inline form, and "Bring leads in on their own" on New.
// States: list per tab, the tab's empty, no leads at all, loading, can't load, offline.
// What the server doesn't hold, so the screen doesn't show it: photos, a per-lead drafted reply (the standard
// 3-step follow-up text goes out), visits, review requests and the "Referral" source (see the build log).
import { useMemo, useState } from "react";
import { Linking } from "react-native";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { dayDate, relativeWhen, shortDate, time, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { askOf, canSend, dueCount, firstName, followUp, isOpenStage, leadTint, leadsIn, newLeadBody, openCount, reopenStatus, replyStep, sendChannel, sourceInfo, stageCounts, stageOf, STAGES, type Lead, type LeadChannel, type LeadStatus, type NewLead, type Stage, deName } from "@/lib/leads";
import { leadsApi } from "@/lib/leadsApi";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { ExpandCard, ExpandScrollView, XcCaption, XcDivider, XcRow, useExpandOpen } from "@/ui/Expand";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { Glyph, type IconName, type Tone } from "@/ui/Icon";
import { Section, Stack } from "@/ui/Layout";
import { ChannelSeg, ConnectCard, FullAsk, LeadActions, LeadHead, LeadNotice, LeadTabs, LostLink, NewLeadForm, ReplyBox } from "@/ui/Leads";
import { Screen } from "@/ui/Screen";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { Text } from "@/ui/Text";

type Notice = { text: string; undo?: () => void };
const PLAN_STATUS: Record<"late" | "due" | "plain" | "none", { tone: StatusTone; shape: StatusShape }> = {
  late: { tone: "bad", shape: "alert" }, due: { tone: "warn", shape: "clock" }, plain: { tone: "info", shape: "q1" }, none: { tone: "mute", shape: "draft" },
};
/** Text and Email; WhatsApp only for a lead that already asked for it (a new lead is never offered it). */
const chanOpts = (l: Lead): LeadChannel[] => (l.preferredChannel === "whatsapp" ? ["sms", "email", "whatsapp"] : ["sms", "email"]);

export default function Leads() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const language: "en" | "fr" = i18n.language === "fr" ? "fr" : "en";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["leads"], queryFn: leadsApi.list, enabled: signedIn, retry: 1, staleTime: 30_000 });
  const [stageIx, setStageIx] = useState(0);
  const [form, setForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const now = useMemo(() => new Date(), [q.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => q.data?.items ?? [], [q.data]);
  const counts = useMemo(() => stageCounts(all), [all]);
  const stage: Stage = STAGES[stageIx]!;
  const shown = useMemo(() => leadsIn(all, stage), [all, stage]);
  if (status === "out") return <Redirect href="/" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", t("menu.title"))));
  const put = (l: Lead) => client.setQueryData<{ items: Lead[] }>(["leads"], (old) => (old ? { items: old.items.map((x) => (x.id === l.id ? l : x)) } : old));
  const stageName = (s: Stage) => t(`leads.stages.${s}`);
  const loading = q.isPending && !q.data;
  const failed = q.isError && !q.data;

  const followText = (l: Lead): string | undefined => {
    const f = followUp(l, now);
    if (f.kind === "none") return undefined;
    const tm = time(f.at, locale);
    if (f.day === "today") return t("leads.follow.today", { time: tm });
    if (f.day === "tomorrow") return t("leads.follow.tomorrow", { time: tm });
    if (f.day === "yesterday") return t("leads.follow.yesterday");
    return t(f.tone === "late" ? "leads.follow.dateMissed" : "leads.follow.date", { date: dayDate(f.at, locale) });
  };
  const addedWhen = (l: Lead): string | undefined => {
    const f = followUp(l, now);
    if (f.kind === "none") return undefined;
    const day = f.day === "today" ? t("leads.notice.today") : f.day === "tomorrow" ? t("leads.notice.tomorrow") : dayDate(f.at, locale);
    return t("leads.notice.at", { day, time: time(f.at, locale) });
  };

  const patch = async (l: Lead, body: { status?: LeadStatus; preferredChannel?: LeadChannel }): Promise<Lead | null> => {
    try {
      const r = await leadsApi.update(l.id, body);
      put(r.lead);
      return r.lead;
    } catch {
      toast({ message: t("leads.notice.saveFailed") });
      return null;
    }
  };

  const pickChannel = async (l: Lead, ch: LeadChannel) => {
    if (ch === l.preferredChannel) return;
    put({ ...l, preferredChannel: ch });
    const done = await patch(l, { preferredChannel: ch });
    if (!done) put(l);
  };

  const undoTo = (l: Lead, previous: LeadStatus) => async () => {
    setNotice(null);
    await patch(l, { status: previous });
  };

  const send = async (l: Lead) => {
    setSending(l.id);
    try {
      const r = await leadsApi.send(l.id);
      put(r.lead);
      const via = t(`leads.via.${r.channel}`);
      const moved = l.status === "new" && r.lead.status !== "new";
      setNotice(moved
        ? { text: t("leads.notice.sentMoved", { via, name: l.name, stage: stageName(stageOf(r.lead)) }), undo: undoTo(r.lead, "new") }
        : { text: t("leads.notice.sent", { name: l.name, via }) });
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.status === 409 ? t("leads.notice.unsubscribed", { name: l.name }) : t("leads.notice.sendFailed", { name: l.name }) });
    } finally {
      setSending(null);
    }
  };

  const markLost = async (l: Lead) => {
    const done = await patch(l, { status: "lost" });
    if (done) setNotice({ text: t("leads.notice.lost", { name: l.name }), undo: undoTo(done, l.status) });
  };

  const reopen = async (l: Lead) => {
    const to = reopenStatus(l);
    const done = await patch(l, { status: to });
    if (done) setNotice({ text: t("leads.notice.reopened", { name: l.name, stage: stageName(to) }) });
  };

  const save = async (d: NewLead) => {
    setSaving(true);
    try {
      const r = await leadsApi.add(newLeadBody(d, language));
      client.setQueryData<{ items: Lead[] }>(["leads"], (old) => ({ items: [r.lead, ...(old?.items ?? [])] }));
      setForm(false);
      setStageIx(0);
      const when = addedWhen(r.lead);
      setNotice({ text: when ? t("leads.notice.added", { name: r.lead.name, when }) : t("leads.notice.addedNoFollow", { name: r.lead.name }) });
    } catch {
      toast({ message: t("leads.notice.saveFailed") });
    } finally {
      setSaving(false);
    }
  };

  const open = (l: Lead) => (l.clientId ? router.push(screenHref("Client", t("clients.title"), { id: l.clientId })) : undefined);
  const makeQuote = (l: Lead) => {
    if (l.quoteId && stageOf(l) === "quoted") router.push(screenHref("Quote", t("leads.actions.openQuote"), { id: l.quoteId }));
    else router.push(screenHref("NewQuote", t("leads.actions.makeQuote"), { leadId: l.id, name: l.name }));
  };
  const contact = (l: Lead): { label: string; url: string } | null =>
    l.phone ? { label: t("leads.actions.call"), url: `tel:${l.phone.replace(/[^\d+]/g, "")}` } : l.email ? { label: t("leads.actions.email"), url: `mailto:${l.email}` } : null;

  const dueLine = () => {
    const open = openCount(all);
    const due = dueCount(all, now);
    return due === 0 ? t("leads.dueNone", { count: open, open }) : due === 1 ? t("leads.dueOne", { count: open, open }) : t("leads.due", { count: open, open, due });
  };

  const labels = {
    title: t("leads.form.title"), close: t("leads.form.close"), name: t("leads.form.name"), namePlaceholder: t("leads.form.namePlaceholder"), email: t("leads.form.email"), emailPlaceholder: t("leads.form.emailPlaceholder"),
    emailInvalid: t("leads.form.emailInvalid"), phone: t("leads.form.phone"), phonePlaceholder: t("leads.form.phonePlaceholder"), by: t("leads.form.by"), sms: t("leads.channels.sms"), mail: t("leads.channels.email"),
    notes: t("leads.form.notes"), notesPlaceholder: t("leads.form.notesPlaceholder"), cancel: t("leads.form.cancel"), save: t("leads.form.save"), saving: t("leads.form.saving"),
  };

  const card = (l: Lead) => {
    const st = stageOf(l);
    const src = sourceInfo(l.source);
    const f = followUp(l, now);
    const ask = askOf(l);
    const ch = sendChannel(l);
    const dest = contact(l);
    const reachable = !!(l.phone || l.email);
    const when = relativeWhen(new Date(l.createdAt), now, locale);
    const sentLine = [l.followUpStage === 0 ? t("leads.detail.sentNone") : t("leads.detail.sent", { count: l.followUpStage }), l.lastContactedAt ? t("leads.detail.lastSent", { when: relativeWhen(new Date(l.lastContactedAt), now, locale) }) : ""].filter(Boolean).join(" · ");
    const planTone = f.kind === "none" ? "none" : f.tone;
    return (
      <LeadCard key={l.id} l={l} ask={ask} sourceIcon={src.icon as IconName} sourceTone={src.tone as Tone} source={t(`leads.source.${src.key}`)} when={when}
        won={st === "won" ? t("leads.won") : undefined} follow={isOpenStage(st) ? followText(l) : undefined} followTone={f.kind === "set" ? f.tone : undefined} followLabel={t("leads.followUp")}>
        <XcDivider />
        <XcCaption>{isOpenStage(st) ? t("leads.detail.more", { name: language === "fr" ? deName(firstName(l.name)) : firstName(l.name) }) : t("leads.detail.details")}</XcCaption>
        {ask ? <FullAsk>{ask}</FullAsk> : null}
        <XcRow title={t("leads.detail.source")} sub={`${t(`leads.source.${src.key}`)} · ${when}`} />
        {isOpenStage(st) ? (
          <XcRow title={t("leads.detail.plan")}
            sub={<><Text size={12.5} color="muted" leading={1.35}>{sentLine}</Text><Status plain tone={PLAN_STATUS[planTone].tone} shape={PLAN_STATUS[planTone].shape}>{t(`leads.detail.status.${planTone}`)}</Status></>}
            right={<ChannelSeg label={t("leads.detail.channel")} wide={language === "fr"} options={chanOpts(l).map((c) => t(`leads.channels.${c}`))}
              value={Math.max(0, chanOpts(l).indexOf(l.preferredChannel))}
              onChange={(i) => void pickChannel(l, chanOpts(l)[i]!)} />} />
        ) : l.status === "unsubscribed" ? (
          <XcRow title={t("leads.detail.unsubTitle")} sub={t("leads.detail.unsubSub")} />
        ) : st === "lost" ? (
          <XcRow title={t("leads.detail.lostTitle")} sub={t("leads.detail.lostSub")} />
        ) : (
          <XcRow title={t("leads.detail.wonTitle")} sub={shortDate(new Date(l.updatedAt), locale)} />
        )}
        {isOpenStage(st) && canSend(l) ? (
          <ReplyBox caption={t("leads.reply.caption", { via: t(`leads.via.${ch}`) })} tag={t("leads.reply.tag")}
            text={`${t("leads.reply.hi", { name: firstName(l.name), lng: l.preferredLanguage })} ${t(`leads.reply.body${replyStep(l.followUpStage)}`, { lng: l.preferredLanguage })}`}
            sendLabel={sending === l.id ? t("leads.reply.sending") : t(`leads.reply.send.${ch}`)} busy={sending === l.id} disabled={!reachable} note={reachable ? undefined : t("leads.reply.noContact")}
            onSend={() => void send(l)} />
        ) : null}
        {st === "won" ? (
          <LeadActions link={dest?.label} onLink={() => dest && void Linking.openURL(dest.url)} main={l.clientId ? t("leads.actions.openClient") : undefined} onMain={() => open(l)} />
        ) : st === "lost" ? (
          <LeadActions link={l.status === "unsubscribed" ? dest?.label : t("leads.actions.reopen")} onLink={() => (l.status === "unsubscribed" ? dest && void Linking.openURL(dest.url) : void reopen(l))}
            main={t("leads.actions.makeQuote")} onMain={() => makeQuote(l)} />
        ) : (
          <LeadActions link={dest?.label} onLink={() => dest && void Linking.openURL(dest.url)} main={l.quoteId && st === "quoted" ? t("leads.actions.openQuote") : t("leads.actions.makeQuote")} onMain={() => makeQuote(l)} />
        )}
        {isOpenStage(st) ? <LostLink label={t("leads.actions.markLost")} onPress={() => void markLost(l)} /> : null}
      </LeadCard>
    );
  };

  return (
    <Screen>
      <Header title="" backLabel={t("leads.back")} onBack={back} moreLabel={t("leads.more")} onMore={() => undefined} />
      <ExpandScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Section row align="flex-end" justify="space-between" gap={12} pt={2} px={16}>
          <Stack gap={6} px={4} grow>
            <PageTitle>{t("leads.title")}</PageTitle>
            {loading ? <Skeleton width={200} height={14} radius={6} /> : !failed ? <Text size={13.5} color="muted">{dueLine()}</Text> : null}
          </Stack>
          {!failed ? <Button size="sm" label={t("leads.add")} icon={<Glyph name="plus" size={14} weight={2.4} color="on-inv" />} onPress={() => setForm((f) => !f)} /> : null}
        </Section>
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("leads.loadFailed.title")} body={t("leads.loadFailed.body")} action={t("leads.loadFailed.retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={18} px={16} gap={12}><Skeleton height={44} radius={14} /><Skeleton height={130} radius={22} /><Skeleton height={130} radius={22} /></Section>
        ) : (
          <>
            {form ? <Section pt={16} px={16}><NewLeadForm labels={labels} busy={saving} onSave={(d) => void save(d)} onClose={() => setForm(false)} /></Section> : null}
            {all.length > 0 ? (
              <Section delay={60} pt={18}>
                <LeadTabs label={t("leads.stageLabel")} active={stageIx} onChange={(i) => { setStageIx(i); setNotice(null); }}
                  tabs={STAGES.map((s) => ({ key: s, label: stageName(s), count: counts[s] }))} />
              </Section>
            ) : null}
            {q.isError ? <Section pt={14} px={16}><Banner tone="info" icon="warn" iconTone="amber" lead={t("leads.offline")} /></Section> : null}
            {notice ? <Section pt={14} px={16}><LeadNotice text={notice.text} undo={notice.undo ? t("leads.notice.undo") : undefined} onUndo={notice.undo} /></Section> : null}
            {all.length === 0 ? (
              <Section pt={26} px={16}><Empty icon="users" iconTone="slate" title={t("leads.none.title")} body={t("leads.none.body")} action={t("leads.none.action")} onAction={() => setForm(true)} /></Section>
            ) : shown.length > 0 ? (
              <Section pt={14} pb={24} px={16} gap={12}>{shown.map(card)}</Section>
            ) : null}
            {all.length > 0 && shown.length === 0 && !(stage === "new") ? (
              <Section delay={120} pt={48} px={16}><Empty icon="users" iconTone="slate" title={t(`leads.empty.${stage}.title`)} body={t(`leads.empty.${stage}.body`)} padding={{ v: 0, h: 28 }} /></Section>
            ) : null}
            {all.length > 0 && shown.length === 0 && stage === "new" ? (
              <Section delay={120} pt={26} px={16}><Empty icon="users" iconTone="slate" title={t("leads.empty.new.title")} body={t("leads.empty.new.body")} padding={{ v: 0, h: 28 }} /></Section>
            ) : null}
            {stage === "new" || all.length === 0 ? (
              <Section delay={120} pt={12} pb={40} px={16}>
                <ConnectCard title={t("leads.connect.title")} sub={t("leads.connect.sub")} action={t("leads.connect.action")} onPress={() => router.push(screenHref("SetWidget", t("leads.connect.title")))} />
              </Section>
            ) : null}
          </>
        )}
      </ExpandScrollView>
    </Screen>
  );
}

/** A lead card: the expandable card, closed on the head and open on the children. */
function LeadCard({ l, ask, sourceIcon, sourceTone, source, when, won, follow, followTone, followLabel, children }: {
  l: Lead; ask: string; sourceIcon: IconName; sourceTone: Tone; source: string; when: string; won?: string; follow?: string; followTone?: "late" | "due" | "plain"; followLabel: string; children: React.ReactNode;
}) {
  const isOpen = useExpandOpen(l.id);
  return (
    <ExpandCard id={l.id} label={l.name} head={
      <LeadHead initials={initialsOf(l.name)} tint={leadTint(l.name)} name={l.name} sourceIcon={sourceIcon} sourceTone={sourceTone} source={`${source} · ${when}`} wonLabel={won} ask={ask}
        open={isOpen} follow={follow} followTone={followTone} followLabel={followLabel} />
    } list="leads">
      {children}
    </ExpandCard>
  );
}
