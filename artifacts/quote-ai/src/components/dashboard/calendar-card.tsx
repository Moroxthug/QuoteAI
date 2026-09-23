// Phase 85 — "What is happening" on the dashboard home.
//
// A month grid with a dot per kind of thing, and the selected day's agenda
// beside it. Everything in it already existed somewhere else — schedule
// blocks, job milestones, invoices due, quote follow-ups — plus, for an Elite
// account with a calendar connected, the events from their own calendar. The
// point of the widget is that no one should have to visit four pages to answer
// "what is today".
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { ArrowRight, Briefcase, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Flag, Lock, Receipt, RefreshCw, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/jobs-api";
import { calendarApi, type AgendaEntryDto, type AgendaKind } from "@/lib/calendar-api";

const KIND_ICON: Record<AgendaKind, typeof Briefcase> = {
  block: Briefcase,
  milestone: Flag,
  invoice: Receipt,
  followup: Send,
  external: CalendarDays,
};

/** One class per kind, so the dots, the icons and the rows agree. */
const KIND_CLASS: Record<AgendaKind, string> = {
  block: "cal-block",
  milestone: "cal-milestone",
  invoice: "cal-invoice",
  followup: "cal-followup",
  external: "cal-external",
};

function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** An entry belongs to every day it touches (a three-day block shows on three). */
function daysCovered(entry: AgendaEntryDto): string[] {
  const start = startOfDay(new Date(entry.startsAt));
  const rawEnd = new Date(entry.endsAt);
  // An all-day entry ends at the following midnight — that day is not covered.
  const end = startOfDay(new Date(rawEnd.getTime() - (entry.allDay ? 1 : 0)));
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 60; d = new Date(d.getTime() + 86_400_000)) out.push(dayKey(d));
  return out.length ? out : [dayKey(start)];
}

