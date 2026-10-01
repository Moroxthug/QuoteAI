// Home's widgets that run on data the server already has (HOME-WIDGETS-SPEC.md): Collected, Outstanding,
// Quotes, Follow-ups, Today's list, Site weather. Each `use...Widget` returns its card, or null when
// there is nothing to show (a role that can't see the area, a plan without the feature, no data yet),
// and Home puts the cards that exist into their rows. Rows with no cards are not drawn.
import { useMemo, useState, type ReactElement } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListQuotes, type QuoteSummary } from "@workspace/api-client-react";
import { money, monthLong, shortDate, time, type Locale } from "@/lib/format";
import { changePercent, collectedOf, latestClientActivity, outstandingSplit, pipeline, sparkPath, ago } from "@/lib/homeWidgets";
import { homeApi } from "@/lib/homeApi";
import { telHref, type BusinessPeriod, type NeedsYouItem } from "@/lib/home";
import { canRemind, daysLate, daysUntilDue, openByUrgency } from "@/lib/invoices";
import { screenHref } from "@/lib/nav";
import { glance, jobLine, quoteState } from "@/lib/quotes";
import { Checkbox } from "@/ui/Check";
import { XcActions, XcButton, XcCaption, XcDivider, XcRow } from "@/ui/Expand";
import { useToast } from "@/ui/Feedback";
import { Glyph } from "@/ui/Icon";
import { MiniFigures, Progress } from "@/ui/Numbers";
import { Segmented } from "@/ui/Segmented";
import { Status } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";
import { board } from "@/theme/board";
import { AlertPill, BigFigure, Columns, Sparkline, SplitBar, WidgetCard, WidgetFoot } from "@/ui/Widgets";

export type WidgetEntry = { id: string; row: "today" | "money" | "sales" | "field"; node: ReactElement };

const SPARK_W = 306;
const PERIODS: BusinessPeriod[] = ["W", "M", "Q"];

function useLocale(): Locale {
  const { i18n } = useTranslation();
  return i18n.language === "fr" ? "fr-CA" : "en-CA";
}

const dollars = (cents: number, locale: Locale, withCents = false) => money(cents / 100, locale, { cents: withCents });

// ── Collected (money) ──────────────────────────────────────────────────────

export function useCollectedWidget(enabled: boolean): WidgetEntry | null {
  const { t } = useTranslation();
  const locale = useLocale();
  const [period, setPeriod] = useState<BusinessPeriod>("M");
  const card = useQuery({ queryKey: ["home-business", period], queryFn: () => homeApi.business(period), enabled, retry: false, staleTime: 60_000 });
  const month = useQuery({ queryKey: ["home-business", "M"], queryFn: () => homeApi.business("M"), enabled, retry: false, staleTime: 60_000 });
  const now = new Date();
  const d = card.data;
  if (!d || !d.buckets) return null;
  const c = collectedOf(d.buckets);
  const pct = changePercent(c.currentCents, c.previousCents);
  const spark = sparkPath(c.series, SPARK_W, 72, 4);
  const label = period === "M" ? t("widgets.collected.inMonth", { month: monthLong(now, locale) }) : period === "W" ? t("widgets.collected.thisWeek") : t("widgets.collected.thisQuarter");
  const tail = (cents: number) => { const s = dollars(cents, locale, true); const i = s.search(/[.,]\d\d(?: \$)?$/); return i > 0 ? [s.slice(0, i), s.slice(i)] as const : [s, ""] as const; };
  const [whole, cents] = tail(c.currentCents);
  const out = month.data?.outstanding ?? d.outstanding;
  const bucketLabel = (start: string) => {
    const x = new Date(`${start}T12:00:00`);
    return period === "Q" ? t("widgets.collected.quarter", { n: Math.floor(x.getMonth() / 3) + 1 }) : period === "M" ? new Intl.DateTimeFormat(locale, { month: "short" }).format(x) : shortDate(x, locale);
  };
  const first = d.buckets[0], mid = d.buckets[Math.floor(d.buckets.length / 2)], last = d.buckets[d.buckets.length - 1];
  return {
    id: "collected", row: "money",
    node: (
      <WidgetCard key="collected" id="collected" label={t("widgets.collected.name")} left={label}
        right={pct == null ? undefined : t(pct >= 0 ? "widgets.collected.up" : "widgets.collected.down", { pct: Math.abs(pct) })}
        expanded={
          <>
            <XcDivider />
            <View style={{ marginTop: 12 }}>
              <Segmented options={t("widgets.collected.periods", { returnObjects: true }) as unknown as string[]} value={PERIODS.indexOf(period)} onChange={(i) => setPeriod(PERIODS[i]!)} label={t("widgets.collected.periodLabel")} />
            </View>
            {spark ? <Sparkline {...spark} width={SPARK_W} height={120} /> : null}
            <MiniFigures items={[
              { label: t("widgets.collected.won"), value: d.winPercent == null ? "–" : `${d.winPercent}%` },
              { label: t("widgets.collected.outstanding"), value: out ? dollars(out.balanceCents, locale) : "–" },
              { label: t("widgets.collected.margin"), value: d.marginPercent == null ? "–" : `${d.marginPercent}%` },
            ]} />
            <XcActions link={t("widgets.collected.open")} onLink={() => router.push(screenHref("Books", t("menu.rows.books.label")))} />
          </>
        }>
        <BigFigure value={whole} tail={cents} />
        {spark ? <Sparkline {...spark} width={SPARK_W} height={72} /> : null}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          {[first, mid, last].map((b, i) => <Text key={i} size={10.5} color="faint">{bucketLabel(b!.start)}</Text>)}
        </View>
      </WidgetCard>
    ),
  };
}

