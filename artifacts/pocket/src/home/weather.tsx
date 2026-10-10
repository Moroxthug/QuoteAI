// Weather on Home (WEATHER.md): one read (GET /api/v1/weather/today) feeds the header line, the Site weather widget (collapsed, and expanded on its full page) and This week's rain days. Never a spinner,
// never blocks Home: while it loads the header is the date alone and the widget a skeleton; offline it shows the last answer as "Updated 9:40 am" (under 6 hours) or says it is unavailable with a retry.
import { useCallback, useMemo, type ReactElement } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { time as clock, type Locale as FmtLocale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { loadWeather } from "@/lib/weatherApi";
import { adviceWords, FRESH_MS, isOld, primaryOf, rainBars, summaryWords, tempText, twoHourSlots, viewOf, weekDays, weekPlan, type Site, type View as WxView, type WeatherToday } from "@/lib/weather";
import { XcActions, XcDivider, XcRow } from "@/ui/Expand";
import { Status } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";
import { Press } from "@/ui/motion";
import { RainBars, SiteBlock, WeatherAttribution, WeatherSkeleton, WeekStrip } from "@/ui/Weather";
import { RAIN_BLUE, WeatherGlyph } from "@/ui/WeatherGlyph";
import { WidgetCard, WidgetFoot } from "@/ui/Widgets";
import type { WidgetEntry } from "./widgets";

export type Wx = { view: WxView; data: WeatherToday | null; primary: Site | null; savedAt: number | null; fromCache: boolean; refetch: () => void; refetching: boolean };

export function useWeather(enabled: boolean): Wx {
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const q = useQuery({ queryKey: ["weather-today", language], queryFn: () => loadWeather(language), enabled, retry: false, staleTime: FRESH_MS });
  // Coming back to Home asks again when the answer is more than 30 minutes old.
  useFocusEffect(useCallback(() => { if (enabled && q.data && isOld(q.data.savedAt, Date.now())) void q.refetch(); }, [enabled, q.data?.savedAt])); // eslint-disable-line react-hooks/exhaustive-deps
  const data = q.data?.data ?? null;
  const view = viewOf({ fetching: q.isPending || (q.isFetching && !data), data, fromCache: q.data?.fromCache ?? false, savedAt: q.data?.savedAt ?? null, now: Date.now() });
  return { view, data, primary: data ? primaryOf(data) : null, savedAt: q.data?.savedAt ?? null, fromCache: q.data?.fromCache ?? false, refetch: () => void q.refetch(), refetching: q.isRefetching };
}

const useLocale = (): Locale => (useTranslation().i18n.language === "fr" ? "fr-CA" : "en-CA");
type Locale = "en-CA" | "fr-CA";
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const todayOf = (s: Site): string => s.hourly[0]?.hour.slice(0, 10) ?? s.daily7[0]?.date ?? "";

/** The header's weather: the temperature and the day in words ("12°, rain after 3 pm") and the drawn condition; null while loading or without data, so the header is the date alone. */
export function useWeatherHeader(wx: Wx): { text: string; condition: import("@/lib/weather").Condition; rainy: boolean } | null {
  const { t } = useTranslation();
  const locale = useLocale();
  if (!wx.primary || (wx.view !== "loaded" && wx.view !== "stale")) return null;
  const w = summaryWords(wx.primary, locale);
  return { text: `${tempText(wx.primary.now.tempC)}, ${t(`wx.${w.key}`, w.vars)}`, condition: wx.primary.now.condition, rainy: /^(rain|snow)/.test(wx.primary.summaryKey) };
}

// ── Site weather ──────────────────────────────────────────────────────────────

export function useSiteWeatherWidget(wx: Wx): WidgetEntry {
  const { t } = useTranslation();
  const locale = useLocale();
  const { scheme } = useTheme();
  const s = wx.primary;
  const state = wx.view;
  const label = t("wx.name");

  let body: ReactElement;
  let right: string | undefined;
  let expanded: ReactElement | null = null;

  if ((state === "loaded" || state === "stale") && s && wx.data) {
    const sum = summaryWords(s, locale);
    const adv = adviceWords(s, locale);
    const summary = t(`wx.${sum.key}`, sum.vars);
    const bars = rainBars(s, todayOf(s));
    right = s.name.split(" — ")[0]!.split(",")[0]!.slice(0, 22);
    body = (
      <>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexShrink: 1 }}>
            <Num size={34} weight={600} tracking={-0.04} leading={1.1}>{tempText(s.now.tempC)}</Num>
            <Text size={13.5} weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>{cap(summary)}</Text>
          </View>
          <WeatherGlyph condition={s.now.condition} size={34} tint={RAIN_BLUE} weight={1.6} rainy={/^(rain|snow)/.test(s.summaryKey)} />
        </View>
        <RainBars bars={bars} label={(b) => t("wx.bar", { hour: b.label, prob: b.prob })} />
        {adv ? <Text size={12.5} color="muted" style={{ marginTop: 8 }}>{t(`wx.${adv.key}`, adv.vars)}</Text> : null}
        {state === "stale" && wx.savedAt ? <Text size={11.5} color="faint" style={{ marginTop: 4 }}>{t("wx.updated", { time: clock(new Date(wx.savedAt), locale as FmtLocale) })}</Text> : null}
      </>
    );
    expanded = (
      <>
        <XcDivider />
        <View style={{ marginTop: 14 }}>
          {wx.data.sites.map((site) => {
            const w = summaryWords(site, locale);
            const a = adviceWords(site, locale);
            return (
              <SiteBlock key={site.siteId} name={site.name} area={site.area} temp={tempText(site.now.tempC)} summary={cap(t(`wx.${w.key}`, w.vars))} slots={twoHourSlots(site, todayOf(site))}
                note={a ? t(`wx.${a.key}`, a.vars) : undefined} crew={site.crewCount > 0 ? t("wx.site.crew", { count: site.crewCount }) : undefined} slotLabel={(x) => t("wx.site.slot", { hour: x.label, temp: x.temp, prob: x.rain })} />
            );
          })}
          {wx.data.attribution ? (
            <WeatherAttribution attribution={wx.data.attribution} legal={wx.data.attribution.name === "Weather" || wx.data.provider === "weatherkit" ? t("wx.attribution.legal") : t("wx.attribution.eccc", { name: wx.data.attribution.name })} dark={scheme === "dark"}
              text={<Text size={11.5} color="muted">{wx.data.provider === "weatherkit" ? " Weather" : wx.data.attribution.name}</Text>} />
          ) : null}
          {state === "stale" && wx.savedAt ? <Text size={11.5} color="faint">{t("wx.updated", { time: clock(new Date(wx.savedAt), locale as FmtLocale) })}</Text> : null}
        </View>
        <XcActions link={t("wx.site.open")} onLink={() => router.push(screenHref("Schedule", t("wx.site.open")))} />
      </>
    );
  } else if (state === "loading") {
    body = <WeatherSkeleton a11y={t("wx.loadingA11y")} />;
  } else {
    body = (
      <View style={{ minHeight: 96, justifyContent: "center", gap: 6, marginTop: 8 }}>
        <Text size={15} weight={500}>{t("wx.unavailable")}</Text>
        <Press onPress={wx.refetch} accessibilityRole="button" accessibilityLabel={t("wx.retry")} style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}>
          <Text size={13.5} weight={500} color="acc-t">{t("wx.retry")}</Text>
        </Press>
      </View>
    );
  }

  return {
    id: "weather", row: "today",
    node: <WidgetCard key="weather" id="weather" label={s && (state === "loaded" || state === "stale") ? t("wx.card", { place: s.name, temp: tempText(s.now.tempC), summary: t(`wx.${summaryWords(s, locale).key}`, summaryWords(s, locale).vars) }) : label} left={label} right={right} openable={!!expanded} expanded={expanded ?? <View />}>{body}</WidgetCard>,
  };
}

