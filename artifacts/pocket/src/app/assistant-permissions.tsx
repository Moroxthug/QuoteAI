// AssistantPermissions.dc.html. How much the assistant handles on its own, area by area: Follow-ups, Invoice reminders, Receipts, Scheduling and Crew
// messages are each Ask me first / Do it and tell me / Off; price changes always ask; the spending limit; quiet hours (the start and the end in a sheet,
// and all of Sunday); the voice (chosen in Settings) and reading a message back first. Every change is saved at once, with Undo in the toast; offline it
// waits on the phone. States: default, view only, offline, loading and can't load.
// Not honoured yet by the rest of the app (they are saved and shown, nothing reads them): the Receipts, Scheduling and Crew messages levels, quiet
// hours and Read it back. Follow-ups and Invoice reminders are (they decide whether a nudge is drafted for a yes, sent, or left alone).
import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { LIMIT_MAX_CENTS, LIMIT_STEP_CENTS, QUIET_STEP, RECOMMENDED, RECOMMENDED_LIMIT_CENTS, badge, clockLabel, moveMinute, type Level, type LevelKey, type Permissions } from "@/lib/assistant";
import { assistantApi, type PermissionsPatch } from "@/lib/assistantApi";
import { flushPermissions, pendingPermissions } from "@/lib/assistantSync";
import { money, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { AssistantHead, AssistantTabs, CrossIcon, LevelSegment, LimitStepper, LockCard, PermGroup, PermRow, ValueLink, VoiceOrbs } from "@/ui/Assistant";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Swirl } from "@/ui/Logo";
import { ListRow, RowChevron, RowList } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Stepper } from "@/ui/Stepper";
import { Switch } from "@/ui/Switch";
import { Tag } from "@/ui/Status";

type State = Omit<Permissions, "enabled" | "canEdit">;
const LEVEL_ROWS: { key: LevelKey; icon: "chat" | "bell" | "receipt" | "cal" | "users"; tone: "violet" | "amber" | "sky" | "teal"; group: "clients" | "money" | "team" }[] = [
  { key: "followups", icon: "chat", tone: "violet", group: "clients" },
  { key: "reminders", icon: "bell", tone: "amber", group: "clients" },
  { key: "receipts", icon: "receipt", tone: "amber", group: "money" },
  { key: "scheduling", icon: "cal", tone: "sky", group: "team" },
  { key: "crew", icon: "users", tone: "teal", group: "team" },
];
const LEVEL_WORD = ["ask", "tell", "off"] as const;
const SAVE_DELAY = 500;

