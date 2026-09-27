import { useMemo } from "react";
import { format, differenceInCalendarDays, addDays, startOfWeek } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MilestoneStatusBadge } from "./badges";
import { useLanguage } from "@/i18n/LanguageContext";
import type { MilestoneStatus } from "@/lib/jobs-api";
import { formatCadWhole } from "@/lib/money";

export type GanttRow = { id: string; title: string; start: string | null; end: string | null; status: MilestoneStatus; paymentAmountCents?: number | null };

const DAY_MS = 86_400_000;
const parse = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);

/**
 * Lightweight CSS Gantt: one row per milestone, week columns, today marker.
 * Rows without dates render as a dashed placeholder so nothing disappears.
 * Styled by the `.gantt*` block in mockup-system.css (Phase 59).
 * Phase 106: on a phone the week grid would be a sideways scroll with two
 * visible weeks; there it is a list of the milestones in order instead
 * (number, title, dates · payment, status), each row opening the milestone.
 */
export function Gantt({ rows, onRowClick }: { rows: GanttRow[]; onRowClick?: (id: string) => void }) {
  const { lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const phone = useMediaQuery("(max-width: 640px)");

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

  if (phone && rows.length > 0) {
    return (
      <ol className="gl">
        {rows.map((r, i) => {
          const s = parse(r.start);
          const e = parse(r.end);
          const inner = (
            <>
              <span className={cn("ms-num", r.status === "completed" && "done", r.status === "in_progress" && "on")}>{r.status === "completed" ? <Check aria-hidden="true" /> : i + 1}</span>
              <span className="gl-main">
                <b>{r.title}</b>
                <span>
                  {s && e ? `${format(s, "d MMM", { locale })} → ${format(e, "d MMM", { locale })}` : "—"}
                  {r.paymentAmountCents ? ` · ${formatCadWhole(r.paymentAmountCents / 100)}` : ""}
                </span>
              </span>
              <MilestoneStatusBadge status={r.status} />
            </>
          );
          return <li key={r.id}>{onRowClick ? <button type="button" className="gl-row" onClick={() => onRowClick(r.id)}>{inner}</button> : <div className="gl-row">{inner}</div>}</li>;
        })}
      </ol>
    );
  }

  if (!range) {
    return <div className="gantt-none">—</div>;
  }

  const pct = (d: Date) => ((d.getTime() - range.from.getTime()) / DAY_MS / range.days) * 100;
  const todayPct = pct(range.today);
  const compact = range.weeks.length > 10;

  return (
    <div className="gantt" tabIndex={0}>
      <div className="gantt-in">
        {/* Week header */}
        <div className="gantt-head">
          <div className="gantt-lbl" />
          <div className="gantt-axis">
            {range.weeks.map((w, i) => (
              <span key={w.toISOString()} style={{ left: `${pct(w)}%` }}>
                {compact && i % 2 === 1 ? "" : format(w, "d MMM", { locale })}
              </span>
            ))}
          </div>
        </div>

        {rows.map((r) => {
          const s = parse(r.start);
          const e = parse(r.end);
          const left = s ? pct(s) : null;
          const width = s && e ? Math.max(0.8, ((differenceInCalendarDays(e, s) + 1) / range.days) * 100) : null;
          return (
            <div key={r.id} className={cn("gantt-row", onRowClick && "click")} onClick={() => onRowClick?.(r.id)}>
              <div className="gantt-lbl">
                <b>{r.title}</b>
                <span>
                  {s && e ? `${format(s, "d MMM", { locale })} → ${format(e, "d MMM", { locale })}` : "—"}
                  {r.paymentAmountCents ? ` · ${formatCadWhole(r.paymentAmountCents / 100)}` : ""}
                </span>
              </div>
              <div className="gantt-track">
                {range.weeks.map((w) => (
                  <i key={w.toISOString()} style={{ left: `${pct(w)}%` }} />
                ))}
                {left !== null && width !== null ? (
                  <div className={cn("gantt-bar", r.status)} style={{ left: `${left}%`, width: `${width}%` }} title={r.title}>
                    {width > 8 ? r.title : ""}
                  </div>
                ) : (
                  <div className="gantt-bar empty" />
                )}
              </div>
            </div>
          );
        })}

        {/* Today marker spans header + rows; the timeline starts after the 224px label column */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div className="gantt-today" style={{ left: `calc(224px + (100% - 224px) * ${todayPct / 100})` }}>
            <span>{lang === "fr" ? "Aujourd'hui" : "Today"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