// ── Outstanding (money) ────────────────────────────────────────────────────

export function useOwedWidget(enabled: boolean): WidgetEntry | null {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();
  const toast = useToast();
  const client = useQueryClient();
  const list = useQuery({ queryKey: ["home-invoices"], queryFn: homeApi.invoices, enabled, retry: false, staleTime: 60_000 });
  const [reminded, setReminded] = useState<Record<string, true>>({});
  const now = useMemo(() => new Date(), [list.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = useMemo(() => openByUrgency(list.data?.items ?? [], now), [list.data, now]);
  if (!list.data) return null;

  const balance = open.reduce((n, i) => n + i.balanceCents, 0);
  const overdueList = open.filter((i) => daysLate(i.dueDate, now) > 0);
  const overdueCents = overdueList.reduce((n, i) => n + i.balanceCents, 0);
  const split = outstandingSplit(balance, overdueCents);
  const worst = overdueList[0];
  const remind = async (id: string) => {
    try { await homeApi.remind(id); setReminded((r) => ({ ...r, [id]: true })); void client.invalidateQueries({ queryKey: ["home-invoices"] }); return true; }
    catch { toast({ message: t("widgets.owed.remindFailed") }); return false; }
  };
  const remindable = overdueList.filter((i) => canRemind(i, now) && !reminded[i.id]);
  const [whole, cents] = (() => { const s = dollars(balance, locale, false); return [s, ""] as const; })();

  return {
    id: "owed", row: "money",
    node: (
      <WidgetCard key="owed" id="owed" label={t("widgets.owed.name")} left={t("widgets.owed.name")} right={t("widgets.owed.count", { count: open.length })}
        expanded={
          <>
            <XcDivider />
            <XcCaption>{t("widgets.owed.unpaid")}</XcCaption>
            {open.slice(0, 5).map((i, n) => {
              const late = daysLate(i.dueDate, now);
              return (
                <XcRow key={i.id} first={n === 0} title={i.clientName ?? i.customer.name ?? i.number}
                  sub={<View style={{ gap: 4 }}><Text size={12.5} color="muted">{`${i.number} · ${late > 0 ? t("widgets.owed.late", { count: late }) : t("widgets.owed.due", { date: shortDate(new Date(i.dueDate), locale) })}`}</Text>{late > 0 ? <Status plain tone="bad" shape="alert">{t("widgets.owed.overdue")}</Status> : null}</View>}
                  right={<><Num size={14.5} weight={600}>{money(i.balanceCents / 100, locale)}</Num>{late > 0 && canRemind(i, now) ? <XcButton label={reminded[i.id] ? t("widgets.owed.reminded") : t("widgets.owed.remind")} tone={reminded[i.id] ? "done" : "primary"} onPress={() => { if (!reminded[i.id]) void remind(i.id); }} /> : null}</>} />
              );
            })}
            <XcActions link={t("widgets.owed.open")} onLink={() => router.push(screenHref("Invoices", t("menu.rows.invoices.label")))}
              main={remindable.length ? t("widgets.owed.remindAll", { count: remindable.length }) : undefined}
              onMain={remindable.length ? () => { remindable.forEach((i) => void remind(i.id)); } : undefined} />
          </>
        }>
        <BigFigure value={whole} tail={cents} />
        <SplitBar parts={[{ share: split.notDueCents, color: colors.inv }, { share: split.overdueCents, color: colors.bad }]} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 7 }}>
          <Text size={11.5} color="muted">{t("widgets.owed.notDue")} <Num size={11.5} weight={500}>{dollars(split.notDueCents, locale)}</Num></Text>
          {split.overdueCents > 0 ? <Text size={11.5} color="bad">{t("widgets.owed.overdue")} <Num size={11.5} weight={500} color="bad">{dollars(split.overdueCents, locale)}</Num></Text> : null}
        </View>
        {worst ? <AlertPill left={t("widgets.owed.worst", { client: worst.clientName ?? worst.customer.name ?? "", number: worst.number })} right={t("widgets.owed.worstRight", { amount: money(worst.balanceCents / 100, locale), days: daysLate(worst.dueDate, now) })} /> : null}
      </WidgetCard>
    ),
  };
}

