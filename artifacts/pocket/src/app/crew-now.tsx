// CrewNow.dc.html. The crew member's day on their phone: who they are and which company, "what changed" since they last looked, the clock (a timer, one big button
// that checks where they are only when they clock in or out), the job with its address and the site lead, today's tasks to tick, what is coming up this week, their
// reports of the day, and a floating bar to report (an update, a blocker, materials, with a photo). The menu leads to hours by hand, travel and location sharing.
// With no signal clock-ins, hours and reports are kept on the phone and sent later (the boards' "Saved on phone" / "Pending sync").
// Not built: the board's gate code tile (the server doesn't hold one), minutes-away on the address, and the second glass button (the camera is inside Report).
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { hm as hmOf, timer, workedToday, type CrewChange, type CrewReport, type CrewTodayJob } from "@/lib/crew";
import { crewApi } from "@/lib/crewApi";
import { enqueue, runOrQueue, uuid, useOutbox } from "@/lib/crewOutbox";
import { chooseCrewWorker } from "@/lib/crewSession";
import { time, weekdayShort, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { currentFix, getSharing } from "@/lib/location";
import { takePhoto } from "@/lib/media";
import type { UploadFile } from "@/lib/jobUpload";
import { useCrew } from "@/lib/useCrew";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { CallRow, ChangeRow, ChangesPill, ClockCard, CrewHeader, CrewTask, PhaseTile, ReportRow, SiteRow, UpcomingRow, type ClockLook } from "@/ui/Crew";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Icon, type IconName, type Tone } from "@/ui/Icon";
import { Section, ScrollPage, Stack } from "@/ui/Layout";
import { MenuList, MenuRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Text } from "@/ui/Text";

const KINDS = ["note", "blocker", "materials"] as const;
type Kind = (typeof KINDS)[number];

