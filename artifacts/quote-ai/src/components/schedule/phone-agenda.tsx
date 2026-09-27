import { useMemo } from "react";
import { Link } from "wouter";
import { addDays, format, isSameDay, type Locale } from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { ListRow } from "@/components/mobile/list-row";
import { mapsUrl } from "@/components/crew/worker-today";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import type { ScheduleBlockDto, ScheduleJobDto, ScheduleMilestoneDto, ScheduleWorkerDto } from "@/lib/schedule-api";

// ── Phase 109: the schedule under 768 px ────────────────────────────────────
// A week strip (seven days, a dot per block, red when a day is double-booked)
// to jump, then the chosen day as an agenda grouped by person or by job. A tap
// opens the block in the sheet; nothing here drags.

export type AgendaMode = "person" | "job";

const hm = (d: Date) => format(d, "H:mm");
const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDay = (s: string) => new Date(`${s}T00:00:00`);

function milestoneOnDay(m: ScheduleMilestoneDto, day: Date): boolean {
  if (!m.plannedStart) return false;
  const s = parseDay(m.plannedStart);
  const e = m.plannedEnd ? parseDay(m.plannedEnd) : s;
  return day >= s && day <= e;
}

export function MilestoneChips({ jobs, day }: { jobs: ScheduleJobDto[]; day: Date }) {
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

const onDay = (b: ScheduleBlockDto, day: Date) => day < new Date(b.endsAt) && addDays(day, 1) > new Date(b.startsAt);

export function PhoneAgenda({ weekFrom, day, onPickDay, onShiftWeek, onToday, mode, onMode, blocks, allBlocks, workers, jobs, locale, canEdit, onOpen, onBook }: {
  weekFrom: Date;
  day: Date;
  onPickDay: (d: Date) => void;
  onShiftWeek: (n: number) => void;
  onToday: () => void;
  mode: AgendaMode;
  onMode: (m: AgendaMode) => void;
  /** The week's blocks after the job filter. */
  blocks: ScheduleBlockDto[];
  /** Every block loaded (a double-booking may be on another job). */
  allBlocks: ScheduleBlockDto[];
  workers: ScheduleWorkerDto[];
  jobs: ScheduleJobDto[];
  locale: Locale;
  canEdit: boolean;
  onOpen: (b: ScheduleBlockDto) => void;
  onBook: (workerId: string) => void;
}) {
  const { t, lang } = useLanguage();
  const today = new Date();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i)), [weekFrom]);
  const hours = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 1 });
  const count = (n: number) => (n === 0 ? t("schedule.m.none") : n === 1 ? t("schedule.m.block1") : t("schedule.m.blocks").replace("{n}", String(n)));

  const dayBlocks = useMemo(
    () => blocks.filter((b) => onDay(b, day)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startsAt.localeCompare(b.startsAt)),
    [blocks, day],
  );

  const when = (b: ScheduleBlockDto) => (b.allDay ? t("schedule.allDay") : `${hm(new Date(b.startsAt))}–${hm(new Date(b.endsAt))}`);
  const clashLine = (b: ScheduleBlockDto) => {
    const other = b.conflicts.map((id) => allBlocks.find((x) => x.id === id)).find(Boolean);
    if (!b.conflicts.length) return null;
    return (
      <span className="ag-clash">
        <AlertTriangle aria-hidden="true" />
        {t("schedule.m.clash").replace("{what}", other ? (other.label ?? t("schedule.blockFallback")) : "").replace("{when}", other ? when(other) : "").trim()}
      </span>
    );
  };
  const timeTile = (b: ScheduleBlockDto) => (
    <span className={cn("ag-time", b.allDay && "all")}>
      {b.allDay ? <b>{t("schedule.allDay")}</b> : <><b>{hm(new Date(b.startsAt))}</b><span>{hm(new Date(b.endsAt))}</span></>}
    </span>
  );
  const row = (b: ScheduleBlockDto, title: string, meta: (string | null | undefined)[]) => (
    <li key={b.id}>
      <ListRow
        className={cn("ag-row", b.conflicts.length > 0 && "clash")}
        lead={timeTile(b)}
        title={title}
        meta={meta.filter(Boolean) as string[]}
        below={clashLine(b)}
        onClick={() => onOpen(b)}
        chevron
      />
    </li>
  );

  // By person: the booked people in order of their first block, Unassigned after, the free ones as a line at the end.
  const byPerson = useMemo(() => {
    const groups = new Map<string, { id: string | null; name: string; items: ScheduleBlockDto[] }>();
    for (const b of dayBlocks) {
      const key = b.collaboratorId ?? "";
      if (!groups.has(key)) groups.set(key, { id: b.collaboratorId, name: b.collaboratorName ?? t("schedule.unassigned"), items: [] });
      groups.get(key)!.items.push(b);
    }
    const list = [...groups.values()];
    return [...list.filter((g) => g.id), ...list.filter((g) => !g.id)];
  }, [dayBlocks, t]);
  const free = workers.filter((w) => !dayBlocks.some((b) => b.collaboratorId === w.id));

  const byJob = useMemo(() => {
    const groups = new Map<string, { id: string | null; name: string; address: string | null; items: ScheduleBlockDto[] }>();
    for (const b of dayBlocks) {
      const key = b.projectId ?? "";
      if (!groups.has(key)) groups.set(key, { id: b.projectId, name: b.projectName ?? t("schedule.m.noJob"), address: b.projectAddress, items: [] });
      groups.get(key)!.items.push(b);
    }
    const list = [...groups.values()];
    return [...list.filter((g) => g.id), ...list.filter((g) => !g.id)];
  }, [dayBlocks, t]);

  const hoursOf = (items: ScheduleBlockDto[]) => {
    const end = addDays(day, 1);
    // The time covered, not the sum: a double-booked stretch counts once.
    const spans = items
      .filter((b) => !b.allDay)
      .map((b) => [Math.max(new Date(b.startsAt).getTime(), day.getTime()), Math.min(new Date(b.endsAt).getTime(), end.getTime())] as const)
      .filter(([s, e]) => e > s)
      .sort((a, b) => a[0] - b[0]);
    let ms = 0;
    let reach = -Infinity;
    for (const [s, e] of spans) {
      if (e <= reach) continue;
      ms += e - Math.max(s, reach);
      reach = e;
    }
    return ms > 0 ? t("schedule.m.hours").replace("{n}", hours.format(ms / 3_600_000)) : null;
  };

  const milestones = jobs.some((j) => j.milestones.some((m) => milestoneOnDay(m, day)));

  return (
    <div className="agenda">
      <section className="card ag-week" aria-label={t("schedule.week")}>
        <div className="ag-week-head">
          <b>{format(day, "MMMM yyyy", { locale })}</b>
          <div className="ag-nav">
            <button type="button" className="ic-btn" aria-label={t("schedule.prev")} onClick={() => onShiftWeek(-1)}><ChevronLeft /></button>
            <button type="button" className="btn btn-sm btn-outline-navy" disabled={isSameDay(day, today)} onClick={onToday}>{t("schedule.today")}</button>
            <button type="button" className="ic-btn" aria-label={t("schedule.next")} onClick={() => onShiftWeek(1)}><ChevronRight /></button>
          </div>
        </div>
        <div className="ag-strip">
          {days.map((d) => {
            const items = blocks.filter((b) => onDay(b, d));
            const clash = items.some((b) => b.conflicts.length > 0);
            const picked = isSameDay(d, day);
            return (
              <button
                key={d.toISOString()}
                type="button"
                className={cn("ag-d", picked && "on", isSameDay(d, today) && "today")}
                aria-pressed={picked}
                onClick={() => onPickDay(startOfLocalDay(d))}
              >
                <span>{format(d, "EEEEEE", { locale })}</span>
                <b>{format(d, "d")}</b>
                <span className="sr-only">, {format(d, "EEEE d MMMM", { locale })}, {count(items.length)}</span>
                <i className="ag-dots" aria-hidden="true">
                  {items.slice(0, 3).map((b, i) => <em key={b.id} className={cn(clash && i === 0 && "red")} />)}
                </i>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card ag-day" aria-labelledby="ag-day-title">
        <div className="ag-day-head">
          <h2 id="ag-day-title">{format(day, "EEEE d MMMM", { locale })}</h2>
          <div className="seg seg-2" data-period={mode === "person" ? "m" : "y"} role="tablist" aria-label={t("schedule.m.groupBy")}>
            <span className="seg-thumb" />
            <button type="button" role="tab" aria-selected={mode === "person"} className="seg-b" onClick={() => onMode("person")}>{t("schedule.m.byPerson")}</button>
            <button type="button" role="tab" aria-selected={mode === "job"} className="seg-b" onClick={() => onMode("job")}>{t("schedule.m.byJob")}</button>
          </div>
        </div>

        {milestones && <div className="ag-ms"><MilestoneChips jobs={jobs} day={day} /></div>}

        {dayBlocks.length === 0 && <p className="ag-empty">{t("schedule.m.nothing")}</p>}

        {mode === "person" && byPerson.map((g) => (
          <div key={g.id ?? "none"} className={cn("ag-group", !g.id && "muted")}>
            <div className="ag-group-head">
              <h3>{g.name}</h3>
              {hoursOf(g.items) && <span>{hoursOf(g.items)}</span>}
            </div>
            <ul className="lrows">
              {g.items.map((b) => row(b, b.label ?? t("schedule.blockFallback"), [b.milestoneTitle, b.projectAddress]))}
            </ul>
          </div>
        ))}

        {mode === "job" && byJob.map((g) => (
          <div key={g.id ?? "none"} className={cn("ag-group", !g.id && "muted")}>
            <div className="ag-group-head">
              <h3>{g.id ? <Link href={`/dashboard/jobs/${g.id}`}>{g.name}</Link> : g.name}</h3>
              {g.address && (
                <a className="crew-job-addr" href={mapsUrl(g.address)} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden="true" />{g.address}</a>
              )}
            </div>
            <ul className="lrows">
              {g.items.map((b) => row(b, b.collaboratorName ?? t("schedule.unassigned"), [b.title || null, b.milestoneTitle]))}
            </ul>
          </div>
        ))}

        {mode === "person" && free.length > 0 && (
          <div className="ag-free">
            <span>{t("schedule.m.free")}</span>
            {free.map((w) =>
              canEdit ? (
                <button key={w.id} type="button" className="chip" onClick={() => onBook(w.id)}>
                  <span className="sr-only">{t("schedule.m.book")} </span>{w.name}
                </button>
              ) : (
                <span key={w.id} className="chip">{w.name}</span>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
