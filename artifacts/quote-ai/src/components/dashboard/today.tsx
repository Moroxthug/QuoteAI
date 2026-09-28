// Phase 104 (docs/MOBILE-AND-APP-PLAN.md) — the pieces of the dashboard home.
//
// "Needs you" is the page's reason to exist: one list, most urgent first, of
// what the owner has to act on, each row with its one action. The rest is
// quieter: the period's numbers as one strip, the crew as one line, and the
// next five things on the schedule instead of a month grid.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isToday, isTomorrow, startOfDay } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck2,
  Flag,
  Landmark,
  Loader2,
  Lock,
  OctagonAlert,
  PhoneCall,
  Receipt,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CardSkeleton, ListSkeleton, StatStripSkeleton } from "@/components/skeletons";
import { usePrefetchOnPress } from "@/hooks/use-prefetch-on-press";
import { ActionSheet } from "@/components/mobile/action-sheet";
import { StatStrip, type StatItem } from "@/components/mobile/stat-strip";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/jobs-api";
import { formatCadWhole } from "@/lib/money";
import { invoicesApi } from "@/lib/invoices-api";
import { crewApi } from "@/lib/team-api";
import { calendarApi, type AgendaEntryDto, type AgendaKind } from "@/lib/calendar-api";
import { todayApi, type NeedsYouItemDto, type NeedsYouKind } from "@/lib/today-api";

