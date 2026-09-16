import { useMemo } from "react";
import { format, differenceInCalendarDays, addDays, startOfWeek } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import type { MilestoneStatus } from "@/lib/jobs-api";

export type GanttRow = { id: string; title: string; start: string | null; end: string | null; status: MilestoneStatus; paymentAmountCents?: number | null };

const BAR: Record<MilestoneStatus, string> = {
  planned: "bg-[var(--qa-purple-t)] border-[var(--qa-purple)]/30 text-[var(--qa-purple)]",
  in_progress: "bg-blue-500 border-blue-600 text-white",
  completed: "bg-emerald-500 border-emerald-600 text-white",
  skipped: "bg-slate-200 border-slate-300 text-slate-500 line-through",
};

const DAY_MS = 86_400_000;
const parse = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);

/**
 * Lightweight CSS Gantt: one row per milestone, week columns, today marker.
 * Rows without dates render as a dashed placeholder so nothing disappears.
 */
export function Gantt({ rows, onRowClick }: { rows: GanttRow[]; onRowClick?: (id: string) => void }) {
  const { lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;

  const range = useMemo(() => {
    const dates = rows.flatMap((r) => [parse(r.start), parse(r.end)]).filter((d): d is Date => !!d);
    const today = new Date();
    if (dates.length === 0) return null;
    const min = new Date(Math.min(...dates.map((d) => d.getTime()), today.getTime()));
    const max = new Date(Math.max(...dates.map((d) => d.getTime()), today.getTime()));
    const from = startOfWeek(min, { weekStartsOn: 1 });
    const to = addDays(startOfWeek(addDays(max, 7), { weekStartsOn: 1 }), 6);
    const days = Math.max(7, differenceInCalendarDays(to, from) + 1);
    const weeks: Date[] = [];
    for (let d = from; d <= to; d = addDays(d, 7)) weeks.push(d);
    return { from, to, days, weeks, today };
  }, [rows]);

  if (!range) {
    return <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">—</div>;
  }

  const pct = (d: Date) => ((d.getTime() - range.from.getTime()) / DAY_MS / range.days) * 100;
  const todayPct = pct(range.today);
  const compact = range.weeks.length > 10;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] relative pb-4">
        {/* Week header */}
        <div className="flex">
          <div className="w-56 shrink-0" />
          <div className="relative flex-1 h-7 border-b border-slate-200">
            {range.weeks.map((w, i) => (
              <div key={w.toISOString()} className="absolute top-0 h-full border-l border-slate-100 text-[10px] text-slate-400 pl-1 pt-1.5 whitespace-nowrap" style={{ left: `${pct(w)}%` }}>
                {compact && i % 2 === 1 ? "" : format(w, "d MMM", { locale })}
              </div>
            ))}
          </div>
        </div>

        {rows.map((r) => {
          const s = parse(r.start);
          const e = parse(r.end);
          const left = s ? pct(s) : null;
          const width = s && e ? Math.max(0.8, ((differenceInCalendarDays(e, s) + 1) / range.days) * 100) : null;
          return (
            <div key={r.id} className={cn("flex items-center group", onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(r.id)}>
              <div className="w-56 shrink-0 pr-3 py-2">
                <div className="text-sm font-medium text-slate-800 truncate group-hover:text-navy-700">{r.title}</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {s && e ? `${format(s, "d MMM", { locale })} → ${format(e, "d MMM", { locale })}` : "—"}
                  {r.paymentAmountCents ? ` · $${(r.paymentAmountCents / 100).toLocaleString("en-CA", { maximumFractionDigits: 0 })}` : ""}
                </div>
              </div>
              <div className="relative flex-1 h-10 border-b border-slate-50">
                {range.weeks.map((w) => (
                  <div key={w.toISOString()} className="absolute top-0 h-full border-l border-slate-100" style={{ left: `${pct(w)}%` }} />
                ))}
                {left !== null && width !== null ? (
                  <div
                    className={cn("absolute top-2 h-6 rounded-md border text-[11px] font-medium px-2 flex items-center overflow-hidden whitespace-nowrap shadow-sm", BAR[r.status])}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={r.title}
                  >
                    {width > 8 ? r.title : ""}
                  </div>
                ) : (
                  <div className="absolute top-2 left-0 h-6 w-24 rounded-md border border-dashed border-slate-300" />
                )}
              </div>
            </div>
          );
        })}

        {/* Today marker spans header + rows; the timeline starts after the 14rem label column */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div className="absolute top-7 bottom-0 border-l-2 border-rose-400 pointer-events-none" style={{ left: `calc(14rem + (100% - 14rem) * ${todayPct / 100})` }}>
            <span className="absolute bottom-0 -translate-x-1/2 text-[10px] font-semibold text-rose-500 bg-card px-1 whitespace-nowrap">{lang === "fr" ? "Aujourd'hui" : "Today"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
