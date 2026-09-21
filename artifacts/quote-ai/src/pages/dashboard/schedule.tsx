import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format, isSameDay, startOfWeek, type Locale } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { scheduleApi, type ScheduleBlockDto, type ScheduleJobDto, type ScheduleMilestoneDto } from "@/lib/schedule-api";
import { BlockDialog, type BlockDraft } from "@/components/schedule/block-dialog";

// ── Phase 75: /dashboard/schedule ───────────────────────────────────────────
// Week view: one lane per worker (+ Unassigned), one column per day; a
// milestone strip on top so the job plan and the crew plan sit together.
// Day view: one column per lane on a 6:00–20:00 time axis. In both, drag on
// empty space to create a block and drag a block to move it (HTML5 DnD; a
// plain tap opens the block). Conflicts come from the server and show as a
// red outline + icon.

const UNASSIGNED = "__unassigned__";
const HOUR_START = 6;
const HOUR_END = 20;
const PX_PER_HOUR = 44;
const DAY_MS = 86_400_000;

type View = "week" | "day";
type Lane = { id: string; name: string; role: string };

const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDay = (s: string) => new Date(`${s}T00:00:00`);
const minutesFromStart = (d: Date) => (d.getHours() - HOUR_START) * 60 + d.getMinutes();
const timeLabel = (d: Date) => format(d, "H:mm");

/** Which days of [from, from + n) a block touches. */
function daysTouched(b: ScheduleBlockDto, from: Date, n: number): number[] {
  const s = new Date(b.startsAt);
  const e = new Date(new Date(b.endsAt).getTime() - 1);
  const first = Math.max(0, differenceInCalendarDays(startOfLocalDay(s), from));
  const last = Math.min(n - 1, differenceInCalendarDays(startOfLocalDay(e), from));
  const out: number[] = [];
  for (let i = first; i <= last; i++) out.push(i);
  return out;
}

function milestoneOnDay(m: ScheduleMilestoneDto, day: Date): boolean {
  if (!m.plannedStart) return false;
  const s = parseDay(m.plannedStart);
  const e = m.plannedEnd ? parseDay(m.plannedEnd) : s;
  return day >= s && day <= e;
}