export function CalendarCard() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));

  // The grid always shows whole weeks, so ask for exactly what it draws.
  const gridStart = useMemo(() => startOfWeek(startOfMonth(month), { locale }), [month, locale]);
  const gridEnd = useMemo(() => endOfWeek(endOfMonth(month), { locale }), [month, locale]);

  const agenda = useQuery({
    queryKey: ["agenda", gridStart.toISOString(), gridEnd.toISOString()],
    queryFn: () => calendarApi.agenda(gridStart, gridEnd),
    retry: false,
    staleTime: 30_000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await calendarApi.refresh();
      await agenda.refetch();
    } catch {
      // A failed pull is already reported per-connection in Settings.
    } finally {
      setRefreshing(false);
    }
  };

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaEntryDto[]>();
    for (const entry of agenda.data?.entries ?? []) {
      for (const key of daysCovered(entry)) map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [agenda.data]);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let d = gridStart; d <= gridEnd; d = new Date(d.getTime() + 86_400_000)) out.push(d);
    return out;
  }, [gridStart, gridEnd]);

  const weekdayLabels = useMemo(() => days.slice(0, 7).map((d) => format(d, "EEEEE", { locale })), [days, locale]);
  const selectedEntries = byDay.get(dayKey(selected)) ?? [];
  /**
   * Most days are empty, especially early on — so an empty day answers the
   * question that was actually being asked and shows what is next instead of
   * a blank panel.
   */
  const upcoming = useMemo(() => {
    if (selectedEntries.length) return [];
    const after = selected.getTime();
    return (agenda.data?.entries ?? []).filter((e) => new Date(e.startsAt).getTime() > after).slice(0, 3);
  }, [agenda.data, selected, selectedEntries.length]);

  if (agenda.isLoading) return <Skeleton className="h-80 w-full rounded-[var(--radius)]" style={{ marginTop: 16 }} />;

  // Starter/free: the schedule is a Pro feature, so say so in one line rather
  // than showing an empty calendar.
  if (agenda.data && !agenda.data.scheduleEnabled) {
    return (
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-foot" style={{ borderTop: "none" }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="qa-ic navy"><Lock className="h-4 w-4" /></span>
            <div className="min-w-0">
              <b className="block text-sm text-navy-900">{t("dashboard.calendar.title")}</b>
              <span className="block text-xs text-slate-500">{t("dashboard.calendar.locked")}</span>
            </div>
          </div>
          <Link href="/dashboard/billing" className="cta-link" style={{ fontSize: 13.5 }}>
            {t("dashboard.calendar.upgrade")} <ArrowRight className="chev" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="card cal-card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div className="min-w-0">
          <h2><CalendarDays className="h-4 w-4" /> {t("dashboard.calendar.title")}</h2>
          <p className="sub">{t("dashboard.calendar.subtitle")}</p>
        </div>
        <div className="cal-nav">
          {agenda.data?.externalEnabled && (
            <button
              type="button"
              className="ic-btn"
              onClick={refresh}
              disabled={refreshing}
              aria-label={t("dashboard.calendar.refresh")}
              title={t("dashboard.calendar.refresh")}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </button>
          )}
          <button type="button" className="ic-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label={t("dashboard.calendar.previousMonth")}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn btn-outline-navy btn-sm"
            onClick={() => {
              const today = startOfDay(new Date());
              setMonth(startOfMonth(today));
              setSelected(today);
            }}
          >
            {t("dashboard.calendar.today")}
          </button>
          <button type="button" className="ic-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label={t("dashboard.calendar.nextMonth")}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="cal-grid-wrap">
        <div>
          <p className="cal-month">{format(month, "LLLL yyyy", { locale })}</p>
          <div className="cal-week-head" aria-hidden="true">
            {weekdayLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          {/* Deliberately not `role="grid"`: a grid promises rows and arrow-key
              navigation, and this is a read-only month overview. It is a group
              of buttons, each named with its own full date. */}
          <div className="cal-grid" role="group" aria-label={format(month, "LLLL yyyy", { locale })}>
            {days.map((day) => {
              const entries = byDay.get(dayKey(day)) ?? [];
              const kinds = [...new Set(entries.map((e) => e.kind))].slice(0, 4);
              const isSelected = isSameDay(day, selected);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  aria-current={isToday(day) ? "date" : undefined}
                  aria-pressed={isSelected}
                  className={cn("cal-day", !isSameMonth(day, month) && "muted", isToday(day) && "today", isSelected && "on")}
                  onClick={() => setSelected(startOfDay(day))}
                >
                  <span className="n">{format(day, "d")}</span>
                  <span className="dots">
                    {kinds.map((k) => (
                      <i key={k} className={cn("dot", KIND_CLASS[k])} />
                    ))}
                  </span>
                  <span className="sr-only">
                    {format(day, "PPPP", { locale })}
                    {entries.length ? ` — ${entries.length}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="cal-agenda">
          <p className="cal-agenda-head">{format(selected, "EEEE d MMMM", { locale })}</p>
          {selectedEntries.length === 0 && (
            <>
              <p className="foot-note" style={{ padding: "6px 0 2px" }}>{t("dashboard.calendar.empty")}</p>
              {upcoming.length > 0 && <p className="cal-agenda-head" style={{ marginTop: 10 }}>{t("dashboard.calendar.nextUp")}</p>}
            </>
          )}
          {(selectedEntries.length > 0 || upcoming.length > 0) && (
            <ul className="cal-list">
              {(selectedEntries.length ? selectedEntries : upcoming).map((entry) => {
                const Icon = KIND_ICON[entry.kind];
                const time = entry.allDay
                  ? t("dashboard.calendar.allDay")
                  : `${format(new Date(entry.startsAt), "HH:mm")}–${format(new Date(entry.endsAt), "HH:mm")}`;
                const body = (
                  <>
                    <span className={cn("cal-ic", KIND_CLASS[entry.kind])}><Icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{entry.title}</b>
                      <span className="block truncate cal-sub">
                        {time}
                        {entry.subtitle ? ` · ${entry.subtitle}` : ""}
                      </span>
                    </span>
                    {entry.amountCents != null && entry.amountCents > 0 && (
                      <span className={cn("cal-amt", entry.state === "overdue" && "late")}>{formatCents(entry.amountCents)}</span>
                    )}
                  </>
                );
                if (entry.href) {
                  return (
                    <li key={entry.id}>
                      <Link href={entry.href} className="cal-row">{body}</Link>
                    </li>
                  );
                }
                if (entry.externalUrl) {
                  return (
                    <li key={entry.id}>
                      <a href={entry.externalUrl} target="_blank" rel="noreferrer noopener" className="cal-row">
                        {body}
                        <ExternalLink className="h-3 w-3 shrink-0" style={{ color: "var(--faint)" }} />
                      </a>
                    </li>
                  );
                }
                return (
                  <li key={entry.id}>
                    <span className="cal-row">{body}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="cal-foot">
            <Link href="/dashboard/schedule" className="cta-link" style={{ fontSize: 13 }}>
              {t("dashboard.calendar.openBoard")} <ArrowRight className="chev" />
            </Link>
            {!agenda.data?.externalEnabled && (
              <Link href="/dashboard/settings?tab=integrations" className="foot-note" style={{ textDecoration: "underline" }}>
                {t("dashboard.calendar.connectPrompt")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
