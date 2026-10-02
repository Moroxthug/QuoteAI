// CrewHours.dc.html. "Hours by hand, for a day you forgot to clock": pick the day (the last seven), the job, the start and finish (15-minute steps, or Usual / Half / Long day),
// a break, why it is by hand and a note; the total shows as you go and it goes to the office for approval. With no signal it is kept on the phone and sent later.
// Below, this week's hours with where each stands (approved, to approve, off site at clock-in, sent back). States: default, sent, saved on phone (offline).
import { useState } from "react";
import { RoleTabs } from "@/ui/TabShell";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { tintFor } from "@/lib/clients";
import { ApiFailure } from "@/lib/api";
import { entryLook, handHours, handNote, hoursLabel, hoursOn, lastDays, HAND_REASONS, type CrewEntry } from "@/lib/crew";
import { crewApi } from "@/lib/crewApi";
import { runOrQueue, uuid } from "@/lib/crewOutbox";
import { time, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { useCrew } from "@/lib/useCrew";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { CrewHeader } from "@/ui/Crew";
import { Banner, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { Section, ScrollPage, Stack } from "@/ui/Layout";
import { MenuList, MenuRow, RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { TimeStepper } from "@/ui/Schedule";
import { Segmented } from "@/ui/Segmented";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";

const BREAKS = [0, 15, 30, 60];
const clamp = (v: number) => Math.max(300, Math.min(1320, v));
const label = (m: number, locale: Locale) => time(new Date(2026, 0, 1, Math.floor(m / 60), m % 60), locale);

export default function CrewHours() {
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`crew.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const crew = useCrew();
  const toast = useToast();
  const client = useQueryClient();
  const [dayIx, setDayIx] = useState(1);
  const [jobId, setJobId] = useState<string | null>(null);
  const [start, setStart] = useState(420);
  const [end, setEnd] = useState(930);
  const [brk, setBrk] = useState(30);
  const [reason, setReason] = useState<number>(-1);
  const [note, setNote] = useState("");
  const [needReason, setNeedReason] = useState(false);
  const [sent, setSent] = useState<null | "sent" | "saved">(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);
  const view = crew.view;

  if (!crew.loading && crew.unpaired) return <Redirect href="/crew-pair" />;
  if (crew.problem) return <Redirect href={{ pathname: "/crew-expired", params: { state: crew.problem } } as never} />;
  if (crew.loading || !view) return <Screen><Section pt={72} px={20} gap={14}><Skeleton width={200} height={28} radius={10} /><Skeleton height={420} radius={22} /></Section></Screen>;

  const company = view.companyName || c("expired.yourCompany");
  const days = lastDays(view.today, 7);
  const day = days[dayIx]!;
  const dayDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y!, m! - 1, d!, 12); };
  const dayLong = (i: number) => (i === 0 ? c("hours.today") : new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric" }).format(dayDate(days[i]!)));
  const jobs = view.jobs;
  const chosen = jobId ?? view.activeEntry?.projectId ?? view.todayJobs[0]?.id ?? jobs[0]?.id ?? null;
  const job = jobs.find((j) => j.id === chosen);
  const worked = handHours(start, end, brk);
  const dur = hoursLabel(worked);
  const durText = t("crew.hours.dur", { h: dur.h, m: dur.m });
  const REASON_KEYS = HAND_REASONS;

  const submit = async () => {
    if (reason < 0) { setNeedReason(true); return; }
    if (!chosen || worked <= 0) return;
    const reasonText = c(`hours.reasons.${REASON_KEYS[reason]!}`);
    const body = { projectId: chosen, date: day, hours: Math.max(0.25, worked), note: handNote(reasonText, start, end, brk, note) };
    setBusy(true);
    const ref = uuid();
    try {
      const r = await runOrQueue(() => crewApi.hours(crew.path!, { ...body, clientRef: ref }), { kind: "hours", id: ref, body, label: "hours" });
      setSent(r.done ? "sent" : "saved");
      if (r.done) void client.invalidateQueries({ queryKey: ["crew", crew.path] });
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.status === 400 ? c("hours.future") : c("hours.failed") });
    } finally {
      setBusy(false);
    }
  };

  const weekDays = lastDays(view.today, 7);
  const week = view.entries.filter((e) => weekDays.includes(e.date)).sort((a, b) => b.date.localeCompare(a.date));
  const weekTotal = hoursLabel(hoursOn(view.entries, weekDays));
  const range = (e: CrewEntry) => (e.clockInAt && e.clockOutAt ? c("hours.range", { from: time(new Date(e.clockInAt), locale), to: time(new Date(e.clockOutAt), locale) }) : "");
  const where = (e: CrewEntry) => (e.geofenceFlagged ? e.projectName ?? "" : e.note ? e.note.split(" · ")[0]! : e.clockInAt ? c("hours.clocked") : e.projectName ?? "");

  return (
    <Screen floating={<RoleTabs active="hours" />}>
      <Header title="" backLabel={c("back")} onBack={() => (router.canGoBack() ? router.back() : router.replace("/crew-now"))} />
      <ScrollPage bottom={40}>
        <CrewHeader company={company} initials={initialsOf(company)} switchLabel={c("switchCompany")} worker={initialsOf(view.worker.name)} tint={tintFor(view.worker.name)} workerLabel={view.worker.name} />
        <Section px={20} pt={14} gap={5}>
          <Text size={28} weight={600} tracking={-0.04} leading={1.15} accessibilityRole="header">{c("hours.title")}</Text>
          <Text size={13.5} color="muted">{c("hours.sub")}</Text>
        </Section>

        {sent ? (
          <Section px={16} pt={16} gap={12}>
            <Card padded>
              <Stack gap={8} align="center">
                <Icon name={sent === "sent" ? "send" : "cloud"} tone={sent === "sent" ? "azure" : "amber"} size={44} />
                <Text size={21} weight={600} tracking={-0.03} align="center">{sent === "sent" ? c("hours.sentTitle", { name: c("hours.the") }) : c("hours.savedTitle")}</Text>
                <Text size={13.5} color="muted" align="center" leading={1.45}>{sent === "sent" ? c("hours.sentSub") : c("hours.savedSub")}</Text>
                <Text size={13.5} color="muted" align="center">{`${dayLong(dayIx)} · ${label(start, locale)} – ${label(end, locale)}`}</Text>
                <Num size={28} weight={600} tracking={-0.03}>{durText}</Num>
              </Stack>
            </Card>
            <Button kind="secondary" block label={c("hours.another")} onPress={() => { setSent(null); setReason(-1); setNote(""); setDayIx(Math.min(6, dayIx + 1)); }} />
            <Button block label={c("hours.done")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/crew-now"))} />
          </Section>
        ) : (
          <Section delay={40} px={16} pt={16} gap={14}>
            <Stack gap={6}>
              <Text size={12.5} color="muted">{c("hours.dayLabel")}</Text>
              <ChipStrip label={c("hours.dayLabel")}>
                {days.map((d, i) => <Chip key={d} label={i === 0 ? c("hours.today") : `${new Intl.DateTimeFormat(locale, { weekday: "short" }).format(dayDate(d))} ${dayDate(d).getDate()}`} selected={i === dayIx} onPress={() => setDayIx(i)} />)}
              </ChipStrip>
            </Stack>
            <Card>
              <Stack row align="center" gap={12} px={16} pt={12} pb={12}>
                <Icon name="house" tone="clay" size={28} />
                <Stack grow gap={1}><Text size={12.5} color="muted">{c("hours.job")}</Text><Text size={14.5} weight={500} numberOfLines={1}>{job?.name ?? ""}</Text>{job?.address ? <Text size={12.5} color="muted" numberOfLines={1}>{job.address}</Text> : null}</Stack>
                {jobs.length > 1 ? <Button kind="link" size="sm" label={c("hours.change")} onPress={() => setPick(true)} /> : null}
              </Stack>
            </Card>
            <Card padded>
              <Stack row justify="space-between" align="baseline">
                <Text size={13.5} color="muted">{c("hours.hoursLabel")}</Text>
                <Num size={28} weight={600} tracking={-0.03}>{durText}</Num>
              </Stack>
              <Stack row gap={10} pt={14}>
                <Stack grow gap={6}><Text size={12.5} color="muted">{c("hours.start")}</Text><TimeStepper label={c("hours.start")} value={label(start, locale)} decLabel={c("hours.startEarlier")} incLabel={c("hours.startLater")} onDec={() => setStart(clamp(start - 15))} onInc={() => setStart(Math.min(clamp(start + 15), end - 15))} /></Stack>
                <Stack grow gap={6}><Text size={12.5} color="muted">{c("hours.finish")}</Text><TimeStepper label={c("hours.finish")} value={label(end, locale)} decLabel={c("hours.finishEarlier")} incLabel={c("hours.finishLater")} onDec={() => setEnd(Math.max(clamp(end - 15), start + 15))} onInc={() => setEnd(clamp(end + 15))} /></Stack>
              </Stack>
              <Stack gap={6} pt={14}>
                <Text size={12.5} color="muted">{c("hours.break")}</Text>
                <Segmented label={c("hours.break")} options={BREAKS.map((b) => (b ? c("hours.min", { count: b }) : c("hours.none")))} value={Math.max(0, BREAKS.indexOf(brk))} onChange={(i) => setBrk(BREAKS[i]!)} />
              </Stack>
              <Stack row gap={8} pt={14}>
                <Chip label={`${c("hours.quickUsual")} ${label(420, locale)}`} onPress={() => { setStart(420); setEnd(930); setBrk(30); }} />
                <Chip label={c("hours.quickHalf")} onPress={() => { setStart(420); setEnd(690); setBrk(0); }} />
                <Chip label={c("hours.quickLong")} onPress={() => { setStart(420); setEnd(1050); setBrk(30); }} />
              </Stack>
            </Card>
            <Stack gap={8}>
              <Text size={13.5} weight={600}>{c("hours.why")}</Text>
              <Stack row wrap gap={6}>{REASON_KEYS.map((r, i) => <Chip key={r} label={c(`hours.reasons.${r}`)} selected={reason === i} onPress={() => { setReason(i); setNeedReason(false); }} />)}</Stack>
              {needReason ? <Text size={12.5} color="bad">{c("hours.pickReason")}</Text> : null}
            </Stack>
            <TextField label={c("hours.note", { name: c("hours.the") })} value={note} onChangeText={setNote} multiline />
            <Button size="lg" block label={worked > 0 ? c("hours.send", { dur: durText }) : durText} disabled={worked <= 0 || !chosen} busy={busy ? "…" : false} onPress={() => void submit()} />
            <Text size={12.5} color="faint" align="center">{c("hours.approves", { name: c("hours.the") })}</Text>
          </Section>
        )}

        <Section delay={80} px={16} pt={24}>
          <SectionHeader title={c("hours.week")} link={t("crew.hours.dur", { h: weekTotal.h, m: weekTotal.m })} />
          <Card>
            <RowList>
              {week.map((e) => {
                const look = entryLook(e);
                const d = dayDate(e.date);
                return (
                  <RowBody key={e.id} leading={<Stack w={42} align="center"><Text size={11.5} weight={500} color="muted">{new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d)}</Text><Num size={19} weight={600} tracking={-0.03}>{String(d.getDate())}</Num></Stack>}
                    title={t("crew.hours.dur", { h: hoursLabel(e.hours).h, m: hoursLabel(e.hours).m })} meta={[range(e), where(e)].filter(Boolean).join(" · ")}
                    trailing={<Status tone={look.tone} shape={look.shape}>{c(`hours.${look.key === "toApprove" ? "toApprove" : look.key}`)}</Status>} />
                );
              })}
              {!week.length ? <Stack px={16} pt={14} pb={14}><Text size={13.5} color="muted">{c("tasks.none")}</Text></Stack> : null}
            </RowList>
          </Card>
        </Section>
      </ScrollPage>
      <Sheet open={pick} onClose={() => setPick(false)} label={c("clock.pickJob")} closeLabel={c("close")}>
        <SheetTitle>{c("clock.pickJob")}</SheetTitle>
        <MenuList>{jobs.map((j) => <MenuRow key={j.id} icon={<Icon name="cone" tone="amber" size={28} />} title={j.name} sub={j.address ?? undefined} chevron={false} onPress={() => { setJobId(j.id); setPick(false); }} />)}</MenuList>
      </Sheet>
      {crew.stale ? <Banner tone="info" icon="cloud" iconTone="amber" lead={c("offline")} /> : null}
    </Screen>
  );
}