type T = (key: string) => string;
const fill = (s: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

/* ─── Needs you ───────────────────────────────────────────────────────────── */

const KIND: Record<NeedsYouKind, { icon: LucideIcon; tone: "red" | "yellow" | "navy" | "teal" }> = {
  blocker: { icon: OctagonAlert, tone: "red" },
  etransfer: { icon: Landmark, tone: "teal" },
  overdue: { icon: Receipt, tone: "yellow" },
  hours: { icon: Clock, tone: "navy" },
  followup: { icon: PhoneCall, tone: "navy" },
  waiting: { icon: Send, tone: "navy" },
};

/** Rows shown before "Show all". */
const FIRST = 5;

type RowText = { title: string; meta: string[]; action: string; amount?: string };

function rowText(item: NeedsYouItemDto, t: T, dateLabel: (iso: string) => string): RowText {
  const amount = item.amountCents ? formatCents(item.amountCents) : undefined;
  const days = item.days ?? 0;
  switch (item.kind) {
    case "blocker":
      return { title: item.title, meta: [t("today.ny.blocker"), item.subtitle], action: t("today.ny.answer") };
    case "etransfer":
      return { title: item.subtitle || item.title, meta: [t("today.ny.etransfer"), item.title], action: t("today.ny.confirm"), amount };
    case "overdue":
      return {
        title: item.subtitle || item.title,
        meta: [fill(t(days === 1 ? "today.ny.lateOne" : "today.ny.lateMany"), { days }), item.title],
        action: item.canRemind ? t("today.ny.remind") : t("today.ny.open"),
        amount,
      };
    case "hours":
      return {
        title: fill(t("today.ny.hoursTitle"), { hours: item.hours ?? 0 }),
        meta: [fill(t((item.count ?? 0) === 1 ? "today.ny.entriesOne" : "today.ny.entriesMany"), { n: item.count ?? 0 }), fill(t((item.people ?? 0) === 1 ? "today.ny.peopleOne" : "today.ny.peopleMany"), { n: item.people ?? 0 })],
        action: t("today.ny.review"),
      };
    case "followup":
      return { title: item.title, meta: [item.at ? fill(t("today.ny.followupDue"), { date: dateLabel(item.at) }) : t("today.ny.followup"), item.subtitle], action: item.phone ? t("today.ny.call") : t("today.ny.open") };
    case "waiting":
      return {
        title: item.title,
        meta: [fill(t(days === 1 ? "today.ny.waitingOne" : "today.ny.waitingMany"), { days }), item.subtitle],
        action: item.phone ? t("today.ny.call") : t("today.ny.followUp"),
        amount,
      };
  }
}

function NeedsYouRow({ item }: { item: NeedsYouItemDto }) {
  const { t, lang } = useLanguage();
  // Phase 115: the row starts loading what it opens when it is pressed.
  const press = usePrefetchOnPress();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dateLabel = (iso: string) => {
    const d = new Date(iso);
    if (isToday(d)) return t("today.today");
    return format(d, "EEE d MMM", { locale });
  };
  const text = rowText(item, t, dateLabel);
  const { icon: Icon, tone } = KIND[item.kind];
  const remind = useMutation({
    mutationFn: () => invoicesApi.remind(item.id.replace(/^overdue:/, "")),
    onSuccess: () => {
      toast({ title: t("today.ny.reminded") });
      queryClient.invalidateQueries({ queryKey: ["today", "needs-you"] });
    },
    onError: (e: Error) => toast({ title: t("today.ny.remindFailed"), description: e.message, variant: "destructive" }),
  });

  const body = (
    <>
      <span className={cn("ny-ic", tone)} aria-hidden="true"><Icon /></span>
      <span className="lrow-main">
        <span className="lrow-title">{text.title}</span>
        <span className="lrow-meta">{text.amount && <span className="ny-amt-inline">{text.amount} · </span>}{text.meta.filter(Boolean).join(" · ")}</span>
      </span>
      {text.amount && <span className="lrow-amt ny-amt">{text.amount}</span>}
    </>
  );

  // The row's action is either "go there" (the whole row is the link, the pill
  // says what you will do) or something the row does itself (remind, call).
  const inlineRemind = item.kind === "overdue" && item.canRemind;
  const call = (item.kind === "followup" || item.kind === "waiting") && item.phone;
  if (!inlineRemind && !call) {
    return (
      <li>
        <Link href={item.href} className="lrow ny-row" {...press(item.href)}>
          {body}
          <span className="ny-pill" aria-hidden="true">{text.action}</span>
          <span className="sr-only"> — {text.action}</span>
        </Link>
      </li>
    );
  }
  return (
    <li className="ny-split">
      <Link href={item.href} className="lrow ny-row" {...press(item.href)}>{body}</Link>
      {inlineRemind ? (
        <button type="button" className="ny-pill ny-act" disabled={remind.isPending} onClick={() => remind.mutate()} aria-label={`${text.action} — ${text.title}`}>
          {remind.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : text.action}
        </button>
      ) : (
        <a className="ny-pill ny-act" href={`tel:${item.phone}`} aria-label={`${text.action} — ${text.title}`}>{text.action}</a>
      )}
    </li>
  );
}

export function NeedsYouCard() {
  const { t } = useLanguage();
  const [all, setAll] = useState(false);
  const { data, isLoading, isError } = useQuery({ queryKey: ["today", "needs-you"], queryFn: todayApi.needsYou, refetchInterval: 120_000 });
  const items = data?.items ?? [];
  const shown = all ? items : items.slice(0, FIRST);

  return (
    <section className="card ny-card" aria-labelledby="needs-you-h" data-testid="needs-you">
      <div className="today-head">
        <h2 id="needs-you-h">{t("today.ny.title")}</h2>
        {items.length > 0 && <span className="ny-count">{items.length}</span>}
      </div>
      {isLoading ? (
        <ListSkeleton rows={3} lead="icon" chip={false} />
      ) : isError ? (
        <p className="today-empty">{t("today.ny.error")}</p>
      ) : items.length === 0 ? (
        <p className="today-empty"><CheckCircle2 aria-hidden="true" /> {t("today.ny.empty")}</p>
      ) : (
        <>
          <ul className="lrows">
            {shown.map((item) => <NeedsYouRow key={item.id} item={item} />)}
          </ul>
          {items.length > FIRST && (
            <button type="button" className="today-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? t("today.showLess") : fill(t("today.showAll"), { n: items.length })}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/* ─── The period's numbers ────────────────────────────────────────────────── */

type Period = "m" | "q" | "y";

/** [from, to) of a period in the browser's own calendar, and where the one before it starts. */
function periodWindow(period: Period, now = new Date()): { from: Date; to: Date; prevFrom: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "m") return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1), prevFrom: new Date(y, m - 1, 1) };
  if (period === "q") {
    const q = Math.floor(m / 3) * 3;
    return { from: new Date(y, q, 1), to: new Date(y, q + 3, 1), prevFrom: new Date(y, q - 3, 1) };
  }
  return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1), prevFrom: new Date(y - 1, 0, 1) };
}

/** Whole dollars in the strip: cents make a four-column number wrap. */
const whole = (cents: number) => formatCadWhole(cents / 100);

function delta(current: number, previous: number, t: T): string | undefined {
  if (previous <= 0) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  return fill(t("today.stats.vsLast"), { pct: `${pct > 0 ? "+" : ""}${pct}%` });
}

export function TodayStats() {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("m");
  // The window is fixed per period for the page's life; midnight on the last day of a month is not worth a re-render.
  const win = useMemo(() => periodWindow(period), [period]);
  const { data, isLoading } = useQuery({
    queryKey: ["today", "stats", period],
    queryFn: () => todayApi.stats(win.from, win.to, win.prevFrom),
    staleTime: 60_000,
  });
  const label = { m: t("today.period.month"), q: t("today.period.quarter"), y: t("today.period.year") };

  const items: StatItem[] = [];
  if (data?.quotes) items.push({ label: t("today.stats.quotes"), value: String(data.quotes.current), sub: delta(data.quotes.current, data.quotes.previous, t) });
  if (data?.won) items.push({ label: t("today.stats.won"), value: String(data.won.current), tone: data.won.current > 0 ? "ok" : undefined, sub: data.won.valueCents > 0 ? whole(data.won.valueCents) : delta(data.won.current, data.won.previous, t) });
  if (data?.outstanding) {
    items.push({
      label: t("today.stats.outstanding"),
      value: whole(data.outstanding.balanceCents),
      tone: data.outstanding.overdueCents > 0 ? "bad" : undefined,
      sub: data.outstanding.overdueCents > 0 ? fill(t("today.stats.overdue"), { amount: whole(data.outstanding.overdueCents) }) : fill(t(data.outstanding.count === 1 ? "today.stats.invoicesOne" : "today.stats.invoicesMany"), { n: data.outstanding.count }),
    });
  }
  if (data?.collected) items.push({ label: t("today.stats.collected"), value: whole(data.collected.currentCents), sub: delta(data.collected.currentCents, data.collected.previousCents, t) });

  return (
    <section className="today-stats" aria-labelledby="today-stats-h">
      <div className="today-head bare">
        <h2 id="today-stats-h">{label[period]}</h2>
        <ActionSheet
          title={t("today.period.choose")}
          trigger={
            <button type="button" className="more-btn plain" aria-label={t("today.period.choose")}>
              <CalendarDays />
            </button>
          }
          actions={(["m", "q", "y"] as const).map((p) => ({ label: label[p], hint: p === period ? t("today.period.current") : undefined, onSelect: () => setPeriod(p) }))}
        />
      </div>
      {isLoading ? <StatStripSkeleton cells={4} /> : items.length > 0 && <StatStrip items={items} label={label[period]} />}
    </section>
  );
}

/* ─── The crew, in one line ───────────────────────────────────────────────── */

export function CrewLine() {
  const { t } = useLanguage();
  const { data } = useQuery({ queryKey: ["crew-today"], queryFn: crewApi.today, refetchInterval: 120_000 });
  if (!data || !data.enabled) return null;
  const now = Date.now();
  const booked = new Set<string>();
  const late = new Set<string>();
  for (const job of data.jobs) {
    for (const c of job.crew) {
      if (!c.workerId) continue;
      booked.add(c.workerId);
      if (!c.clockedInAt && !c.clockedInElsewhere && !c.allDay && new Date(c.startsAt).getTime() <= now) late.add(c.workerId);
    }
  }
  const onSite = new Set(data.clockedIn.map((c) => c.workerId)).size;
  const jobs = data.jobs.filter((j) => j.jobId).length;
  if (booked.size === 0 && onSite === 0) return null;

  const parts = [
    fill(t(onSite === 1 ? "today.crew.onSiteOne" : "today.crew.onSiteMany"), { n: onSite }),
    late.size > 0 ? fill(t(late.size === 1 ? "today.crew.notInOne" : "today.crew.notInMany"), { n: late.size }) : null,
    jobs > 0 ? fill(t(jobs === 1 ? "today.crew.jobsOne" : "today.crew.jobsMany"), { n: jobs }) : null,
  ].filter(Boolean);
  return (
    <section className="card" data-testid="crew-line">
      <Link href="/dashboard/schedule" className="lrow">
        <span className="ny-ic navy" aria-hidden="true"><Users /></span>
        <span className="lrow-main">
          <span className="lrow-title">{t("today.crew.title")}</span>
          <span className={cn("lrow-meta", late.size > 0 && "warn")}>{parts.join(" · ")}</span>
        </span>
        <ChevronRight className="lrow-chev" aria-hidden="true" />
      </Link>
    </section>
  );
}

/* ─── Next up: five things, not a month ──────────────────────────────────── */

const AGENDA_ICON: Record<AgendaKind, LucideIcon> = {
  block: Briefcase,
  milestone: Flag,
  invoice: Receipt,
  followup: Send,
  external: CalendarDays,
  filing: Landmark,
  permit: FileCheck2,
};
const NEXT = 5;
const AHEAD_DAYS = 14;

export function NextUpCard() {
  const { t, lang } = useLanguage();
  const press = usePrefetchOnPress();
  const locale = lang === "fr" ? frCA : enCA;
  // Whole days from the start of today, so the key is stable across renders.
  const from = useMemo(() => startOfDay(new Date()), []);
  const to = useMemo(() => addDays(from, AHEAD_DAYS), [from]);
  const { data, isLoading } = useQuery({
    queryKey: ["agenda", "next", from.toISOString(), lang],
    queryFn: () => calendarApi.agenda(from, to, lang === "fr" ? "fr" : "en"),
    retry: false,
    staleTime: 30_000,
  });

  const next = useMemo(() => {
    const now = Date.now();
    return (data?.entries ?? []).filter((e) => e.state !== "done" && new Date(e.endsAt).getTime() > now).slice(0, NEXT);
  }, [data]);

  if (isLoading) return <CardSkeleton rows={3} list={{ lead: "icon", chip: false }} />;
  if (!data) return null;

  if (!data.scheduleEnabled) {
    return (
      <section className="card">
        <Link href="/dashboard/settings/plan" className="lrow">
          <span className="ny-ic navy" aria-hidden="true"><Lock /></span>
          <span className="lrow-main">
            <span className="lrow-title">{t("today.next.title")}</span>
            <span className="lrow-meta wrap">{t("dashboard.calendar.locked")}</span>
          </span>
        </Link>
      </section>
    );
  }

  const when = (e: AgendaEntryDto) => {
    // All-day entries are calendar days stored as UTC midnights (see CalendarCard): their UTC date is the day.
    const start = e.allDay ? new Date(new Date(e.startsAt).getUTCFullYear(), new Date(e.startsAt).getUTCMonth(), new Date(e.startsAt).getUTCDate()) : new Date(e.startsAt);
    const day = isToday(start) ? t("today.today") : isTomorrow(start) ? t("today.tomorrow") : format(start, "EEE d MMM", { locale });
    return e.allDay ? day : `${day} · ${format(start, "HH:mm")}`;
  };

  return (
    <section className="card" aria-labelledby="next-up-h">
      <div className="today-head">
        <h2 id="next-up-h">{t("today.next.title")}</h2>
        <Link href="/dashboard/schedule" className="cta-link today-link">{t("today.openSchedule")} <ArrowRight className="chev" /></Link>
      </div>
      {next.length === 0 ? (
        <p className="today-empty">{t("today.next.empty")}</p>
      ) : (
        <ul className="lrows">
          {next.map((e) => {
            const Icon = AGENDA_ICON[e.kind];
            const body = (
              <>
                <span className={cn("cal-ic", `cal-${e.kind}`)} aria-hidden="true"><Icon className="h-3.5 w-3.5" /></span>
                <span className="lrow-main">
                  <span className="lrow-title">{e.title}</span>
                  <span className="lrow-meta">{[when(e), e.subtitle].filter(Boolean).join(" · ")}</span>
                </span>
                {e.amountCents != null && e.amountCents > 0 && <span className={cn("lrow-amt", e.state === "overdue" && "late")}>{formatCents(e.amountCents)}</span>}
              </>
            );
            return (
              <li key={e.id}>
                {e.href ? (
                  <Link href={e.href} className="lrow" {...press(e.href)}>{body}</Link>
                ) : e.externalUrl ? (
                  <a href={e.externalUrl} target="_blank" rel="noreferrer noopener" className="lrow">{body}</a>
                ) : (
                  <div className="lrow">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