export default function SchedulePage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const jobFilter = params.get("job") || null;
  const [view, setView] = useState<View>(params.get("view") === "day" ? "day" : "week");
  const [anchor, setAnchor] = useState<Date>(() => (params.get("date") ? parseDay(params.get("date")!) : new Date()));
  useDocumentTitle(t("schedule.title"));

  const range = useMemo(() => {
    const from = view === "week" ? startOfWeek(anchor, { weekStartsOn: 1 }) : startOfLocalDay(anchor);
    const days = view === "week" ? 7 : 1;
    return { from, to: addDays(from, days), days };
  }, [view, anchor]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["schedule", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => scheduleApi.window(range.from, range.to),
  });

  const [dialog, setDialog] = useState<{ block: ScheduleBlockDto | null; draft: BlockDraft | null } | null>(null);
  const onError = (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" });
  const move = useMutation({
    mutationFn: ({ id, startsAt, endsAt, collaboratorId }: { id: string; startsAt: Date; endsAt: Date; collaboratorId: string | null }) =>
      scheduleApi.update(id, { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), collaboratorId }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      if (r.block.conflicts.length) toast({ title: t("schedule.conflictToastTitle"), description: t("schedule.conflictToastBody").replace("{name}", r.block.collaboratorName ?? "") });
    },
    onError,
  });

  const blocks = useMemo(() => (data?.blocks ?? []).filter((b) => !jobFilter || b.projectId === jobFilter), [data, jobFilter]);
  const jobs = useMemo(() => (data?.jobs ?? []).filter((j) => !jobFilter || j.id === jobFilter), [data, jobFilter]);
  const lanes = useMemo<Lane[]>(() => {
    const out: Lane[] = (data?.workers ?? []).map((w) => ({ id: w.id, name: w.name, role: w.role }));
    const known = new Set(out.map((l) => l.id));
    for (const b of blocks) if (b.collaboratorId && !known.has(b.collaboratorId)) { known.add(b.collaboratorId); out.push({ id: b.collaboratorId, name: b.collaboratorName ?? "—", role: t("schedule.inactiveWorker") }); }
    out.push({ id: UNASSIGNED, name: t("schedule.unassigned"), role: "" });
    return out;
  }, [data, blocks, t]);

  /** Drop a dragged block onto (lane, day[, minutes]) — keeps duration and, in week view, the time of day. */
  const dropBlock = useCallback((blockId: string, laneId: string, day: Date, minutes?: number) => {
    const b = blocks.find((x) => x.id === blockId) ?? data?.blocks.find((x) => x.id === blockId);
    if (!b) return;
    const s = new Date(b.startsAt);
    const dur = new Date(b.endsAt).getTime() - s.getTime();
    let startsAt: Date;
    if (minutes === undefined || b.allDay) {
      const delta = differenceInCalendarDays(day, startOfLocalDay(s));
      startsAt = new Date(s.getTime() + delta * DAY_MS);
    } else {
      startsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), HOUR_START, 0, 0, 0);
      startsAt = new Date(startsAt.getTime() + Math.round(minutes / 15) * 15 * 60_000);
    }
    const collaboratorId = laneId === UNASSIGNED ? null : laneId;
    if (startsAt.getTime() === s.getTime() && collaboratorId === b.collaboratorId) return;
    move.mutate({ id: b.id, startsAt, endsAt: new Date(startsAt.getTime() + dur), collaboratorId });
  }, [blocks, data, move]);

  const openDraft = (laneId: string, from: Date, to: Date, allDay: boolean) =>
    setDialog({ block: null, draft: { collaboratorId: laneId === UNASSIGNED ? null : laneId, projectId: jobFilter, startsAt: from, endsAt: to, allDay } });

  const shift = (n: number) => setAnchor((a) => addDays(a, view === "week" ? 7 * n : n));
  const rangeLabel = view === "week"
    ? `${format(range.from, "d MMM", { locale })} – ${format(addDays(range.to, -1), "d MMM yyyy", { locale })}`
    : format(range.from, "EEEE d MMMM yyyy", { locale });
  const filteredJob = jobFilter ? data?.jobs.find((j) => j.id === jobFilter) : undefined;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("schedule.title")}</h1>
          <p className="sub">{t("schedule.subtitle")}</p>
        </div>
        <div className="head-actions">
          <div className="seg seg-2" data-period={view === "week" ? "m" : "y"} role="tablist">
            <span className="seg-thumb" />
            <button type="button" role="tab" aria-selected={view === "week"} className="seg-b" onClick={() => setView("week")}>{t("schedule.week")}</button>
            <button type="button" role="tab" aria-selected={view === "day"} className="seg-b" onClick={() => setView("day")}>{t("schedule.day")}</button>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="ic-btn" aria-label={t("schedule.prev")} onClick={() => shift(-1)}><ChevronLeft /></button>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setAnchor(new Date())}>{t("schedule.today")}</button>
            <button type="button" className="ic-btn" aria-label={t("schedule.next")} onClick={() => shift(1)}><ChevronRight /></button>
          </div>
          <button type="button" className="btn btn-navy" onClick={() => { const d = startOfLocalDay(view === "day" ? anchor : new Date()); openDraft(UNASSIGNED, new Date(d.getTime() + 8 * 3_600_000), new Date(d.getTime() + 16 * 3_600_000), false); }}>
            <Plus className="h-4 w-4" /> {t("schedule.addBlock")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <span className="font-bold" style={{ color: "var(--navy)" }}><CalendarDays className="inline h-4 w-4 mr-1.5 -mt-0.5" />{rangeLabel}</span>
          {filteredJob && (
            <Link href="/dashboard/schedule" className="chip chip-teal">{t("schedule.onlyJob")}: {filteredJob.name} <X className="h-3 w-3 ml-1" /></Link>
          )}
          <div className="grow flex items-center gap-3 text-xs" style={{ color: "var(--muted-mk)" }}>
            <span className="inline-flex items-center gap-1"><i className="sched-key ms" /> {t("schedule.legend.milestone")}</span>
            <span className="inline-flex items-center gap-1"><i className="sched-key blk" /> {t("schedule.legend.block")}</span>
            <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--red)" }} /> {t("schedule.legend.conflict")}</span>
          </div>
        </div>

        {isLoading && <div className="p-5 space-y-3"><Skeleton className="h-10 w-full rounded-[var(--radius-mk)]" /><Skeleton className="h-40 w-full rounded-[var(--radius-mk)]" /></div>}
        {error && (
          <div className="p-5">
            <div className="notice warn"><AlertTriangle /><div className="grow">{(error as Error & { code?: string }).code === "PLAN_REQUIRED" ? t("schedule.planRequired") : (error as Error).message}{(error as Error & { code?: string }).code === "PLAN_REQUIRED" && <> <Link href="/dashboard/billing" className="text-link">{t("schedule.upgrade")}</Link></>}</div></div>
          </div>
        )}
        {data && view === "week" && (
          <WeekBoard from={range.from} lanes={lanes} blocks={blocks} jobs={jobs} locale={locale} onOpen={(b) => setDialog({ block: b, draft: null })} onCreate={openDraft} onDrop={dropBlock} />
        )}
        {data && view === "day" && (
          <DayBoard day={range.from} lanes={lanes} blocks={blocks} jobs={jobs} onOpen={(b) => setDialog({ block: b, draft: null })} onCreate={openDraft} onDrop={dropBlock} />
        )}
        {data && data.workers.length === 0 && (
          <div className="card-foot"><p className="foot-note m-0">{t("schedule.noWorkersHint")} <Link href="/dashboard/team" className="text-link">{t("schedule.goToTeam")}</Link></p></div>
        )}
        <p className="foot-note px-5 pb-4 pt-3 m-0">{t("schedule.hint")}</p>
      </div>

      <BlockDialog open={!!dialog} onOpenChange={(o) => { if (!o) setDialog(null); }} block={dialog?.block ?? null} draft={dialog?.draft ?? null} jobs={data?.jobs ?? []} workers={data?.workers ?? []} />
    </div>
  );
}