// ── This week ─────────────────────────────────────────────────────────────────

export function useWeekWidget(wx: Wx): WidgetEntry | null {
  const { t, i18n } = useTranslation();
  const locale = useLocale();
  const site = wx.primary;
  const days = useMemo(() => (site ? weekDays(site, locale) : []), [site, locale]);
  if (!site || (wx.view !== "loaded" && wx.view !== "stale")) return null;
  const visits = days.reduce((n, d) => n + d.visits, 0);
  const plan = weekPlan(days);
  const fr = i18n.language === "fr";
  const short = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  const long = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  const dateText = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  const foot = [
    plan.rainDays.length ? t("wx.week.rain", { days: plan.rainDays.map(short).join(t("wx.week.and")) }) : t("wx.week.noRain"),
    plan.best ? t("wx.week.fits", { day: fr ? long(plan.best) : short(plan.best) }) : "",
  ].filter(Boolean).join(" ");
  const strip = (
    <WeekStrip days={days} a11y={(d) => t(d.rain ? "wx.week.dayA11y" : "wx.week.dayDry", { date: dateText(d.iso), visits: t("wx.week.visits", { count: d.visits }) })} />
  );
  return {
    id: "week", row: "today",
    node: (
      <WidgetCard key="week" id="week" label={t("wx.week.name")} left={t("wx.week.name")} right={t("wx.week.visits", { count: visits })}
        expanded={
          <>
            <XcDivider />
            {plan.rainDays.length ? <Text size={12.5} color="muted" style={{ marginTop: 12 }}>{t("wx.week.plan")}</Text> : null}
            {days.filter((d) => d.rain).map((d, i) => (
              <XcRow key={d.iso} first={i === 0} title={t("wx.week.row", { date: dateText(d.iso) })}
                sub={t(d.visits > 0 ? "wx.week.rowVisits" : "wx.week.rowNone", { count: d.visits })}
                right={d.visits > 0 ? <Status plain tone="warn" shape="clock">{t("wx.week.visits", { count: d.visits })}</Status> : <Status plain tone="ok" shape="check">{t("wx.week.rowNone")}</Status>} />
            ))}
            <XcActions link={t("wx.week.open")} onLink={() => router.push(screenHref("Schedule", t("wx.week.open")))} />
          </>
        }>
        {strip}
        <WidgetFoot>{foot}</WidgetFoot>
      </WidgetCard>
    ),
  };
}
