// Job.dc.html, the Team tab: hours waiting for approval (Approve, Approve all), "Log hours" for someone, the people on the job with
// their hours, "Assign" and the job-site radius for clock-in. Time tracking is a higher plan's feature: the server says so and the tab shows it.
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { dayDate, number, time, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import type { JobDetail, TimeEntryRow } from "@/lib/jobDetail";
import { isoDay, parseDay } from "@/lib/jobSetup";
import { crewOnJob, hoursText, hoursToApprove } from "@/lib/jobTeam";
import { jobsApi } from "@/lib/jobsApi";
import { teamApi } from "@/lib/teamApi";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipWrap } from "@/ui/Chip";
import { DateSheet } from "@/ui/DateSheet";
import { useToast } from "@/ui/Feedback";
import { SelectField, TextField } from "@/ui/Field";
import { Glyph } from "@/ui/Icon";
import { Section, Stack } from "@/ui/Layout";
import { Press } from "@/ui/motion";
import { MenuList, MenuRow, RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { MiniStepper } from "@/ui/JobSetup";
import { Status } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";
import { usePrimary } from "./primary";

export function Team({ d, id, locale }: { d: JobDetail; id: string; locale: Locale }) {
  const { t } = useTranslation();
  const j = (k: string, o?: Record<string, unknown>) => t(`job.${k}`, o) as string;
  const toast = useToast();
  const client = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const [approvedNow, setApprovedNow] = useState<TimeEntryRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [hours, setHours] = useState("8");
  const [day, setDay] = useState<string>(isoDay(today));
  const [dateOpen, setDateOpen] = useState(false);
  const [note, setNote] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [radius, setRadius] = useState(d.job.geofenceRadiusMeters ?? 150);
  const workers = useQuery({ queryKey: ["team-workers"], queryFn: teamApi.workers, retry: 0, staleTime: 60_000 });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["job", id] }); void client.invalidateQueries({ queryKey: ["team-workers"] }); };
  const fail = (e: unknown) => toast({ message: e instanceof ApiFailure && e.status === 403 ? j("team.planNeeded") : j("failed") });

  usePrimary({ label: j("primary.team"), run: () => setLogOpen(true) });

  const waiting = hoursToApprove(d).filter((e) => !approvedNow.some((a) => a.id === e.id));
  const approved = approvedNow;
  const crew = crewOnJob(d);
  const people = (workers.data?.items ?? []).filter((w) => w.active);
  const free = people.filter((w) => !crew.some((c) => c.workerId === w.id));
  const hrs = (n: number) => number(hoursText(n), locale, Number.isInteger(hoursText(n)) ? 1 : 1);

  const approve = async (list: TimeEntryRow[]) => {
    setBusy("approve");
    try {
      await teamApi.approve(list.map((e) => e.id));
      setApprovedNow((a) => [...a, ...list]);
      refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const n = Number(hours.replace(",", "."));
    if (!who || !(n >= 0.25 && n <= 24)) return;
    setBusy("log");
    try {
      await teamApi.logHours(id, { workerId: who, date: day, hours: n, note: note.trim() || undefined, approve: true });
      refresh();
      setLogOpen(false); setNote("");
      toast({ message: j("team.hoursSaved") });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const assign = async (workerId: string) => {
    setAssignOpen(false);
    try { await teamApi.assign(id, workerId); refresh(); toast({ message: j("team.assigned2") }); } catch { toast({ message: j("failed") }); }
  };

  const saveRadius = async () => {
    try {
      await jobsApi.setRadius(id, radius);
      refresh();
      setRadiusOpen(false);
      toast({ message: j("team.radiusSaved") });
    } catch {
      toast({ message: j("failed") });
    }
  };

  const meta = (e: (typeof waiting)[number]) => {
    const date = dayDate(parseDay(e.date), locale);
    if (e.geofenceFlagged) return j("team.offSite", { date });
    return e.clockInAt && e.clockOutAt ? j("team.hoursMeta", { date, from: time(new Date(e.clockInAt), locale), to: time(new Date(e.clockOutAt), locale) }) : j("team.hoursMetaNoClock", { date });
  };

  const row = (e: (typeof waiting)[number], ok: boolean) => (
    <RowBody key={e.id} leading={<Avatar initials={initialsOf(e.workerName ?? "")} tint={tintFor(e.workerName ?? "")} size={34} />} title={`${e.workerName ?? ""} · ${j("team.hoursUnit", { count: hrs(e.hours) })}`}
      meta={meta(e)} trailingRow trailing={ok ? <Status tone="ok" shape="check">{j("team.approved")}</Status> : <Button size="sm" label={j("team.approve")} busy={busy === "approve" ? j("saving") : false} onPress={() => void approve([e])} />} />
  );

  const radiusLine = d.job.address ? j("team.locationSub", { address: d.job.address, radius: number(d.job.geofenceRadiusMeters ?? 150, locale) }) : j("team.locationNoAddress");

  return (
    <>
      <Section pt={22} px={16}>
        <SectionHeader title={j("team.hours")} link={waiting.length > 1 ? j("team.approveAll") : undefined} onLink={() => void approve(waiting)} />
        {waiting.length || approved.length ? (
          <Card><RowList>{waiting.map((e) => row(e, false))}{approved.map((e) => row(e, true))}</RowList></Card>
        ) : <Card padded><Text size={13.5} color="muted">{j("team.hoursNone")}</Text></Card>}
        <View style={{ marginTop: 12 }}><Button kind="secondary" block label={j("team.log")} onPress={() => setLogOpen(true)} /></View>
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("team.assigned")} link={j("team.assign")} onLink={() => setAssignOpen(true)} />
        {crew.length ? (
          <Card>
            <RowList>
              {crew.map((c) => (
                <RowBody key={c.workerId} leading={<Avatar initials={initialsOf(c.name)} tint={tintFor(c.name)} size={34} />} title={c.name} meta={c.role || undefined}
                  trailing={<><Num size={14.5} weight={600}>{j("team.hoursUnit", { count: hrs(c.hours) })}</Num><Text size={11.5} color="muted">{j("team.onThisJob")}</Text></>} />
              ))}
            </RowList>
          </Card>
        ) : <Card padded><Text size={13.5} color="muted">{j("team.noCrew")}</Text></Card>}
      </Section>

      <Section pt={22} px={16}>
        <Card>
          <Press onPress={() => { setRadius(d.job.geofenceRadiusMeters ?? 150); setRadiusOpen(true); }} accessibilityRole="button" accessibilityLabel={j("team.location")} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
            <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
              <Text size={14.5} weight={500}>{j("team.location")}</Text>
              <Text size={12.5} color="muted">{radiusLine}</Text>
            </View>
            <Glyph name="chevron" size={15} color="faint" weight={2} />
          </Press>
        </Card>
      </Section>

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} label={j("team.logTitle")} closeLabel={t("close")}>
        <SheetTitle>{j("team.logTitle")}</SheetTitle>
        <Stack px={20} gap={14} pb={20}>
          <Text size={12.5} color="muted">{j("team.who")}</Text>
          <ChipWrap>{(crew.length ? crew.map((c) => ({ id: c.workerId, name: c.name })) : people.map((w) => ({ id: w.id, name: w.name }))).map((p) => <Chip key={p.id} label={p.name} selected={who === p.id} onPress={() => setWho(p.id)} />)}</ChipWrap>
          <TextField label={j("team.hoursField")} value={hours} onChangeText={setHours} numeric keyboardType="decimal-pad" />
          <SelectField label={j("team.dateField")} value={dayDate(parseDay(day), locale)} onPress={() => setDateOpen(true)} mono />
          <TextField label={j("team.noteField")} value={note} onChangeText={setNote} />
          <Button label={j("team.saveHours")} block disabled={!who} busy={busy === "log" ? j("saving") : false} onPress={() => void save()} />
        </Stack>
      </Sheet>
      <DateSheet open={dateOpen} onClose={() => setDateOpen(false)} title={j("team.dateField")} closeLabel={t("close")} prevLabel={t("jobSetup.prevMonth")} nextLabel={t("jobSetup.nextMonth")} locale={locale} value={parseDay(day)} onPick={(x) => setDay(isoDay(x))} />

      <Sheet open={assignOpen} onClose={() => setAssignOpen(false)} label={j("team.assignTitle")} closeLabel={t("close")}>
        <SheetTitle>{j("team.assignTitle")}</SheetTitle>
        {free.length ? (
          <MenuList>{free.map((w) => <MenuRow key={w.id} icon={<Avatar initials={initialsOf(w.name)} tint={tintFor(w.name)} size={28} />} title={w.name} sub={w.role || undefined} chevron={false} onPress={() => void assign(w.id)} />)}</MenuList>
        ) : <Stack px={20} pb={24}><Text size={13.5} color="muted">{j("team.assignNone")}</Text></Stack>}
      </Sheet>

      <Sheet open={radiusOpen} onClose={() => setRadiusOpen(false)} label={j("team.radiusTitle")} closeLabel={t("close")}>
        <SheetTitle>{j("team.radiusTitle")}</SheetTitle>
        <Stack px={20} gap={14} pb={20}>
          <Text size={13.5} color="muted" leading={1.4}>{j("team.radiusSub")}</Text>
          <Stack row align="center" justify="space-between">
            <Num size={28} weight={600} tracking={-0.03}>{`${number(radius, locale)} m`}</Num>
            <MiniStepper decLabel="−" incLabel="+" onDec={() => setRadius((r) => Math.max(50, r - 50))} onInc={() => setRadius((r) => Math.min(5000, r + 50))} canDec={radius > 50} />
          </Stack>
          {d.job.latitude == null ? <Text size={12.5} color="warn" leading={1.4}>{j("team.radiusNoPin")}</Text> : null}
          <Button label={j("team.radiusSave")} block onPress={() => void saveRadius()} />
        </Stack>
      </Sheet>
    </>
  );
}