// ── Shared chip ──────────────────────────────────────────────────────────────

function BlockChip({ b, onOpen, style, showTime = true, className }: { b: ScheduleBlockDto; onOpen: (b: ScheduleBlockDto) => void; style?: CSSProperties; showTime?: boolean; className?: string }) {
  const { t } = useLanguage();
  const s = new Date(b.startsAt);
  const e = new Date(b.endsAt);
  const label = b.label ?? t("schedule.blockFallback");
  return (
    <button
      type="button"
      draggable
      onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", b.id); ev.dataTransfer.effectAllowed = "move"; }}
      onClick={(ev) => { ev.stopPropagation(); onOpen(b); }}
      onMouseDown={(ev) => ev.stopPropagation()}
      className={cn("sched-blk", b.conflicts.length > 0 && "conflict", b.allDay && "allday", className)}
      style={style}
      title={`${label}${b.milestoneTitle ? ` · ${b.milestoneTitle}` : ""}${b.notes ? `\n${b.notes}` : ""}`}
    >
      {b.conflicts.length > 0 && <AlertTriangle className="sched-warn" />}
      <b>{label}</b>
      <span>{b.allDay ? t("schedule.allDay") : showTime ? `${timeLabel(s)}–${timeLabel(e)}` : ""}{b.milestoneTitle ? ` · ${b.milestoneTitle}` : ""}</span>
    </button>
  );
}

function MilestoneChips({ jobs, day }: { jobs: ScheduleJobDto[]; day: Date }) {
  const items = jobs.flatMap((j) => j.milestones.filter((m) => milestoneOnDay(m, day)).map((m) => ({ job: j, m })));
  if (!items.length) return null;
  return (
    <>
      {items.map(({ job, m }) => (
        <Link key={m.id} href={`/dashboard/jobs/${job.id}?tab=schedule`} className={cn("sched-ms", m.status)} title={`${job.name} — ${m.title}`}>
          <b>{job.name}</b> {m.title}
        </Link>
      ))}
    </>
  );
}

// ── Week view ────────────────────────────────────────────────────────────────

