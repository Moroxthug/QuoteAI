// Schedule.dc.html. The crew's week: the day and its totals, previous / next week and Today, the week as seven days (a red dot under one with a clash),
// grouped by person or by job. Each lane has a track from 7:00 to 18:00 with its blocks drawn on it (the clash part in red), the blocks that open in place
// (address with Directions, who and when with Move, what to bring), "Free" windows of two hours or more with Book, and "Add block". A block opens in a sheet
// to move or change: worker, job, milestone, day, hours or all day, notes, with the clash called out and a one-tap fix.
// Not built: the board's weather row and the client's phone row (the schedule's data has neither), "Message crew" (no way to text a crew member yet: the
// action is "Move"). States built: loading, can't load, offline, plan (the board needs Pro).
import { useMemo, useState } from "react";
import { RoleTabs, useIsTab } from "@/ui/TabShell";
import { Linking } from "react-native";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { dayDate, number, shortDate, time, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { jobsApi, type SchedBlock } from "@/lib/jobsApi";
import { screenHref } from "@/lib/nav";
import { clashDays, clashOf, DAY_FROM, DAY_TO, hhmm, hoursOf, instants, lanes as buildLanes, overlap, piecesOn, trackPct, weekDays, weekStart, type Piece } from "@/lib/schedule";
import { useSession } from "@/lib/useSession";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { DateSheet } from "@/ui/DateSheet";
import { ExpandCard, ExpandScrollView, XcActions, XcCaption, XcDivider, XcRow, XcButton } from "@/ui/Expand";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header, IconButton } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { Section, Stack } from "@/ui/Layout";
import { MenuList, MenuRow } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { BlockHead, FreeRow, LaneCard, PickRow, TimeStepper, WeekStrip } from "@/ui/Schedule";
import { Segmented } from "@/ui/Segmented";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Text } from "@/ui/Text";
import type { ColorName } from "@/ui/theme";

const PALETTE: ColorName[] = ["acc", "info", "ok-dot", "warn-dot", "bad", "faint"];

type Draft = { id?: string; workerId: string | null; jobId: string | null; milestoneId: string | null; day: Date; from: number; to: number; allDay: boolean; notes: string; reminderAt: string | null };
type Picking = "worker" | "job" | "milestone" | null;