// ── Quotes (sales) ─────────────────────────────────────────────────────────

export function useQuotesWidget(enabled: boolean): WidgetEntry | null {
  const { t } = useTranslation();
  const locale = useLocale();
  const quotes = useListQuotes({ query: { enabled, retry: false, staleTime: 60_000 } } as never);
  const now = useMemo(() => new Date(), [quotes.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = (quotes.data ?? []) as QuoteSummary[];
  if (!quotes.data || all.length === 0) return null;
  const p = pipeline(all as never, now);
  const rate = glance(all as never, now).winRate;
  const pct = rate == null ? null : Math.round(rate * 100);
  const act = latestClientActivity(all as never);
  const a = act ? ago(act.at, now) : null;
  const agoText = a ? (a.unit === "min" ? t("widgets.quotes.agoMin", { n: a.n }) : a.unit === "h" ? t("widgets.quotes.agoH", { n: a.n }) : t("widgets.quotes.agoD", { count: a.n })) : "";
  const waiting = all.map((q) => ({ q, s: quoteState(q as never, now) })).filter((x) => x.s === "sent" || x.s === "viewed" || x.s === "expiring" || x.s === "draft").slice(0, 5);
  return {
    id: "quotes", row: "sales",
    node: (
      <WidgetCard key="quotes" id="quotes" label={t("widgets.quotes.name")} left={t("widgets.quotes.name")} right={pct == null ? undefined : t("widgets.quotes.won", { pct })}
        expanded={
          <>
            <XcDivider />
            <Columns items={[{ value: String(p.drafts), label: t("widgets.quotes.drafts") }, { value: String(p.sent), label: t("widgets.quotes.sent") }, { value: String(p.viewed), label: t("widgets.quotes.viewed") }, { value: String(p.won), label: t("widgets.quotes.wonCol") }]} />
            <XcCaption>{t("widgets.quotes.waiting")}</XcCaption>
            {waiting.map(({ q, s }, i) => (
              <XcRow key={q.id} first={i === 0} title={q.clientData.nome} sub={jobLine(q)}
                right={<><Num size={14.5} weight={600}>{money(q.totale, locale)}</Num><Status plain tone={s === "viewed" ? "acc" : s === "expiring" ? "warn" : s === "draft" ? "mute" : "info"} shape={s === "viewed" ? "q2" : s === "expiring" ? "clock" : s === "draft" ? "draft" : "q1"}>{t(`quotes.status.${s}`, { day: "" })}</Status></>} />
            ))}
            <XcActions link={t("widgets.quotes.open")} onLink={() => router.push(screenHref("Quotes", t("tabs.quotes")))} />
          </>
        }>
        <Columns items={[{ value: String(p.drafts), label: t("widgets.quotes.drafts") }, { value: String(p.sent), label: t("widgets.quotes.sent") }, { value: String(p.viewed), label: t("widgets.quotes.viewed") }, { value: String(p.won), label: t("widgets.quotes.wonCol") }]} />
        <View style={{ marginTop: 16 }}><Progress value={pct == null ? 0 : pct / 100} /></View>
        <WidgetFoot>{act && a ? t(act.kind === "viewed" ? "widgets.quotes.viewedAgo" : act.kind === "accepted" ? "widgets.quotes.acceptedAgo" : "widgets.quotes.declinedAgo", { client: act.client, ago: agoText }) : t("widgets.quotes.noActivity")}</WidgetFoot>
      </WidgetCard>
    ),
  };
}

// ── Follow-ups (sales) ─────────────────────────────────────────────────────

export function useFollowupsWidget(items: NeedsYouItem[] | undefined): WidgetEntry | null {
  const { t } = useTranslation();
  const locale = useLocale();
  const rows = (items ?? []).filter((i) => i.kind === "followup" || i.kind === "waiting");
  if (rows.length === 0) return null;
  const callOrOpen = (i: NeedsYouItem) => {
    if (i.phone) void Linking.openURL(telHref(i.phone));
    else router.push(screenHref(i.kind === "followup" ? "Leads" : "Quote", t(i.kind === "followup" ? "menu.rows.leads.label" : "quotes.actions.openQuote"), i.kind === "waiting" ? { id: i.id.split(":")[1] ?? "" } : undefined));
  };
  const line = (i: NeedsYouItem) => (i.kind === "waiting" ? t("widgets.followups.waitingFor", { count: i.days ?? 0 }) : i.subtitle);
  return {
    id: "followups", row: "sales",
    node: (
      <WidgetCard key="followups" id="followups" label={t("widgets.followups.name")} left={t("widgets.followups.name")} right={t("widgets.followups.due", { count: rows.length })}
        expanded={
          <>
            <XcDivider />
            <XcCaption>{t("widgets.followups.caption")}</XcCaption>
            {rows.slice(0, 6).map((i, n) => (
              <XcRow key={i.id} first={n === 0} title={i.title} sub={line(i)} right={<XcButton label={i.phone ? t("widgets.followups.call") : t("widgets.followups.openIt")} onPress={() => callOrOpen(i)} />} />
            ))}
            <XcActions link={t("widgets.followups.open")} onLink={() => router.push(screenHref("Leads", t("menu.rows.leads.label")))} />
          </>
        }>
        <View style={{ marginTop: 10, gap: 10 }}>
          {rows.slice(0, 3).map((i) => (
            <View key={i.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text size={13.5} weight={500} numberOfLines={1}>{i.title}</Text>
                <Text size={11.5} color="muted" numberOfLines={1}>{line(i)}</Text>
              </View>
              <Status plain tone={i.kind === "waiting" ? "info" : "acc"} shape={i.kind === "waiting" ? "q1" : "dot"}>{i.at ? shortDate(new Date(i.at), locale) : ""}</Status>
            </View>
          ))}
        </View>
      </WidgetCard>
    ),
  };
}

// ── Today's list (today) ───────────────────────────────────────────────────

export function useTasksWidget(enabled: boolean): WidgetEntry | null {
  const { t } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["home-checklist"], queryFn: homeApi.checklist, enabled, retry: false, staleTime: 30_000 });
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const items = q.data?.items ?? [];
  if (!q.data || items.length === 0) return null;
  const done = (i: { id: string; done: boolean }) => local[i.id] ?? i.done;
  const total = items.length;
  const doneCount = items.filter(done).length;
  const open = items.filter((i) => !done(i));
  const toggle = async (id: string, v: boolean) => {
    setLocal((l) => ({ ...l, [id]: v }));
    try { await homeApi.check(id, v); void client.invalidateQueries({ queryKey: ["home-checklist"] }); }
    catch { setLocal((l) => ({ ...l, [id]: !v })); toast({ message: t("widgets.tasks.failed") }); }
  };
  const textOf = (i: { title: string }) => i.title;
  return {
    id: "tasks", row: "today",
    node: (
      <WidgetCard key="tasks" id="tasks" label={t("widgets.tasks.name")} left={t("widgets.tasks.name")} right={t("widgets.tasks.of", { done: doneCount, total })}
        expanded={
          <>
            <XcDivider />
            <View style={{ marginTop: 10 }}><Progress value={total ? doneCount / total : 0} /></View>
            {items.map((i, n) => (
              <XcRow key={i.id} first={n === 0} title={textOf(i)} sub={i.subtitle || i.jobName || undefined}
                right={<Checkbox round checked={done(i)} onChange={(v) => void toggle(i.id, v)} label={t(done(i) ? "widgets.tasks.unmark" : "widgets.tasks.mark", { text: textOf(i) })} />} />
            ))}
            <XcActions link={t("widgets.tasks.all")} onLink={() => router.push(screenHref("Schedule", t("menu.rows.schedule.label")))} />
          </>
        }>
        <View style={{ marginTop: 12, gap: 9 }}>
          {open.slice(0, 3).map((i) => (
            <View key={i.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={{ width: 16, height: 16, marginTop: 1, borderRadius: 8, boxShadow: "inset 0 0 0 1.5px currentColor", opacity: 0.35 }} />
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text size={13.5} weight={500} numberOfLines={1}>{textOf(i)}</Text>
                {i.subtitle ? <Text size={11.5} color={i.kind === "overdue" || i.kind === "blocker" ? "bad" : "muted"} numberOfLines={1}>{i.subtitle}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      </WidgetCard>
    ),
  };
}

// ── Site weather (today) ───────────────────────────────────────────────────

export function useWeatherWidget(enabled: boolean): WidgetEntry | null {
  const { t, i18n } = useTranslation();
  const locale = useLocale();
  const q = useQuery({ queryKey: ["home-weather"], queryFn: homeApi.weather, enabled, retry: false, staleTime: 15 * 60_000 });
  const w = q.data?.weather;
  if (!w || w.tempC == null) return null;
  const cond = i18n.language === "fr" ? w.condition.fr : w.condition.en;
  const next = w.next ? t(`home.weather.${w.next.kind}`, { time: time(new Date(w.next.at), locale) }) : t("widgets.weather.dry");
  const glyph = w.kind === "clear" ? "sun" : w.next || w.kind === "rain" ? "cloudRain" : "cloud";
  const note = w.next ? t("widgets.weather.note", { time: time(new Date(w.next.at), locale) }) : t("widgets.weather.noteNone");
  return {
    id: "weather", row: "today",
    node: (
      <WidgetCard key="weather" id="weather" label={t("widgets.weather.name")} left={t("widgets.weather.name")} right={w.site}
        expanded={
          <>
            <XcDivider />
            <XcRow first title={w.site} sub={`${Math.round(w.tempC)}° · ${cond}`} right={<Status plain tone={w.next ? "warn" : "ok"} shape={w.next ? "clock" : "check"}>{next}</Status>} />
            <Text size={12.5} color="muted" style={{ marginTop: 6 }}>{note}</Text>
          </>
        }>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Num size={34} weight={600} tracking={-0.04} leading={1.1}>{`${Math.round(w.tempC)}°`}</Num>
            <Text size={13.5} weight={500}>{w.next ? next.charAt(0).toUpperCase() + next.slice(1) : cond}</Text>
          </View>
          <Glyph name={glyph as "sun"} size={34} tint={board.rain} weight={1.6} />
        </View>
        <WidgetFoot>{note}</WidgetFoot>
      </WidgetCard>
    ),
  };
}