export default function CrewNow() {
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`crew.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const crew = useCrew();
  const toast = useToast();
  const client = useQueryClient();
  const outbox = useOutbox();
  const [now, setNow] = useState(() => new Date());
  const [jobId, setJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<{ kind: "idle" | "locating" | "done"; sub?: string; out?: boolean }>({ kind: "idle" });
  const [local, setLocal] = useState<{ inAt: string; projectId: string; ref: string } | { outAt: string } | null>(null);
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesGone, setChangesGone] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pickJob, setPickJob] = useState(false);
  const [companies, setCompanies] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [rep, setRep] = useState(false);
  const [kind, setKind] = useState(0);
  const [repText, setRepText] = useState("");
  const [repWhat, setRepWhat] = useState("");
  const [repSpent, setRepSpent] = useState("");
  const [photo, setPhoto] = useState<UploadFile | null>(null);
  const [sending, setSending] = useState(false);
  const share = useRef<ReturnType<typeof setInterval> | null>(null);
  const view = crew.view;

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);

  // A link that doesn't open sends the person to CrewExpired; no pairing yet, to the code screen.
  const redirect = crew.loading ? null : crew.unpaired ? "/crew-pair" : crew.problem ? { pathname: "/crew-expired", params: { state: crew.problem } } : null;

  const activeEntry = view?.activeEntry ?? null;
  const localIn = local && "inAt" in local ? local : null;
  const localOut = local && "outAt" in local ? local : null;
  const clockedIn = localOut ? false : !!activeEntry || !!localIn;
  const todayJobs = view?.todayJobs ?? [];
  const jobs = view?.jobs ?? [];
  const chosen = jobId ?? activeEntry?.projectId ?? localIn?.projectId ?? todayJobs[0]?.id ?? jobs[0]?.id ?? null;
  const job = jobs.find((j) => j.id === chosen) ?? null;
  const today: CrewTodayJob | undefined = todayJobs.find((j) => j.id === chosen);

  const virtualActive = activeEntry ?? (localIn ? ({ id: "local", clockInAt: localIn.inAt, clockOutAt: null, date: view?.today ?? "", projectId: localIn.projectId } as never) : null);
  const worked = useMemo(
    () => (view ? workedToday(view.entries, localOut ? null : virtualActive, view.today, now) : 0),
    [view, virtualActive, localOut, now],
  );

  // While on the clock and allowed, the office sees where you are: the position goes up every minute this screen is open.
  useEffect(() => {
    if (!crew.path || !clockedIn) return;
    let live = true;
    const send = async () => {
      if ((await getSharing()) !== "on") return;
      const f = await currentFix();
      if (live && f.ok) void crewApi.location(crew.path!, f.fix.lat, f.fix.lng).catch(() => undefined);
    };
    void send();
    share.current = setInterval(() => void send(), 60_000);
    return () => { live = false; if (share.current) clearInterval(share.current); };
  }, [crew.path, clockedIn]);

  if (redirect) return <Redirect href={redirect as never} />;
  if (crew.loading || crew.loadingView || !view) {
    return (
      <Screen>
        <Section pt={72} px={20} gap={14}><Skeleton width={180} height={30} radius={10} /><Skeleton height={40} radius={12} /><Skeleton height={330} radius={22} /><Skeleton height={160} radius={22} /></Section>
      </Screen>
    );
  }

  const path = crew.path!;
  const refresh = () => void client.invalidateQueries({ queryKey: ["crew", path] });
  const company = view.companyName || c("expired.yourCompany");
  const first = view.worker.name.trim().split(/\s+/)[0] ?? "";
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(now);
  const where = job?.address || job?.name || "";
  const range = (() => {
    const bs = today?.blocks.filter((b) => !b.allDay) ?? [];
    if (!bs.length) return undefined;
    const a = new Date(Math.min(...bs.map((b) => +new Date(b.startsAt))));
    const z = new Date(Math.max(...bs.map((b) => +new Date(b.endsAt))));
    return `${c("clock.today")} · ${time(a, locale)}–${time(z, locale)}`;
  })();

  // ── The clock ──────────────────────────────────────────────────────────────
  const clock = async () => {
    if (phase.kind !== "idle") return;
    if (!clockedIn && !chosen) { toast({ message: c("clock.noJob") }); return; }
    setPhase({ kind: "locating" });
    const f = await currentFix();
    const pos = f.ok ? { lat: f.fix.lat, lng: f.fix.lng } : {};
    const at = new Date();
    try {
      if (clockedIn) {
        const r = await runOrQueue(() => crewApi.clockOut(path, { ...pos }), { kind: "clockOut", at: at.toISOString(), body: { ...pos, openRef: localIn?.ref }, label: "clockOut" });
        if (r.done) { setLocal(null); setPhase({ kind: "done", out: true, sub: r.value.entry.geofenceFlagged ? c("clock.offSite", { time: time(at, locale) }) : f.ok ? c("clock.matched", { time: time(at, locale) }) : c("clock.noFix", { time: time(at, locale) }) }); refresh(); }
        else { setLocal({ outAt: at.toISOString() }); setPhase({ kind: "done", out: true, sub: c("clock.queued", { time: time(at, locale) }) }); toast({ message: c("clock.noSignal") }); }
      } else {
        const ref = uuid();
        const r = await runOrQueue(() => crewApi.clockIn(path, { projectId: chosen!, ...pos, clientRef: ref }), { kind: "clockIn", id: ref, at: at.toISOString(), body: { projectId: chosen!, ...pos }, label: "clockIn" });
        if (r.done) { setLocal(null); setPhase({ kind: "done", sub: r.value.entry.geofenceFlagged ? c("clock.offSite", { time: time(at, locale) }) : f.ok ? c("clock.matched", { time: time(at, locale) }) : c("clock.noFix", { time: time(at, locale) }) }); refresh(); }
        else { setLocal({ inAt: at.toISOString(), projectId: chosen!, ref }); setPhase({ kind: "done", sub: c("clock.queued", { time: time(at, locale) }) }); toast({ message: c("clock.noSignal") }); }
      }
    } catch (e) {
      setPhase({ kind: "idle" });
      toast({ message: e instanceof ApiFailure && e.code === "ALREADY_CLOCKED_IN" ? c("clock.alreadyIn") : c("clock.failed") });
      refresh();
      return;
    }
    setTimeout(() => setPhase({ kind: "idle" }), 1800);
  };

  const look: ClockLook = phase.kind === "locating" ? "locating" : phase.kind === "done" ? "done" : clockedIn ? "out" : "in";
  const title = look === "done" ? (phase.out ? c("clock.clockedOut") : c("clock.clockedIn")) : look === "locating" ? c("clock.locating") : clockedIn ? c("clock.clockOut") : c("clock.clockIn");
  const sub = look === "done" ? (phase.sub ?? "") : look === "locating" ? c("clock.locatingSub", { place: where }) : clockedIn ? c("clock.clockOutSub") : c("clock.clockInSub", { job: job?.name ?? "" });
  const sinceIso = activeEntry?.clockInAt ?? localIn?.inAt ?? null;
  const lastOut = [...view.entries].filter((e) => e.date === view.today && e.clockOutAt).sort((a, b) => +new Date(b.clockOutAt!) - +new Date(a.clockOutAt!))[0];
  const dur = hmOf(worked);
  const timerSub = clockedIn && sinceIso ? c("clock.timerOn", { time: time(new Date(sinceIso), locale) })
    : lastOut?.clockOutAt || localOut ? c("clock.timerOff", { time: time(new Date(localOut?.outAt ?? lastOut!.clockOutAt!), locale), dur: t("crew.hours.dur", { h: dur.h, m: dur.m }) }) : c("clock.timerNone");

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const tasks = (today?.tasks ?? []).map((x) => ({ ...x, done: override[x.id] ?? x.status === "done" }));
  const toggleTask = async (id: string, done: boolean) => {
    setOverride((o) => ({ ...o, [id]: !done }));
    try { await crewApi.task(path, id, done ? "todo" : "done"); refresh(); }
    catch { setOverride((o) => { const n = { ...o }; delete n[id]; return n; }); toast({ message: c("clock.failed") }); }
  };
  const addTask = async () => {
    if (!chosen || !taskText.trim()) return;
    try { await crewApi.addTask(path, chosen, taskText.trim()); setTaskText(""); setTaskOpen(false); refresh(); } catch { toast({ message: c("clock.failed") }); }
  };

  // ── What changed ───────────────────────────────────────────────────────────
  const changeLine = (ch: CrewChange): { icon: IconName; tone: Tone; title: string; sub?: string } => {
    switch (ch.kind) {
      case "shift_added": return { icon: "cal", tone: "azure", title: c("changes.shiftAdded"), sub: c("changes.shiftSub", { label: ch.label, when: `${weekdayShort(new Date(ch.startsAt), locale)} ${time(new Date(ch.startsAt), locale)}` }) };
      case "shift_changed": return { icon: "cal", tone: "azure", title: c("changes.shiftChanged"), sub: c("changes.shiftSub", { label: ch.label, when: `${weekdayShort(new Date(ch.startsAt), locale)} ${time(new Date(ch.startsAt), locale)}` }) };
      case "shift_removed": return { icon: "cal", tone: "clay", title: c("changes.shiftRemoved"), sub: ch.label };
      case "task_added": return { icon: "list", tone: "violet", title: c("changes.taskAdded"), sub: c("changes.taskSub", { title: ch.title, job: ch.projectName }) };
      case "task_changed": return { icon: "list", tone: "violet", title: c("changes.taskChanged"), sub: c("changes.taskSub", { title: ch.title, job: ch.projectName }) };
      case "task_done": return { icon: "check", tone: "sage", title: c("changes.taskDone"), sub: c("changes.taskSub", { title: ch.title, job: ch.projectName }) };
      case "answer": return { icon: "chat", tone: "sage", title: c("changes.answer", { by: ch.by ?? c("changes.someone") }), sub: ch.answer ?? undefined };
    }
  };
  const gotIt = async () => { setChangesGone(true); try { await crewApi.seen(path, view.changesUpTo); } catch { /* it shows again next time */ } };

  // ── Reports ────────────────────────────────────────────────────────────────
  const reportsToday = view.reports.filter((r) => r.createdAt.slice(0, 10) === view.today || new Date(r.createdAt).toDateString() === now.toDateString());
  const reportStatus = (r: CrewReport) => (r.resolvedAt ? { tone: "ok" as const, shape: "check" as const, word: c("reports.answered") } : { tone: "ok" as const, shape: "check" as const, word: c("reports.sent") });
  const queuedReports = outbox.filter((o) => o.kind === "report");
  const kindKey: Kind = KINDS[kind]!;
  const sendLabel = kindKey === "note" ? c("reports.sendUpdate") : kindKey === "blocker" ? c("reports.sendBlocker") : c("reports.sendMaterials");
  const textLabel = kindKey === "note" ? c("reports.updateLabel") : kindKey === "blocker" ? c("reports.blockerLabel") : c("reports.materialsLabel");
  const textPh = kindKey === "note" ? c("reports.updatePh") : kindKey === "blocker" ? c("reports.blockerPh") : c("reports.materialsPh");
  const sendReport = async () => {
    if (!chosen) { toast({ message: c("clock.noJob") }); return; }
    const text = [kindKey === "materials" ? repWhat.trim() : "", repText.trim()].filter(Boolean).join(" · ");
    if (!text && !photo) { toast({ message: c("reports.needText") }); return; }
    const cents = kindKey === "materials" && repSpent.trim() ? Math.round(Number(repSpent.replace(/[^\d.,]/g, "").replace(",", ".")) * 100) : undefined;
    const body = { projectId: chosen, kind: kindKey, body: text, ...(cents && Number.isFinite(cents) ? { materialsCents: cents } : null) };
    setSending(true);
    const ref = uuid();
    try {
      const r = await runOrQueue(() => crewApi.report(path, { ...body, clientRef: ref }, photo), { kind: "report", id: ref, body, photo, label: kindKey });
      if (r.done) refresh(); else toast({ message: c("clock.noSignal") });
      setRep(false); setRepText(""); setRepWhat(""); setRepSpent(""); setPhoto(null);
    } catch {
      toast({ message: c("clock.failed") });
    } finally {
      setSending(false);
    }
  };
  const addPhoto = async () => {
    const r = await takePhoto("report");
    if (r.ok && r.files[0]) setPhoto(r.files[0]);
  };

  // ── Coming up ──────────────────────────────────────────────────────────────
  const upcoming = view.schedule.filter((b) => new Date(b.startsAt).toDateString() !== now.toDateString() || +new Date(b.endsAt) > +now).slice(0, 5);

  const lead = today?.contact;
  const milestones = job?.milestones ?? [];
  const phaseNow = milestones.find((m) => m.status === "in_progress") ?? milestones.find((m) => m.status !== "completed" && m.status !== "skipped");
  const phaseValue = milestones.length ? milestones.filter((m) => m.status === "completed").length / milestones.length : 0;
  const canSwitch = view.companies.length > 1;

  return (
    <Screen floating={<ActionBar label={c("report")} onPress={() => setRep(true)} moreLabel={c("more")} onMore={() => setMenu(true)} />}>
      <ScrollPage bottom={ACTION_BAR_SPACE}>
        <CrewHeader company={company} initials={initialsOf(company)} canSwitch={canSwitch} switchLabel={c("switchCompany")} onCompany={() => setCompanies(true)} worker={initialsOf(view.worker.name)} tint={tintFor(view.worker.name)} workerLabel={view.worker.name} />
        <Section delay={40} px={20} pt={18} gap={5}>
          <Text size={28} weight={600} tracking={-0.04} leading={1.15} accessibilityRole="header">{c("greet", { name: first })}</Text>
          <Text size={13.5} color="muted">{c("dateRole", { date: dateLabel, role: view.worker.role })}</Text>
        </Section>
        {crew.stale ? <Section px={16} pt={12}><Banner tone="info" icon="cloud" iconTone="amber" lead={c("offline")} /></Section> : null}
        {outbox.length ? <Section px={16} pt={12}><Banner tone="info" icon="send" iconTone="azure" lead={c("queued", { count: outbox.length })} /></Section> : null}
        {view.changes.length && !changesGone ? (
          <Section delay={70} px={16} pt={14}>
            <ChangesPill count={view.changes.length} label={c("changes.title")} open={changesOpen} onPress={() => setChangesOpen((o) => !o)} />
            {changesOpen ? (
              <Stack mt={10}>
                <Card>
                  <RowList>{view.changes.map((ch, i) => { const l = changeLine(ch); return <ChangeRow key={i} icon={l.icon} tone={l.tone} title={l.title} sub={l.sub} />; })}</RowList>
                  <Stack px={16} pt={4} pb={16}><Button kind="secondary" size="md" block label={c("changes.gotIt")} onPress={() => void gotIt()} /></Stack>
                </Card>
              </Stack>
            ) : null}
          </Section>
        ) : null}
        <Section delay={100} px={16} pt={16}>
          <ClockCard pill={clockedIn ? { tone: "ok", shape: "live", word: c("clock.onTheClock") } : { tone: "mute", shape: "dot", word: c("clock.offTheClock") }} range={range}
            timer={timer(worked)} timerRunning={clockedIn} timerSub={timerSub} look={look} title={title} sub={sub} onClock={() => void clock()} busy={phase.kind === "locating"} note={c("clock.locationNote")}>
            <SiteRow title={job?.name ?? c("clock.noJob")} sub={today?.address ?? undefined} action={jobs.length > 1 ? c("clock.change") : undefined} onAction={() => setPickJob(true)} strong />
            {job?.address ? <SiteRow title={job.address} sub={c("clock.directions")} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address!)}`)} /> : null}
            {lead ? <CallRow name={lead.name} role={c("clock.siteLead")} callLabel={c("clock.call", { name: lead.name })} onCall={lead.phone ? () => void Linking.openURL(`tel:${lead.phone!.replace(/[^\d+]/g, "")}`) : undefined} /> : null}
            {phaseNow ? <PhaseTile label={c("clock.phase")} title={phaseNow.title} value={phaseValue} /> : null}
          </ClockCard>
        </Section>

        <Section delay={150} px={16} pt={24}>
          <SectionHeader title={c("tasks.title")} link={tasks.length ? `${tasks.filter((x) => x.done).length}/${tasks.length}` : undefined} />
          <Card>
            <RowList>
              {tasks.length ? tasks.map((x) => <CrewTask key={x.id} title={x.title} sub={x.done ? c("tasks.done") : x.addedBy ? c("tasks.fromSite", { name: x.addedBy }) : x.milestoneTitle ?? undefined} done={x.done} isNew={!!x.addedBy && !x.done} newLabel={c("tasks.new")} onToggle={() => void toggleTask(x.id, x.done)} />)
                : <Stack px={16} pt={14} pb={14}><Text size={13.5} color="muted">{c("tasks.none")}</Text></Stack>}
              {view.worker.canAddTasks && chosen ? (
                <MenuRow icon={<Icon name="plus" tone="slate" size={26} />} title={c("tasks.add")} chevron={false} onPress={() => setTaskOpen(true)} />
              ) : null}
            </RowList>
          </Card>
        </Section>

        <Section delay={190} px={16} pt={24}>
          <SectionHeader title={c("upcoming.title")} link={c("upcoming.thisWeek")} />
          <Card>
            <RowList>
              {upcoming.length ? upcoming.map((b) => {
                const d = new Date(b.startsAt);
                return <UpcomingRow key={b.id} dow={weekdayShort(d, locale)} day={String(d.getDate())} title={b.projectName ?? ""} sub={[b.allDay ? c("upcoming.allDay") : `${time(d, locale)}`, b.milestoneTitle].filter(Boolean).join(" · ")} />;
              }) : <Stack px={16} pt={14} pb={14}><Text size={13.5} color="muted">{c("upcoming.none")}</Text></Stack>}
            </RowList>
          </Card>
        </Section>

        <Section delay={230} px={16} pt={24}>
          <SectionHeader title={c("reports.title")} link={c("reports.today")} />
          <Card>
            <RowList>
              {queuedReports.map((o) => <ReportRow key={o.id} title={`${c(`reports.kind.${(o.body as { kind: Kind }).kind}`)} · ${String((o.body as { body: string }).body).slice(0, 26)}`} sub={c("reports.pendingSub")} status={{ tone: "warn", shape: "clock", word: c("reports.pending") }} time={time(new Date(o.at), locale)} />)}
              {reportsToday.map((r) => <ReportRow key={r.id} title={`${c(`reports.kind.${r.kind}`)} · ${r.body.slice(0, 26)}`} sub={r.resolutionNote ? `${r.resolutionNote}` : c("reports.sentSub")} status={reportStatus(r)} time={time(new Date(r.createdAt), locale)} />)}
              {!queuedReports.length && !reportsToday.length ? <Stack px={16} pt={14} pb={14}><Text size={13.5} color="muted">{c("reports.none")}</Text></Stack> : null}
            </RowList>
          </Card>
        </Section>
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={c("more")} closeLabel={c("close")}>
        <SheetTitle>{c("more")}</SheetTitle>
        <MenuList>
          <MenuRow icon={<Icon name="clock" tone="teal" size={28} />} title={c("hours.title")} sub={c("hours.sub")} onPress={() => { setMenu(false); router.push("/crew-hours"); }} />
          {view.travel && (view.travel.km || view.travel.perDiem) ? <MenuRow icon={<Icon name="truck" tone="amber" size={28} />} title={c("travel.title")} onPress={() => { setMenu(false); router.push("/crew-travel"); }} /> : null}
          <MenuRow icon={<Icon name="pin" tone="rose" size={28} />} title={c("location.title")} onPress={() => { setMenu(false); router.push("/live-location"); }} />
        </MenuList>
      </Sheet>

      <Sheet open={pickJob} onClose={() => setPickJob(false)} label={c("clock.pickJob")} closeLabel={c("close")}>
        <SheetTitle>{c("clock.pickJob")}</SheetTitle>
        <MenuList>
          {jobs.map((j) => <MenuRow key={j.id} icon={<Icon name="cone" tone="amber" size={28} />} title={j.name} sub={j.address ?? undefined} chevron={false} onPress={() => { setJobId(j.id); setPickJob(false); }} />)}
        </MenuList>
      </Sheet>

      <Sheet open={companies} onClose={() => setCompanies(false)} label={c("company.title")} closeLabel={c("close")}>
        <SheetTitle>{c("company.title")}</SheetTitle>
        <MenuList>
          {view.companies.map((x) => <MenuRow key={x.workerId} icon={<Icon name="building" tone="violet" size={28} />} title={x.companyName} sub={x.current ? c("company.current") : undefined} chevron={false}
            onPress={() => { setCompanies(false); if (!x.current) { void chooseCrewWorker(x.primary ? null : x.workerId); setJobId(null); } }} />)}
        </MenuList>
      </Sheet>

      <Sheet open={taskOpen} onClose={() => setTaskOpen(false)} label={c("tasks.addTitle")} closeLabel={c("close")}>
        <SheetTitle>{c("tasks.addTitle")}</SheetTitle>
        <Stack px={20} gap={14} pb={20}>
          <TextField label={c("tasks.addPlaceholder")} value={taskText} onChangeText={setTaskText} autoFocus />
          <Button label={c("tasks.addSave")} block disabled={!taskText.trim()} onPress={() => void addTask()} />
        </Stack>
      </Sheet>

      <Sheet open={rep} onClose={() => setRep(false)} label={c("reports.sheetTitle")} closeLabel={c("close")}>
        <SheetTitle>{c("reports.sheetTitle")}</SheetTitle>
        <Stack px={16} gap={14} pb={20}>
          <Segmented label={c("reports.kindLabel")} options={[c("reports.update"), c("reports.blocker"), c("reports.materials")]} value={kind} onChange={setKind} />
          {kindKey === "materials" ? (
            <Stack row gap={10}>
              <Stack grow><TextField label={c("reports.what")} value={repWhat} onChangeText={setRepWhat} placeholder={c("reports.whatPh")} /></Stack>
              <Stack w={130}><TextField label={c("reports.spent")} value={repSpent} onChangeText={setRepSpent} numeric keyboardType="decimal-pad" placeholder="$0.00" /></Stack>
            </Stack>
          ) : null}
          <TextField label={textLabel} value={repText} onChangeText={setRepText} placeholder={textPh} multiline />
          <Stack row gap={10} align="center">
            <Button kind="secondary" label={photo ? c("reports.removePhoto") : c("reports.addPhoto")} onPress={() => (photo ? setPhoto(null) : void addPhoto())} icon={<Icon name="camera" tone="slate" size={20} />} />
            {photo ? <Text size={12.5} color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{photo.name}</Text> : null}
          </Stack>
          <Stack row align="center" gap={12}>
            <Stack grow gap={1}><Text size={12.5} color="muted">{c("reports.job")}</Text><Text size={14.5} weight={500} numberOfLines={1}>{[job?.name, job?.address].filter(Boolean).join(" · ")}</Text></Stack>
            {jobs.length > 1 ? <Button kind="link" size="sm" label={c("clock.change")} onPress={() => { setRep(false); setPickJob(true); }} /> : null}
          </Stack>
          <Button size="lg" block label={sendLabel} busy={sending ? c("reports.sending") : false} onPress={() => void sendReport()} />
        </Stack>
      </Sheet>
    </Screen>
  );
}