export default function Schedule() {
  const isTab = useIsTab("schedule");
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`sch.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const [start, setStart] = useState(() => weekStart(today));
  const [dayIx, setDayIx] = useState(() => (today.getDay() + 6) % 7);
  const [by, setBy] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const days = useMemo(() => weekDays(start), [start]);
  const day = days[dayIx]!;
  const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
  const q = useQuery({ queryKey: ["schedule", key], queryFn: () => jobsApi.schedule(new Date(start.getFullYear(), start.getMonth(), start.getDate()), new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)), enabled: signedIn, retry: 1, staleTime: 15_000 });
  const data = q.data;
  const blocks: SchedBlock[] = useMemo(() => data?.blocks ?? [], [data]);
  const people = useMemo(() => (data?.workers ?? []).map((w) => ({ id: w.id, name: w.name })), [data]);
  const jobs = useMemo(() => (data?.jobs ?? []).map((j) => ({ id: j.id, name: j.name })), [data]);
  const jobColor = (id: string | null): ColorName => (id ? PALETTE[Math.max(0, jobs.findIndex((j) => j.id === id)) % PALETTE.length]! : "faint");
  const personById = (id: string | null) => (data?.workers ?? []).find((w) => w.id === id);
  const jobById = (id: string | null) => (data?.jobs ?? []).find((j) => j.id === id);
  if (status === "out") return <Redirect href="/" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SmartHome", t("tabs.home"))));
  const weekend = dayIx >= 5;
  const todays = piecesOn(blocks, day);
  const clashing = todays.filter((p) => clashOf(p, todays));
  const flags = clashDays(blocks, days);
  const refresh = () => void client.invalidateQueries({ queryKey: ["schedule"] });
  const money = (n: number) => number(Math.round(n * 10) / 10, locale, Number.isInteger(Math.round(n * 10) / 10) ? 0 : 1);
  const hoursText = (n: number) => c("hoursOf", { count: money(n) });
  const todayLabel = new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric" }).format(day);
  const sub = todays.length ? `${c("blocks", { count: todays.length })} · ${hoursText(hoursOf(todays))}${clashing.length ? c("withClash", { clash: c("clash", { count: Math.ceil(clashing.length / 2) }) }) : ""}` : c("nothing");
  const goWeek = (n: number) => { setStart(new Date(start.getFullYear(), start.getMonth(), start.getDate() + n * 7, 12)); };
  const goToday = () => { setStart(weekStart(today)); setDayIx((today.getDay() + 6) % 7); };

  const laneList = buildLanes(blocks, day, by === 0 ? "person" : "job", people, jobs, !weekend);
  const segsOf = (ps: Piece[], all: Piece[]) => [
    ...ps.map((p) => ({ from: trackPct(p.from), to: trackPct(p.to), color: jobColor(p.block.projectId) })),
    ...ps.flatMap((p) => { const o = clashOf(p, all); return o && p.from >= o.from ? [{ from: trackPct(Math.max(p.from, o.from)), to: trackPct(Math.min(p.to, o.to)), color: "bad" as ColorName }] : []; }),
  ];

  // ── The editor ────────────────────────────────────────────────────────────
  const blank = (workerId: string | null, from: number, to: number): Draft => ({ workerId, jobId: jobs[0]?.id ?? null, milestoneId: null, day: new Date(day), from, to, allDay: false, notes: "", reminderAt: null });
  const edit = (b: SchedBlock, p: Piece): Draft => ({ id: b.id, workerId: b.collaboratorId, jobId: b.projectId, milestoneId: b.milestoneId, day: new Date(day), from: p.from, to: p.to, allDay: b.allDay, notes: b.notes, reminderAt: b.reminderSentAt ?? null });
  const patch = (o: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...o } : d));
  const others = (d: Draft) => piecesOn(blocks, d.day).filter((p) => p.block.id !== d.id && d.workerId && p.block.collaboratorId === d.workerId);
  const conflict = (d: Draft): Piece | null => others(d).find((p) => Math.min(d.to, p.to) - Math.max(d.from, p.from) > 0) ?? null;

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    const from = draft.allDay ? DAY_FROM : draft.from;
    const to = draft.allDay ? DAY_TO : draft.to;
    const body = { projectId: draft.jobId, milestoneId: draft.milestoneId, collaboratorId: draft.workerId, ...instants(draft.day, from, to), allDay: draft.allDay, notes: draft.notes };
    try {
      if (draft.id) await jobsApi.saveBlock(draft.id, body); else await jobsApi.addBlock(body);
      refresh();
      setDraft(null);
    } catch {
      toast({ message: c("sheet.saveFailed") });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!draft?.id) { setDraft(null); return; }
    try { await jobsApi.deleteBlock(draft.id); refresh(); setDraft(null); } catch { toast({ message: c("sheet.deleteFailed") }); }
  };

  const failed = q.isError && !data;
  const planNeeded = q.error instanceof ApiFailure && q.error.status === 403;

  const blockRow = (p: Piece, all: Piece[], forJob: boolean) => {
    const b = p.block;
    const other = clashOf(p, all);
    const job = jobById(b.projectId);
    const w = personById(b.collaboratorId);
    const ov = other ? overlap(p, other) : 0;
    const titleText = forJob ? (b.collaboratorName ?? c("sheet.noWorker")) : (job?.name ?? b.projectName ?? b.title ?? "");
    const what = b.milestoneTitle || b.title || undefined;
    return (
      <ExpandCard key={`${b.id}-${p.from}`} id={`${b.id}-${p.from}`} variant="row" list="sched" label={titleText}
        head={<BlockHead color={jobColor(b.projectId)} title={titleText} time={`${hhmm(p.from)} – ${hhmm(p.to)}`} sub={what} clash={other ? <Status tone="bad" shape="alert">{c("clashLabel", { hours: money(ov) })}</Status> : undefined} />}>
        <XcDivider />
        <XcCaption>{[job?.name ?? b.projectName, what].filter(Boolean).join(" · ")}</XcCaption>
        {job?.address ? <XcRow first title={job.address} right={<XcButton label={c("open.directions")} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`)} />} /> : null}
        <XcRow title={w?.name ?? b.collaboratorName ?? c("sheet.noWorker")} sub={`${hhmm(p.from)} – ${hhmm(p.to)}`}
          right={<>{other ? <Status plain tone="bad" shape="alert">{c("open.clashes", { job: other.block.projectName ?? "" })}</Status> : null}<XcButton label={c("open.move")} onPress={() => setDraft(edit(b, p))} /></>} />
        {b.notes ? <XcRow title={c("open.bring")} sub={b.notes} /> : null}
        <XcActions link={c("open.move")} onLink={() => setDraft(edit(b, p))} main={c("open.openJob")} onMain={() => b.projectId && router.push(screenHref("Job", job?.name ?? "", { id: b.projectId }))} />
      </ExpandCard>
    );
  };

  const d = draft;
  const dConflict = d ? conflict(d) : null;
  const dWorker = d ? personById(d.workerId) : undefined;
  const dJob = d ? jobById(d.jobId) : undefined;
  const dMilestone = dJob?.milestones.find((m) => m.id === d?.milestoneId);

  return (
    <Screen floating={isTab ? <RoleTabs active="schedule" /> : <ActionBar label={c("addBlock")} onPress={() => setDraft(blank(people[0]?.id ?? null, 13, 15))} moreLabel={c("more")} />}>
      <Header title="" backLabel={c("back")} onBack={back} moreLabel={c("more")} onMore={() => undefined} />
      <ExpandScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: ACTION_BAR_SPACE }}>
        <Section row align="center" justify="space-between" pt={6} px={20}>
          <Stack gap={2} grow>
            <Text size={24} weight={600} tracking={-0.035} accessibilityRole="header" numberOfLines={1}>{todayLabel}</Text>
            <Text size={12.5} color="muted">{sub}</Text>
          </Stack>
          <Stack row align="center">
            <IconButton glyph="back" label={c("prevWeek")} onPress={() => goWeek(-1)} />
            <Button kind="secondary" size="sm" label={c("today")} onPress={goToday} />
            <IconButton glyph="chevron" label={c("nextWeek")} onPress={() => goWeek(1)} />
          </Stack>
        </Section>
        <Section delay={50} pt={14} px={16}>
          <WeekStrip label={c("weekOf", { date: shortDate(start, locale) })} current={dayIx} onPick={setDayIx}
            days={days.map((x, i) => ({ weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(x), n: String(x.getDate()), weekend: i >= 5, clash: flags[i]! }))} />
        </Section>
        <Section delay={90} pt={14} px={16}><Segmented label={c("groupBy")} options={[c("byPerson"), c("byJob")]} value={by} onChange={setBy} /></Section>
        {clashing.length ? (
          <Section delay={110} pt={12} px={16}>
            <Banner tone="bad" icon="warn" iconTone="rose" lead={c("clashTitle", { name: (clashing[0]!.block.collaboratorName ?? "").split(" ")[0] ?? "" })}>
              {c("clashText", { a: clashing[0]!.block.projectName ?? "", b: clashOf(clashing[0]!, todays)?.block.projectName ?? "" })}
            </Banner>
          </Section>
        ) : null}
        {planNeeded ? (
          <Section pt={26} px={16}><Empty icon="cal" iconTone="sky" title={c("planNeeded")} body="" /></Section>
        ) : failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={c("loadFailed.title")} body={c("loadFailed.body")} action={c("loadFailed.retry")} onAction={() => void q.refetch()} /></Section>
        ) : q.isPending && !data ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={150} radius={22} /><Skeleton height={150} radius={22} /></Section>
        ) : (
          <>
            {q.isError ? <Section pt={12} px={16}><Banner tone="info" icon="warn" iconTone="amber" lead={c("offline")} /></Section> : null}
            <Section row justify="space-between" pt={16} px={20}><Text size={11.5} color="faint">7:00</Text><Text size={11.5} color="faint">12:30</Text><Text size={11.5} color="faint">18:00</Text></Section>
            {laneList.map((lane) => {
              const w = lane.kind === "person" ? personById(lane.id) : undefined;
              const job = lane.kind === "job" ? jobById(lane.id) : undefined;
              const hrs = hoursOf(lane.pieces);
              return (
                <Section key={lane.key} delay={130} pt={8} px={16}>
                  <LaneCard person={lane.kind === "person" ? { initials: initialsOf(lane.title), tint: tintFor(lane.title) } : undefined} job={lane.kind === "job" ? { color: jobColor(lane.id) } : undefined}
                    title={lane.title || c("sheet.noWorker")} sub={lane.kind === "person" ? (w?.role || undefined) : (job?.address || undefined)} hours={hrs ? hoursText(hrs) : undefined} segs={segsOf(lane.pieces, todays)}>
                    {lane.pieces.map((p) => blockRow(p, todays, lane.kind === "job"))}
                    {lane.free.map(([a, z]) => (
                      <FreeRow key={`${a}-${z}`} label={c("free")} time={`${hhmm(a)} – ${hhmm(z)}`} action={c("book")} onPress={() => setDraft(blank(lane.id, a, Math.min(z, a + 4)))} />
                    ))}
                    {!lane.pieces.length && weekend ? <Stack pt={4} pb={10}><Text size={13.5} color="muted">{c("nothingBooked")}</Text></Stack> : null}
                  </LaneCard>
                </Section>
              );
            })}
          </>
        )}
      </ExpandScrollView>

      <Sheet open={!!d} onClose={() => { setDraft(null); setPicking(null); }} label={d?.id ? c("sheet.editBlock") : c("sheet.newBlock")} closeLabel={t("close")}>
        {d && picking ? (
          <>
            <SheetTitle>{picking === "worker" ? c("sheet.pickWorker") : picking === "job" ? c("sheet.pickJob") : c("sheet.pickMilestone")}</SheetTitle>
            <MenuList>
              {picking === "worker" ? [{ id: null as string | null, name: c("sheet.noWorker"), role: "" }, ...(data?.workers ?? [])].map((w) => (
                <MenuRow key={w.id ?? "none"} icon={<Avatar initials={initialsOf(w.name)} tint={tintFor(w.name)} size={28} />} title={w.name} sub={w.role || undefined} chevron={false} onPress={() => { patch({ workerId: w.id }); setPicking(null); }} />
              )) : picking === "job" ? [{ id: null as string | null, name: c("sheet.noJob"), milestones: [] as { id: string; title: string }[] }, ...(data?.jobs ?? [])].map((j) => (
                <MenuRow key={j.id ?? "none"} icon={<Icon name="cone" tone="amber" size={28} />} title={j.name} chevron={false} onPress={() => { patch({ jobId: j.id, milestoneId: null }); setPicking(null); }} />
              )) : [{ id: null as string | null, title: c("sheet.noMilestone") }, ...(dJob?.milestones ?? [])].map((m) => (
                <MenuRow key={m.id ?? "none"} icon={<Icon name="list" tone="violet" size={28} />} title={m.title} chevron={false} onPress={() => { patch({ milestoneId: m.id }); setPicking(null); }} />
              ))}
            </MenuList>
          </>
        ) : d ? (
          <>
            <SheetTitle>{d.id ? c("sheet.editBlock") : c("sheet.newBlock")}</SheetTitle>
            <Stack px={20} gap={14} pb={8}>
              <Text size={12.5} color="muted">{[dWorker?.name ?? c("sheet.noWorker"), dayDate(d.day, locale)].join(" · ")}</Text>
              <Stack gap={6}>
                <Text size={12.5} color="muted">{c("sheet.worker")}</Text>
                <PickRow label={c("sheet.worker")} value={dWorker?.name ?? c("sheet.noWorker")} hint={dWorker?.role} lead={<Avatar initials={initialsOf(dWorker?.name ?? "")} tint={tintFor(dWorker?.name ?? "")} size={28} />} onPress={() => setPicking("worker")} />
              </Stack>
              <Stack row gap={10}>
                <Stack grow gap={6}><Text size={12.5} color="muted">{c("sheet.job")}</Text><PickRow label={c("sheet.job")} value={dJob?.name ?? c("sheet.noJob")} onPress={() => setPicking("job")} /></Stack>
                <Stack grow gap={6}><Text size={12.5} color="muted">{c("sheet.milestone")}</Text><PickRow label={c("sheet.milestone")} value={dMilestone?.title ?? c("sheet.noMilestone")} onPress={() => setPicking("milestone")} /></Stack>
              </Stack>
              <Stack row gap={10}>
                <Stack grow gap={6}><Text size={12.5} color="muted">{c("sheet.from")}</Text><PickRow label={c("sheet.from")} value={dayDate(d.day, locale)} onPress={() => setDateOpen(true)} /></Stack>
                <Stack grow gap={6}><Text size={12.5} color="muted">{c("sheet.to")}</Text><PickRow label={c("sheet.to")} value={dayDate(d.day, locale)} onPress={() => setDateOpen(true)} /></Stack>
              </Stack>
              <Stack row align="center" justify="space-between">
                <Text size={12.5} color="muted">{c("sheet.hours")}</Text>
                <Stack w={170}><Segmented label={c("sheet.hours")} options={[c("sheet.hours"), c("sheet.allDay")]} value={d.allDay ? 1 : 0} onChange={(i) => patch(i === 1 ? { allDay: true, from: DAY_FROM, to: DAY_TO } : { allDay: false })} /></Stack>
              </Stack>
              {!d.allDay ? (
                <Stack row gap={10}>
                  <Stack grow><TimeStepper label={c("sheet.start")} value={hhmm(d.from)} decLabel={c("sheet.startEarlier")} incLabel={c("sheet.startLater")} onDec={() => patch({ from: Math.max(6, d.from - 0.5) })} onInc={() => d.from + 0.5 < d.to && patch({ from: d.from + 0.5 })} /></Stack>
                  <Stack grow><TimeStepper label={c("sheet.end")} value={hhmm(d.to)} decLabel={c("sheet.endEarlier")} incLabel={c("sheet.endLater")} onDec={() => d.to - 0.5 > d.from && patch({ to: d.to - 0.5 })} onInc={() => patch({ to: Math.min(18, d.to + 0.5) })} /></Stack>
                </Stack>
              ) : null}
              {dConflict && !d.allDay ? (
                <Banner tone="bad" icon="warn" iconTone="rose" lead={c("sheet.clashLead", { job: dConflict.block.projectName ?? "" })} link={c("sheet.fix", { time: hhmm(dConflict.to) })} onLink={() => patch({ from: dConflict.to, to: Math.min(18, dConflict.to + (d.to - d.from)) })}>{c("sheet.clashTime", { from: hhmm(dConflict.from), to: hhmm(dConflict.to) })}</Banner>
              ) : d.workerId ? <Banner tone="ok" icon="check" iconTone="sage" lead={c("sheet.free", { name: (dWorker?.name ?? "").split(" ")[0] ?? "" })} /> : null}
              <TextField label={c("sheet.notes")} value={d.notes} onChangeText={(v) => patch({ notes: v })} placeholder={c("sheet.notesPlaceholder")} multiline />
              <Stack row align="center" gap={8}>
                <Icon name="bell" tone="amber" size={20} />
                <Text size={12.5} color="muted" style={{ flexShrink: 1 }}>{d.reminderAt ? c("sheet.reminderSent", { name: (dWorker?.name ?? "").split(" ")[0] ?? "", time: time(new Date(d.reminderAt), locale) }) : c("sheet.reminder")}</Text>
              </Stack>
            </Stack>
            <Stack row gap={10} px={20} pt={10} pb={30}>
              <Button kind="destructive" label={c("sheet.delete")} onPress={() => void remove()} />
              <Button grow label={busy ? c("sheet.saving") : dConflict && !d.allDay ? c("sheet.saveAnyway") : c("sheet.save")} busy={busy ? c("sheet.saving") : false} onPress={() => void save()} />
            </Stack>
          </>
        ) : null}
      </Sheet>
      <DateSheet open={dateOpen} onClose={() => setDateOpen(false)} title={c("sheet.from")} closeLabel={t("close")} prevLabel={t("jobSetup.prevMonth")} nextLabel={t("jobSetup.nextMonth")} locale={locale} value={d?.day ?? null} onPick={(x) => patch({ day: x })} />
    </Screen>
  );
}

