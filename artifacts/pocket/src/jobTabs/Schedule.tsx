// Job.dc.html, the Schedule tab: the milestones as a timeline (the one being worked on opens its tasks, which tick off, with Add task
// and Complete milestone), then the crew over the next four weeks with any double booking called out.
// Tasks the crew added from the field carry "From the site · name".
import { useMemo, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tintFor } from "@/lib/clients";
import { dateRange, dayDate, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import type { JobDetail, JobMilestone } from "@/lib/jobDetail";
import { currentMilestone, taskDone } from "@/lib/jobPage";
import { crewGrid, jobClashes, relevantPeople, weekStarts } from "@/lib/jobSchedule";
import { jobsApi } from "@/lib/jobsApi";
import { dateOnly } from "@/lib/jobs";
import { screenHref } from "@/lib/nav";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { CrewGrid, TaskList, TaskRow, TimelineItem } from "@/ui/JobPage";
import { Section, Stack } from "@/ui/Layout";
import { SectionHeader } from "@/ui/Row";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import type { StatusShape, StatusTone } from "@/ui/Status";
import { Text } from "@/ui/Text";
import { usePrimary } from "./primary";

type Props = { d: JobDetail; id: string; locale: Locale; onRecord: () => void };

export function Schedule({ d, id, locale, onRecord }: Props) {
  const { t } = useTranslation();
  const j = (k: string, o?: Record<string, unknown>) => t(`job.${k}`, o) as string;
  const toast = useToast();
  const client = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const from = weekStarts(now, 4)[0]!;
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 28);
  const sched = useQuery({ queryKey: ["job-crew-weeks", from.toISOString().slice(0, 10)], queryFn: () => jobsApi.schedule(from, to), retry: 1, staleTime: 30_000 });
  const [override, setOverride] = useState<Record<string, string>>({});
  const [taskOpen, setTaskOpen] = useState<JobMilestone | null>(null);
  const [taskText, setTaskText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  usePrimary({ label: j("primary.schedule"), run: onRecord });

  const cur = currentMilestone(d.milestones);
  const refresh = () => { void client.invalidateQueries({ queryKey: ["job", id] }); void client.invalidateQueries({ queryKey: ["jobs"] }); };

  const toggle = async (taskId: string, status: string) => {
    const next = taskDone(status) ? "todo" : "done";
    setOverride((o) => ({ ...o, [taskId]: next }));
    try {
      await jobsApi.setTask(id, taskId, next);
      refresh();
    } catch {
      setOverride((o) => { const n = { ...o }; delete n[taskId]; return n; });
      toast({ message: j("failed") });
    }
  };

  const setStatus = async (m: JobMilestone, status: "in_progress" | "completed") => {
    setBusy(m.id);
    try {
      await jobsApi.setMilestone(id, m.id, status);
      refresh();
      if (status === "completed") toast({ message: j("schedule.completed") });
    } catch {
      toast({ message: j("failed") });
    } finally {
      setBusy(null);
    }
  };

  const addTask = async () => {
    if (!taskOpen || !taskText.trim()) return;
    setBusy("task");
    try {
      await jobsApi.addTask(id, taskText.trim(), taskOpen.id);
      refresh();
      setTaskOpen(null);
      setTaskText("");
    } catch {
      toast({ message: j("failed") });
    } finally {
      setBusy(null);
    }
  };

  const look = (m: JobMilestone): { state: "done" | "current" | "upcoming"; tone: StatusTone; shape: StatusShape; word: string } => {
    if (m.status === "completed") return { state: "done", tone: "mute", shape: "check", word: j("schedule.done") };
    if (m.status === "skipped") return { state: "done", tone: "mute", shape: "off", word: j("schedule.skipped") };
    if (cur && m.id === cur.id) return { state: "current", tone: "ok", shape: "live", word: j("schedule.inProgress") };
    return { state: "upcoming", tone: "mute", shape: "dot", word: j("schedule.upcoming") };
  };

  const meta = (m: JobMilestone, state: "done" | "current" | "upcoming") => {
    const done = m.tasks.filter((x) => taskDone(override[x.id] ?? x.status)).length;
    const tasks = m.tasks.length === 0 ? j("schedule.tasks", { count: 0 }) : state === "upcoming" ? j("schedule.tasks", { count: m.tasks.length }) : j("schedule.tasksOf", { done, total: m.tasks.length });
    const dates = m.plannedStart && m.plannedEnd ? dateRange(dateOnly(m.plannedStart), dateOnly(m.plannedEnd), locale) : "";
    return dates ? j("schedule.dates", { dates, tasks }) : tasks;
  };

  const assigned = new Set(d.assignments.map((a) => a.collaboratorId));
  const blocks = sched.data?.blocks ?? [];
  const rows = relevantPeople(crewGrid(blocks, id, d.assignments.map((a) => ({ id: a.collaboratorId, name: a.collaboratorName })), now, 4), assigned);
  const clashes = jobClashes(blocks, id);
  const weekLabels = weekStarts(now, 4).map((w) => shortDate(w, locale));

  return (
    <>
      <Section pt={22} px={16}>
        <SectionHeader title={j("schedule.milestones")} link={j("schedule.editDates")} onLink={() => router.push(screenHref("JobSetup", j("schedule.editDates"), { id }))} />
        {d.milestones.length ? (
          <Card style={{ paddingTop: 16, paddingBottom: 6 }}>
            {d.milestones.map((m, i) => {
              const lk = look(m);
              const isCur = lk.state === "current";
              return (
                <TimelineItem key={m.id} state={lk.state} last={i === d.milestones.length - 1} title={m.title} meta={meta(m, lk.state)} status={{ tone: lk.tone, shape: lk.shape, word: lk.word }}>
                  {isCur ? (
                    <>
                      <TaskList>
                        {m.tasks.map((x) => (
                          <TaskRow key={x.id} title={x.title} done={taskDone(override[x.id] ?? x.status)} site={x.addedFromFieldBy ? j("schedule.fromSite", { name: x.addedFromFieldBy }) : undefined} onToggle={() => void toggle(x.id, override[x.id] ?? x.status)} />
                        ))}
                        <TaskRow title={j("schedule.addTask")} plus onToggle={() => { setTaskOpen(m); setTaskText(""); }} />
                      </TaskList>
                      <Stack row mt={10}>
                        <Button kind="secondary" size="sm" label={m.status === "in_progress" ? j("schedule.complete") : j("schedule.start")} busy={busy === m.id ? j("saving") : false} onPress={() => void setStatus(m, m.status === "in_progress" ? "completed" : "in_progress")} />
                      </Stack>
                    </>
                  ) : null}
                </TimelineItem>
              );
            })}
          </Card>
        ) : <Card padded><Text size={13.5} color="muted">{j("noMilestones")}</Text></Card>}
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("schedule.crew")} link={j("schedule.openSchedule")} onLink={() => router.push(screenHref("Schedule", j("schedule.openSchedule")))} />
        {sched.isPending && !sched.data ? <Skeleton height={160} radius={22} /> : rows.length ? (
          <>
            <CrewGrid weekLabels={weekLabels} rows={rows.map((r) => ({ key: r.workerId, initials: initialsOf(r.name), tint: tintFor(r.name), weeks: r.weeks }))} legend={{ thisJob: j("schedule.thisJob"), other: j("schedule.otherJobs"), clash: j("schedule.clash") }} />
            {clashes.length ? (
              <Stack mt={12}>
                <Banner tone="bad" icon="warn" iconTone="rose" lead={clashes.length === 1 ? j("schedule.clashBanner", { count: 1, name: clashes[0]!.workerName, day: dayDate(clashes[0]!.day, locale) }) : j("schedule.clashBanner", { count: clashes.length })}
                  link={j("schedule.clashFix")} onLink={() => router.push(screenHref("Schedule", j("schedule.openSchedule")))} />
              </Stack>
            ) : null}
          </>
        ) : <Card padded><Text size={13.5} color="muted">{j("schedule.noCrew")}</Text></Card>}
      </Section>

      <Sheet open={!!taskOpen} onClose={() => setTaskOpen(null)} label={j("schedule.addTask")} closeLabel={t("close")}>
        <SheetTitle>{j("schedule.addTask")}</SheetTitle>
        <Stack px={20} gap={14} pb={20}>
          <TextField label={j("schedule.taskPlaceholder")} value={taskText} onChangeText={setTaskText} autoFocus />
          <Button label={j("schedule.addTask")} block disabled={!taskText.trim()} busy={busy === "task" ? j("saving") : false} onPress={() => void addTask()} />
        </Stack>
      </Sheet>
    </>
  );
}
