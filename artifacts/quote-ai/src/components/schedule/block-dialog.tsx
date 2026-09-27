import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { MockupToggle } from "@/components/ui/mockup-toggle";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { localDay } from "@/lib/local-day";
import { scheduleApi, type BlockInput, type ScheduleBlockDto, type ScheduleJobDto, type ScheduleWorkerDto } from "@/lib/schedule-api";

/** What opens the dialog: an existing block to edit, or a prefilled draft (from a click / drag on the board, or the job page). */
export type BlockDraft = {
  projectId?: string | null;
  milestoneId?: string | null;
  collaboratorId?: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
};

/** Phase 109: a new block's hours when nothing says otherwise — a site day. */
const DEFAULT_FROM = { h: 7, m: 0 };
const DEFAULT_TO = { h: 15, m: 30 };
export function defaultShift(day: Date): { startsAt: Date; endsAt: Date } {
  const at = (x: { h: number; m: number }) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), x.h, x.m, 0, 0);
  return { startsAt: at(DEFAULT_FROM), endsAt: at(DEFAULT_TO) };
}

/** The worker booked most often on a job in what is loaded — the job's crew, as the default for a new block. */
function jobCrew(blocks: ScheduleBlockDto[], projectId: string): string {
  const n = new Map<string, number>();
  for (const b of blocks) if (b.projectId === projectId && b.collaboratorId) n.set(b.collaboratorId, (n.get(b.collaboratorId) ?? 0) + 1);
  let best = "";
  let most = 0;
  for (const [id, c] of n) if (c > most) { best = id; most = c; }
  return best;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const atTime = (day: string, time: string) => new Date(`${day}T${time}:00`);

export function BlockDialog({ open, onOpenChange, block, draft, jobs, workers, blocks = [], lockJob }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: ScheduleBlockDto | null;
  draft: BlockDraft | null;
  jobs: ScheduleJobDto[];
  workers: ScheduleWorkerDto[];
  /** What is loaded around it: picks the job's crew for a new block and warns of a double-booking before saving. */
  blocks?: ScheduleBlockDto[];
  /** On the job page the job is fixed. */
  lockJob?: boolean;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(localDay(new Date()));
  const [endDay, setEndDay] = useState(localDay(new Date()));
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("15:30");
  const [allDay, setAllDay] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const s = block ? new Date(block.startsAt) : draft?.startsAt ?? new Date();
    const e = block ? new Date(block.endsAt) : draft?.endsAt ?? defaultShift(s).endsAt;
    const isAllDay = block ? block.allDay : (draft?.allDay ?? false);
    setProjectId(block ? (block.projectId ?? "") : (draft?.projectId ?? ""));
    setMilestoneId(block ? (block.milestoneId ?? "") : (draft?.milestoneId ?? ""));
    setCollaboratorId(block ? (block.collaboratorId ?? "") : (draft?.collaboratorId ?? (draft?.projectId ? jobCrew(blocks, draft.projectId) : "")));
    setTitle(block?.title ?? "");
    setNotes(block?.notes ?? "");
    setAllDay(isAllDay);
    setDay(localDay(s));
    // All-day blocks end at the next local midnight, so the last covered day is one before `endsAt`.
    setEndDay(localDay(isAllDay ? new Date(e.getTime() - 1) : e));
    setStart(isAllDay ? "07:00" : hhmm(s));
    setEnd(isAllDay ? "15:30" : hhmm(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the sheet opens, not when the board refetches
  }, [open, block, draft]);

  const job = jobs.find((j) => j.id === projectId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["schedule"] });
  const onError = (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" });

  const payload = (): BlockInput | null => {
    const startsAt = allDay ? atTime(day, "00:00") : atTime(day, start);
    const endsAt = allDay ? new Date(atTime(endDay < day ? day : endDay, "00:00").getTime() + 86_400_000) : atTime(day, end);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return null;
    return {
      projectId: projectId || null,
      milestoneId: milestoneId || null,
      collaboratorId: collaboratorId || null,
      title: title.trim(),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      allDay,
      notes: notes.trim(),
    };
  };

  // Phase 109: the double-booking shows while the block is being set, not after the save.
  const body = open ? payload() : null;
  const clash = body && body.collaboratorId
    ? blocks.find((b) => b.id !== block?.id && b.collaboratorId === body.collaboratorId && new Date(b.startsAt) < new Date(body.endsAt) && new Date(b.endsAt) > new Date(body.startsAt))
    : undefined;
  const clashText = clash
    ? t("schedule.dialog.clash")
        .replace("{name}", clash.collaboratorName ?? "")
        .replace("{what}", clash.label ?? t("schedule.blockFallback"))
        .replace("{when}", clash.allDay ? t("schedule.allDay") : `${hhmm(new Date(clash.startsAt))}–${hhmm(new Date(clash.endsAt))}`)
    : null;

  const save = useMutation({
    mutationFn: () => {
      const body = payload();
      if (!body) throw new Error(t("schedule.dialog.invalidTimes"));
      return block ? scheduleApi.update(block.id, body) : scheduleApi.create(body);
    },
    onSuccess: (r) => {
      refresh();
      onOpenChange(false);
      if (r.block.conflicts.length) toast({ title: t("schedule.conflictToastTitle"), description: t("schedule.conflictToastBody").replace("{name}", r.block.collaboratorName ?? "") });
    },
    onError,
  });
  const remove = useMutation({ mutationFn: () => scheduleApi.remove(block!.id), onSuccess: () => { refresh(); onOpenChange(false); }, onError });

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={block ? t("schedule.dialog.editTitle") : t("schedule.dialog.newTitle")}
      description={t("schedule.dialog.desc")}
      footer={
        <>
          {block && <button type="button" className="btn btn-sm btn-outline-navy mr-auto" style={{ borderColor: "var(--red)", color: "var(--red)" }} disabled={remove.isPending} onClick={() => remove.mutate()}><Trash2 className="h-4 w-4" /> {t("schedule.dialog.delete")}</button>}
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "…" : t("schedule.dialog.save")}</button>
        </>
      }
    >
      <div className="form-grid" style={{ padding: 0 }}>
        <div className="field full">
          <label htmlFor="blk-worker">{t("schedule.dialog.worker")}</label>
          <select id="blk-worker" value={collaboratorId} onChange={(e) => setCollaboratorId(e.target.value)}>
            <option value="">{t("schedule.unassigned")}</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}{w.role ? ` · ${w.role}` : ""}</option>)}
          </select>
          {workers.length === 0 && <span className="text-xs text-muted-foreground mt-1 block">{t("schedule.dialog.noWorkers")}</span>}
        </div>
        <div className="field full">
          <label htmlFor="blk-job">{t("schedule.dialog.job")}</label>
          <select id="blk-job" value={projectId} disabled={lockJob} onChange={(e) => { setProjectId(e.target.value); setMilestoneId(""); if (!block && !collaboratorId && e.target.value) setCollaboratorId(jobCrew(blocks, e.target.value)); }}>
            <option value="">{t("schedule.dialog.noJob")}</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>
        {job && job.milestones.length > 0 && (
          <div className="field full">
            <label htmlFor="blk-ms">{t("schedule.dialog.milestone")}</label>
            <select id="blk-ms" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
              <option value="">{t("schedule.dialog.anyMilestone")}</option>
              {job.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="blk-day">{allDay ? t("schedule.dialog.firstDay") : t("schedule.dialog.date")}</label>
          <input id="blk-day" type="date" value={day} onChange={(e) => { setDay(e.target.value); if (endDay < e.target.value) setEndDay(e.target.value); }} />
        </div>
        {allDay ? (
          <div className="field">
            <label htmlFor="blk-end-day">{t("schedule.dialog.lastDay")}</label>
            <input id="blk-end-day" type="date" value={endDay} min={day} onChange={(e) => setEndDay(e.target.value)} />
          </div>
        ) : (
          <div className="field">
            <label>{t("schedule.dialog.hours")}</label>
            <div className="flex items-center gap-2">
              <input type="time" aria-label={t("schedule.dialog.start")} value={start} step={900} onChange={(e) => setStart(e.target.value)} />
              <span className="text-muted-foreground">–</span>
              <input type="time" aria-label={t("schedule.dialog.end")} value={end} step={900} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        )}
        <div className="full flex items-center justify-between gap-3">
          <span className="text-sm font-semibold" style={{ color: "var(--navy)" }}>{t("schedule.dialog.allDay")}</span>
          <MockupToggle checked={allDay} onCheckedChange={setAllDay} label={t("schedule.dialog.allDay")} />
        </div>
        {clashText ? (
          <div className="notice warn full" role="status"><AlertTriangle /><div className="grow">{clashText}</div></div>
        ) : block && block.conflicts.length > 0 && blocks.length === 0 && (
          <div className="notice warn full"><AlertTriangle /><div className="grow">{t("schedule.dialog.conflict")}</div></div>
        )}
        <div className="field full">
          <label htmlFor="blk-title">{t("schedule.dialog.title")}</label>
          <input id="blk-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={job ? job.name : t("schedule.dialog.titlePlaceholder")} />
        </div>
        <div className="field full">
          <label htmlFor="blk-notes">{t("schedule.dialog.notes")}</label>
          <textarea id="blk-notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("schedule.dialog.notesPlaceholder")} />
        </div>
        {block?.reminderSentAt && <p className="full text-xs text-muted-foreground m-0">{t("schedule.dialog.reminderSent")}</p>}
      </div>
    </BottomSheet>
  );
}