function WeekBoard({ from, lanes, blocks, jobs, locale, onOpen, onCreate, onDrop }: {
  from: Date;
  lanes: Lane[];
  blocks: ScheduleBlockDto[];
  jobs: ScheduleJobDto[];
  locale: Locale;
  onOpen: (b: ScheduleBlockDto) => void;
  onCreate: (laneId: string, from: Date, to: Date, allDay: boolean) => void;
  onDrop: (blockId: string, laneId: string, day: Date) => void;
}) {
  const { t } = useLanguage();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(from, i)), [from]);
  const today = new Date();
  const [sel, setSel] = useState<{ lane: string; a: number; b: number } | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);

  // Drag-to-create: mousedown on a cell starts a selection in that lane, mouseup anywhere ends it.
  useEffect(() => {
    if (!sel) return;
    const up = () => {
      const lo = Math.min(sel.a, sel.b);
      const hi = Math.max(sel.a, sel.b);
      const first = days[lo]!;
      if (lo === hi) onCreate(sel.lane, new Date(first.getTime() + 8 * 3_600_000), new Date(first.getTime() + 16 * 3_600_000), false);
      else onCreate(sel.lane, first, addDays(days[hi]!, 1), true);
      setSel(null);
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [sel, days, onCreate]);

  const byCell = useMemo(() => {
    const map = new Map<string, ScheduleBlockDto[]>();
    for (const b of blocks) {
      const lane = b.collaboratorId ?? UNASSIGNED;
      for (const i of daysTouched(b, from, 7)) {
        const key = `${lane}:${i}`;
        map.set(key, [...(map.get(key) ?? []), b]);
      }
    }
    return map;
  }, [blocks, from]);

  const inSel = (lane: string, i: number) => !!sel && sel.lane === lane && i >= Math.min(sel.a, sel.b) && i <= Math.max(sel.a, sel.b);

  return (
    <div className="sched" onMouseLeave={() => setSel(null)}>
      <div className="sched-in week">
        <div className="sched-row head">
          <div className="sched-lbl" />
          {days.map((d) => (
            <div key={d.toISOString()} className={cn("sched-day", isSameDay(d, today) && "today")}>
              <b>{format(d, "EEE", { locale })}</b> <span>{format(d, "d MMM", { locale })}</span>
            </div>
          ))}
        </div>
        <div className="sched-row ms-row">
          <div className="sched-lbl"><b>{t("schedule.milestones")}</b></div>
          {days.map((d) => (
            <div key={d.toISOString()} className={cn("sched-cell ms", isSameDay(d, today) && "today")}><MilestoneChips jobs={jobs} day={d} /></div>
          ))}
        </div>
        {lanes.map((lane) => (
          <div key={lane.id} className={cn("sched-row", lane.id === UNASSIGNED && "unassigned")}>
            <div className="sched-lbl"><b>{lane.name}</b>{lane.role && <span>{lane.role}</span>}</div>
            {days.map((d, i) => {
              const key = `${lane.id}:${i}`;
              return (
                <div
                  key={key}
                  className={cn("sched-cell", isSameDay(d, today) && "today", inSel(lane.id, i) && "sel", overCell === key && "over")}
                  onMouseDown={(ev) => { if (ev.button === 0) { ev.preventDefault(); setSel({ lane: lane.id, a: i, b: i }); } }}
                  onMouseEnter={() => { if (sel && sel.lane === lane.id) setSel({ ...sel, b: i }); }}
                  onDragOver={(ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; if (overCell !== key) setOverCell(key); }}
                  onDragLeave={() => setOverCell((c) => (c === key ? null : c))}
                  onDrop={(ev) => { ev.preventDefault(); setOverCell(null); const id = ev.dataTransfer.getData("text/plain"); if (id) onDrop(id, lane.id, d); }}
                >
                  {(byCell.get(key) ?? []).map((b) => <BlockChip key={b.id} b={b} onOpen={onOpen} />)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Day view ─────────────────────────────────────────────────────────────────

function DayBoard({ day, lanes, blocks, jobs, onOpen, onCreate, onDrop }: {
  day: Date;
  lanes: Lane[];
  blocks: ScheduleBlockDto[];
  jobs: ScheduleJobDto[];
  onOpen: (b: ScheduleBlockDto) => void;
  onCreate: (laneId: string, from: Date, to: Date, allDay: boolean) => void;
  onDrop: (blockId: string, laneId: string, day: Date, minutes: number) => void;
}) {
  const { t } = useLanguage();
  const hours = useMemo(() => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i), []);
  const height = (HOUR_END - HOUR_START) * PX_PER_HOUR;
  const [sel, setSel] = useState<{ lane: string; a: number; b: number } | null>(null);
  const colRefs = useRef(new Map<string, HTMLDivElement>());
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id); }, []);

  const minutesAt = (laneId: string, clientY: number) => {
    const el = colRefs.current.get(laneId);
    if (!el) return 0;
    const y = clientY - el.getBoundingClientRect().top;
    return Math.max(0, Math.min((HOUR_END - HOUR_START) * 60, Math.round((y / PX_PER_HOUR) * 60 / 30) * 30));
  };

  useEffect(() => {
    if (!sel) return;
    const moveHandler = (ev: MouseEvent) => setSel((s) => (s ? { ...s, b: minutesAt(s.lane, ev.clientY) } : s));
    const up = () => {
      let lo = Math.min(sel.a, sel.b);
      let hi = Math.max(sel.a, sel.b);
      if (hi - lo < 30) { hi = lo + 60; lo = Math.max(0, lo); }
      const base = new Date(day.getFullYear(), day.getMonth(), day.getDate(), HOUR_START, 0, 0, 0);
      onCreate(sel.lane, new Date(base.getTime() + lo * 60_000), new Date(base.getTime() + hi * 60_000), false);
      setSel(null);
    };
    window.addEventListener("mousemove", moveHandler);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", moveHandler); window.removeEventListener("mouseup", up); };
  }, [sel, day, onCreate]);

  const dayEnd = addDays(day, 1);
  const inDay = blocks.filter((b) => day < new Date(b.endsAt) && dayEnd > new Date(b.startsAt));
  const nowTop = isSameDay(now, day) ? (minutesFromStart(now) / 60) * PX_PER_HOUR : null;

  return (
    <div className="sched">
      <div className="sched-in dayv" style={{ gridTemplateColumns: `56px repeat(${lanes.length}, minmax(150px, 1fr))` }}>
        <div className="sched-corner" />
        {lanes.map((lane) => (
          <div key={lane.id} className={cn("sched-day lane", lane.id === UNASSIGNED && "unassigned")}><b>{lane.name}</b>{lane.role && <span>{lane.role}</span>}</div>
        ))}
        <div className="sched-corner strip"><span>{t("schedule.milestones")}</span></div>
        <div className="sched-strip" style={{ gridColumn: `2 / span ${lanes.length}` }}><MilestoneChips jobs={jobs} day={day} /></div>
        <div className="sched-corner strip"><span>{t("schedule.allDay")}</span></div>
        {lanes.map((lane) => (
          <div
            key={`ad-${lane.id}`}
            className="sched-strip lane"
            onDragOver={(ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; }}
            onDrop={(ev) => { ev.preventDefault(); const id = ev.dataTransfer.getData("text/plain"); if (id) onDrop(id, lane.id, day, 0); }}
          >
            {inDay.filter((b) => b.allDay && (b.collaboratorId ?? UNASSIGNED) === lane.id).map((b) => <BlockChip key={b.id} b={b} onOpen={onOpen} />)}
          </div>
        ))}
        <div className="sched-gutter" style={{ height }}>
          {hours.map((h) => <span key={h} style={{ top: (h - HOUR_START) * PX_PER_HOUR }}>{h}:00</span>)}
        </div>
        {lanes.map((lane) => (
          <div
            key={`col-${lane.id}`}
            ref={(el) => { if (el) colRefs.current.set(lane.id, el); else colRefs.current.delete(lane.id); }}
            className={cn("sched-col", lane.id === UNASSIGNED && "unassigned")}
            style={{ height }}
            onMouseDown={(ev) => { if (ev.button === 0 && ev.target === ev.currentTarget) { ev.preventDefault(); const m = minutesAt(lane.id, ev.clientY); setSel({ lane: lane.id, a: m, b: m }); } }}
            onDragOver={(ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; }}
            onDrop={(ev) => { ev.preventDefault(); const id = ev.dataTransfer.getData("text/plain"); if (id) onDrop(id, lane.id, day, minutesAt(lane.id, ev.clientY)); }}
          >
            {hours.map((h) => <i key={h} style={{ top: (h - HOUR_START) * PX_PER_HOUR }} />)}
            {sel && sel.lane === lane.id && (
              <div className="sched-sel" style={{ top: (Math.min(sel.a, sel.b) / 60) * PX_PER_HOUR, height: Math.max(PX_PER_HOUR / 2, (Math.abs(sel.b - sel.a) / 60) * PX_PER_HOUR) }} />
            )}
            {inDay.filter((b) => !b.allDay && (b.collaboratorId ?? UNASSIGNED) === lane.id).map((b) => {
              const bs = new Date(b.startsAt);
              const be = new Date(b.endsAt);
              const s = bs < day ? day : bs;
              const e = be > dayEnd ? dayEnd : be;
              const startMin = Math.max(0, minutesFromStart(s));
              const endMin = Math.min((HOUR_END - HOUR_START) * 60, isSameDay(e, day) ? minutesFromStart(e) : (HOUR_END - HOUR_START) * 60);
              const top = (startMin / 60) * PX_PER_HOUR;
              const h = Math.max(22, ((endMin - startMin) / 60) * PX_PER_HOUR - 2);
              return <BlockChip key={b.id} b={b} onOpen={onOpen} className="timed" style={{ top, height: h }} />;
            })}
            {nowTop !== null && nowTop >= 0 && nowTop <= height && <div className="sched-now" style={{ top: nowTop }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