export default function AssistantPermissions() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`as.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["assistant", "permissions"], queryFn: assistantApi.permissions, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const overview = useQuery({ queryKey: ["assistant", "overview"], queryFn: assistantApi.overview, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const voiceQ = useQuery({ queryKey: ["me", "preferences"], queryFn: assistantApi.voice, enabled: signedIn, retry: 0, staleTime: 60_000 });
  const data = q.data;

  const [local, setLocal] = useState<State | null>(null);
  const [timeSheet, setTimeSheet] = useState<null | "from" | "until">(null);
  const pending = useRef<PermissionsPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cur: State | null = local ?? (data ? { levels: data.levels, spendLimitCents: data.spendLimitCents, quiet: data.quiet, readBack: data.readBack } : null);
  const offline = q.isError || status === "offline";
  const canEdit = data?.canEdit ?? false;

  // What was changed offline goes out once there is a connection.
  useEffect(() => {
    if (!signedIn || !q.isSuccess) return;
    let live = true;
    void flushPermissions().then((sent) => { if (live && sent) void client.invalidateQueries({ queryKey: ["assistant", "permissions"] }); });
    return () => { live = false; };
  }, [signedIn, q.isSuccess, q.dataUpdatedAt, client]);

  const send = useCallback(async () => {
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;
    try {
      await assistantApi.savePermissions(patch);
      void client.invalidateQueries({ queryKey: ["assistant", "permissions"] });
    } catch (e) {
      if (e instanceof ApiFailure && e.offline) { await pendingPermissions.queue(patch); return; }
      setLocal(null);
      void client.invalidateQueries({ queryKey: ["assistant", "permissions"] });
      toast({ message: t(e instanceof ApiFailure && e.status === 403 ? "m.toast.noAccess" : "m.toast.failed") });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, toast]);

  // Leaving with a change waiting sends it now.
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void assistantApi.savePermissions(pending.current).catch(() => pendingPermissions.queue(pending.current)); } }, []);

  /** Applies a change on the phone at once and saves it a moment later (a run of taps on the stepper is one save). */
  const change = (next: State, patch: PermissionsPatch) => {
    setLocal(next);
    pending.current = { ...pending.current, ...patch, ...(patch.levels ? { levels: { ...pending.current.levels, ...patch.levels } } : null), ...(patch.quiet ? { quiet: { ...pending.current.quiet, ...patch.quiet } } : null) };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void send(), SAVE_DELAY);
  };

  const setLevel = (key: LevelKey, label: string, i: number) => {
    if (!cur || cur.levels[key] === i) return;
    const prev = cur;
    change({ ...cur, levels: { ...cur.levels, [key]: i as Level } }, { levels: { [key]: i as Level } });
    toast({
      lead: t("m.toast.set", { label }), message: `${t(`m.level.${LEVEL_WORD[i]!}`).toLowerCase()}${offline ? t("m.toast.applyLater") : "."}`,
      action: t("undo"), onAction: () => change(prev, { levels: { [key]: prev.levels[key] } }), duration: 5000,
    });
  };

  const reset = () => {
    if (!cur) return;
    const prev = cur;
    change({ ...cur, levels: { ...RECOMMENDED }, spendLimitCents: RECOMMENDED_LIMIT_CENTS }, { levels: { ...RECOMMENDED }, spendLimitCents: RECOMMENDED_LIMIT_CENTS });
    toast({ lead: t("m.toast.reset"), message: t("m.toast.resetSub"), action: t("undo"), onAction: () => change(prev, { levels: { ...prev.levels }, spendLimitCents: prev.spendLimitCents }), duration: 5000 });
  };

  const setQuiet = (patch: Partial<State["quiet"]>) => { if (cur) change({ ...cur, quiet: { ...cur.quiet, ...patch } }, { quiet: patch }); };

  if (status === "out") return <Redirect href="/" />;

  const loading = q.isPending && !data;
  const failed = q.isError && !data;
  const locked = !!data && !data.enabled;
  const waiting = overview.data?.pending.length ?? 0;
  const voice = voiceQ.data?.preferences.voice ?? "ember";
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SmartHome", t("brand"))));
  const ro = !canEdit;

  const levelRow = (r: (typeof LEVEL_ROWS)[number], first: boolean) => {
    const i = cur!.levels[r.key];
    const label = t(`m.${r.key}.label`);
    return (
      <PermRow key={r.key} first={first} icon={r.icon} tone={r.tone} label={label} sub={t(`m.${r.key}.s${i}`)}
        below={<LevelSegment options={[t("m.level.ask"), t("m.level.tell"), t("m.level.off")]} value={i} onChange={(n) => setLevel(r.key, label, n)} disabled={ro} label={label} />} />
    );
  };

  const time = timeSheet && cur ? (timeSheet === "from" ? cur.quiet.from : cur.quiet.until) : 0;

  return (
    <Screen>
      <Header title={t("brand")} titleIcon={<Swirl />} backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={96} sticky={[0]}>
        <AssistantTabs active={2} count={waiting ? badge(waiting) : undefined} onTab={(i) => { if (i === 0) router.replace(screenHref("AssistantProposals", t("tabs.proposals"))); if (i === 1) router.replace(screenHref("AssistantActivity", t("tabs.activity"))); }} />
        <Section><AssistantHead title={t("m.title")} sub={t("m.sub")} /></Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={26} px={16} gap={14}><Skeleton height={240} radius={22} /><Skeleton height={160} radius={22} /><Skeleton height={200} radius={22} /></Section>
        ) : locked ? (
          <Section delay={40} pt={18} px={16}>
            <LockCard title={t("locked.title")} body={t("locked.body")} tag={t("locked.tag")} note={t("locked.note")} action={t("locked.action")} onAction={() => router.push(screenHref("SetPlan", t("locked.action")))} />
          </Section>
        ) : cur ? (
          <>
            {offline ? <Section pt={14} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("m.offline")}</Banner></Section> : null}
            {ro ? <Section pt={14} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("m.readOnly.lead")}>{t("m.readOnly.body")}</Banner></Section> : null}

            <Section delay={60}>
              <PermGroup title={t("m.g.clients")}>{LEVEL_ROWS.filter((r) => r.group === "clients").map((r, i) => levelRow(r, i === 0))}</PermGroup>
            </Section>

            <Section delay={120}>
              <PermGroup title={t("m.g.money")} note={t("m.limit.note", { max: money(LIMIT_MAX_CENTS / 100, locale, { cents: false }) })}>
                {LEVEL_ROWS.filter((r) => r.group === "money").map((r, i) => levelRow(r, i === 0))}
                <PermRow icon="tag" tone="clay" label={t("m.price.label")} sub={t("m.price.sub")} control={<Tag>{t("m.always")}</Tag>}
                  below={<LevelSegment options={[t("m.level.ask"), t("m.level.tell"), t("m.level.off")]} value={0} onChange={() => {}} disabled label={t("m.price.label")} />} />
                <PermRow icon="card" tone="sage" label={t("m.limit.label")} sub={t("m.limit.sub")}
                  control={<LimitStepper value={money(cur.spendLimitCents / 100, locale, { cents: false })} decLabel={t("m.limit.dec")} incLabel={t("m.limit.inc")} canDec={cur.spendLimitCents > 0} canInc={cur.spendLimitCents < LIMIT_MAX_CENTS} disabled={ro}
                    onDec={() => change({ ...cur, spendLimitCents: Math.max(0, cur.spendLimitCents - LIMIT_STEP_CENTS) }, { spendLimitCents: Math.max(0, cur.spendLimitCents - LIMIT_STEP_CENTS) })}
                    onInc={() => change({ ...cur, spendLimitCents: Math.min(LIMIT_MAX_CENTS, cur.spendLimitCents + LIMIT_STEP_CENTS) }, { spendLimitCents: Math.min(LIMIT_MAX_CENTS, cur.spendLimitCents + LIMIT_STEP_CENTS) })} />} />
              </PermGroup>
            </Section>

            <Section delay={180}>
              <PermGroup title={t("m.g.team")}>{LEVEL_ROWS.filter((r) => r.group === "team").map((r, i) => levelRow(r, i === 0))}</PermGroup>
            </Section>

            <Section delay={240}>
              <PermGroup title={t("m.g.quiet")}>
                <PermRow first icon="moon" tone="indigo" label={t("m.quiet.label")} sub={t(cur.quiet.on ? "m.quiet.on" : "m.quiet.off")} control={<Switch value={cur.quiet.on} onChange={(v) => setQuiet({ on: v })} label={t("m.quiet.label")} disabled={ro} />} />
                <PermRow icon="clock" tone="slate" label={t("m.quiet.from")} sub={t("m.quiet.fromSub")}
                  control={<ValueLink value={clockLabel(cur.quiet.from, locale)} label={t("m.quiet.fromAria", { time: clockLabel(cur.quiet.from, locale) })} onPress={() => setTimeSheet("from")} disabled={ro} />} />
                <PermRow icon="sun" tone="amber" label={t("m.quiet.until")} sub={t("m.quiet.untilSub")}
                  control={<ValueLink value={clockLabel(cur.quiet.until, locale)} label={t("m.quiet.untilAria", { time: clockLabel(cur.quiet.until, locale) })} onPress={() => setTimeSheet("until")} disabled={ro} />} />
                <PermRow icon="cal" tone="stone" label={t("m.quiet.sunday")} sub={t("m.quiet.sundaySub")} control={<Switch value={cur.quiet.sunday} onChange={(v) => setQuiet({ sunday: v })} label={t("m.quiet.sunday")} disabled={ro} />} />
              </PermGroup>
            </Section>

            <Section delay={300}>
              <PermGroup title={t("m.g.voice")}>
                <PermRow first icon="wave" tone="violet" label={t("m.voice.label")} sub={t("m.voice.sub", { name: t(`m.voice.${voice}`) })}
                  control={<VoiceOrbs chosen={voice} label={t("m.voice.change")} onPress={() => router.push(screenHref("Settings", t("m.voice.change")))} />} />
                <PermRow icon="speaker" tone="lilac" label={t("m.voice.readBack")} sub={t("m.voice.readBackSub")} control={<Switch value={cur.readBack} onChange={(v) => change({ ...cur, readBack: v }, { readBack: v })} label={t("m.voice.readBack")} disabled={ro} />} />
              </PermGroup>
            </Section>

            <Section delay={360} pt={26} px={16}>
              <Card>
                <RowList>
                  <ListRow title={t("m.link.activity")} meta={t("m.link.activitySub")} leading={<CrossIcon name="list" tone="indigo" />} trailing={<RowChevron />} onPress={() => router.replace(screenHref("AssistantActivity", t("tabs.activity")))} />
                  <ListRow title={t("m.link.proposals")} meta={waiting ? t("m.link.proposalsSub", { count: waiting }) : t("m.link.proposalsNone")} leading={<CrossIcon name="bell" tone="violet" />} trailing={<RowChevron />} onPress={() => router.replace(screenHref("AssistantProposals", t("tabs.proposals")))} />
                </RowList>
              </Card>
              <Stack pt={14}><Button kind="secondary" size="md" label={t("m.reset")} block disabled={ro} onPress={reset} /></Stack>
            </Section>
          </>
        ) : null}
      </ScrollPage>

      <Sheet open={timeSheet !== null} onClose={() => setTimeSheet(null)} label={t(timeSheet === "until" ? "m.time.until" : "m.time.from")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={18} align="center">
          <SheetTitle>{t(timeSheet === "until" ? "m.time.until" : "m.time.from")}</SheetTitle>
          <Stepper value={clockLabel(time, locale)} decLabel={t("m.time.earlier")} incLabel={t("m.time.later")}
            onDec={() => setQuiet(timeSheet === "from" ? { from: moveMinute(time, -QUIET_STEP) } : { until: moveMinute(time, -QUIET_STEP) })}
            onInc={() => setQuiet(timeSheet === "from" ? { from: moveMinute(time, QUIET_STEP) } : { until: moveMinute(time, QUIET_STEP) })} />
          <Stack w={240}><Button label={t("m.time.done")} onPress={() => setTimeSheet(null)} block /></Stack>
        </Stack>
      </Sheet>
    </Screen>
  );
}

