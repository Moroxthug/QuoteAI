// SmartHome.dc.html: the greeting and weather, the AI quote bar, Needs you, the widget rows, Edit Home.
// This is the app's Home tab. The widget rows are built in the next step (125.3b).
import { useEffect, useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getListQuotesQueryKey, useListClients, type Client } from "@workspace/api-client-react";
import { firstQuoteApi, type FullQuote } from "@/lib/firstQuoteApi";
import { headerDate, money, shortDate, time, type Locale } from "@/lib/format";
import { greetingFor, needsCard, telHref, type NeedsCard, type NeedsYouItem, type TodayWeather } from "@/lib/home";
import { homeApi } from "@/lib/homeApi";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { previewLines, taxName } from "@/lib/quoteBar";
import { useSession } from "@/lib/useSession";
import { checkWhatsNew } from "@/lib/whatsNewSync";
import { useCollectedWidget, useFollowupsWidget, useOwedWidget, useQuotesWidget, useTasksWidget, useWeatherWidget, type WidgetEntry } from "@/home/widgets";
import { cardView } from "@/home/needsCards";
import { RoleSections } from "@/home/RoleSections";
import { useJobRole } from "@/lib/useJobRole";
import { WidgetRow } from "@/ui/Widgets";
import { useToast } from "@/ui/Feedback";
import { HomeHeader, QuickAddGrid, type QuickTile } from "@/ui/Home";
import type { GlyphName } from "@/ui/Icon";
import { Section, TapAway } from "@/ui/Layout";
import { ExpandScrollView } from "@/ui/Expand";
import { NeedsYou, type NeedsCardData } from "@/ui/NeedsYou";
import { QuoteBar, type BarInput, type Built, type ClientOpt } from "@/ui/QuoteBar";
import { Button } from "@/ui/Button";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { TAB_BAR_SPACE } from "@/ui/TabBar";
import { TabScreen } from "@/ui/TabShell";

const WEATHER_GLYPH: Record<TodayWeather["kind"], GlyphName> = { clear: "sun", cloud: "cloud", rain: "cloudRain", snow: "cloudRain", storm: "cloudRain", fog: "cloud" };

export default function SmartHome() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status, user } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";
  const [barOpen, setBarOpen] = useState(false);
  const [text, setText] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  // After an update the "What's new" sheet opens once over Home (never on a first install).
  useEffect(() => { if (status === "in") void checkWhatsNew().then((show) => { if (show) router.push(screenHref("WhatsNew", "")); }); }, [status]);

  const needs = useQuery({ queryKey: ["home-needs"], queryFn: homeApi.needsYou, enabled: signedIn, retry: 1, refetchInterval: 120_000 });
  const weather = useQuery({ queryKey: ["home-weather"], queryFn: homeApi.weather, enabled: signedIn, retry: false, staleTime: 15 * 60_000 });
  const profile = useQuery({ queryKey: ["home-profile"], queryFn: async () => { const r = await firstQuoteApi.profile(); return r.ok ? r.data : null; }, enabled: signedIn, retry: false, staleTime: 10 * 60_000 });
  const clients = useListClients({ query: { queryKey: ["/api/clients"], enabled: signedIn, retry: false } } as never);
  const unread = useQuery({ queryKey: ["home-unread"], queryFn: homeApi.unread, enabled: signedIn, retry: false, staleTime: 60_000 });

  const jr = useJobRole();
  const roleHome = jr.me.included && (jr.role !== "owner" || !!jr.prefs);
  const now = useMemo(() => new Date(), []);
  const first = user?.name.trim().split(/\s+/)[0] ?? "";
  const w = weather.data?.weather ?? null;

  const clientOpts: ClientOpt[] = useMemo(() => {
    const list = ((clients.data ?? []) as Client[]).slice().sort((a, b) => +new Date(b.lastQuoteDate) - +new Date(a.lastQuoteDate));
    return list.map((c) => ({
      id: c.id, name: c.clientName, sub: [c.indirizzo, c.city].filter(Boolean).join(", "),
      data: Object.fromEntries(Object.entries({ nome: c.clientName, indirizzo: c.indirizzo ?? "", email: c.email ?? "", phone: c.phone ?? "", city: c.city ?? "", province: c.province ?? "", postalCode: c.postalCode ?? "" }).filter(([, v]) => v)) as Record<string, string>,
    }));
  }, [clients.data]);

  const tasksW = useTasksWidget(signedIn);
  const weatherW = useWeatherWidget(signedIn);
  const collectedW = useCollectedWidget(signedIn);
  const owedW = useOwedWidget(signedIn);
  const followW = useFollowupsWidget(needs.data?.items);
  const quotesW = useQuotesWidget(signedIn);
  const widgetRows = (["today", "money", "sales", "field"] as const).map((row) => ({ row, items: ([tasksW, weatherW, collectedW, owedW, followW, quotesW].filter(Boolean) as WidgetEntry[]).filter((w) => w.row === row) })).filter((r) => r.items.length > 0);

  if (status === "out") return <Redirect href="/" />;

  const weatherLine = w
    ? [w.tempC != null ? `${Math.round(w.tempC)}°` : "", w.next ? t(`home.weather.${w.next.kind}`, { time: time(new Date(w.next.at), locale) }) : (i18n.language === "fr" ? w.condition.fr : w.condition.en)].filter(Boolean).join(", ")
    : undefined;

  const build = async (input: BarInput): Promise<{ ok: true; quote: Built } | { ok: false; problem: "offline" | "quota" | "cannot" | "unlock" | "failed" }> => {
    const clientData = input.client ? { nome: input.client.name, indirizzo: "", ...input.client.data } : undefined;
    const r = await firstQuoteApi.create(input.text, profile.data ?? null, { clientData, budget: input.budget });
    if (!r.ok) return { ok: false, problem: r.problem };
    void client.invalidateQueries({ queryKey: getListQuotesQueryKey() });
    const q = r.data as FullQuote & { capitoli?: { titolo: string; subtotale: number }[] };
    return { ok: true, quote: { id: q.id, number: q.numeroPreventivoData ?? undefined, client: input.client?.name ?? "", lines: previewLines(q as never), total: q.totale ?? 0 } };
  };

  const cards: NeedsCardData[] = (needs.data?.items ?? []).map(needsCard).map((c) => cardView(c, t, locale, toast, () => void needs.refetch()));

  const tiles: QuickTile[] = [
    { key: "receipt", icon: "receipt", tone: "amber" }, { key: "photo", icon: "camera", tone: "lilac" }, { key: "clockIn", icon: "clock", tone: "sage" },
    { key: "payment", icon: "bank", tone: "gold" }, { key: "lead", icon: "funnel", tone: "clay" }, { key: "note", icon: "mic", tone: "violet" },
  ].map((x) => ({
    ...x, tone: x.tone as QuickTile["tone"], icon: x.icon as QuickTile["icon"], label: t(`home.quickTiles.${x.key}.label`), sub: t(`home.quickTiles.${x.key}.sub`),
    onPress: () => { setQuickOpen(false); router.push(screenHref(x.key === "lead" ? "Leads" : x.key === "clockIn" ? "CrewHours" : x.key === "payment" ? "Invoices" : "Documents", t(`home.quickTiles.${x.key}.label`))); },
  }));

  return (
    <TabScreen active="home">
      <ExpandScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Section>
          <HomeHeader date={headerDate(now, locale)} weather={weatherLine} weatherGlyph={w ? WEATHER_GLYPH[w.kind] : undefined}
            greeting={first ? t(`home.greeting.${greetingFor(now)}`, { name: first }) : t(`home.greetingNoName.${greetingFor(now)}`)}
            quickLabel={t("home.quickAdd")} onQuick={() => setQuickOpen(true)} menuLabel={t("home.openMenu")} onMenu={() => router.push(screenHref("Menu", t("home.openMenu")))}
            initials={user ? initialsOf(user.name) : ""} unread={(unread.data?.unread ?? 0) > 0} unreadLabel={t("home.notifications")} />
        </Section>
        <Section delay={70} pt={18} px={16}>
          <QuoteBar open={barOpen} onOpenChange={setBarOpen} clients={clientOpts} locale={locale} text={text} onText={setText} onBuild={build}
            onReview={(id) => { setBarOpen(false); setText(""); router.push(screenHref("Quote", t("quotes.actions.openQuote"), { id })); }}
            defaultTax={taxName(profile.data?.province) ?? undefined} />
        </Section>
        <View style={{ opacity: barOpen ? 0.3 : 1 }}>
          {roleHome ? (
            <RoleSections sections={jr.sections} entries={[tasksW, weatherW, collectedW, owedW, followW, quotesW].filter(Boolean) as WidgetEntry[]} needs={<NeedsYou cards={needs.isPending && !needs.data ? [] : cards} title={t("home.needs.title")} hint={t("home.needs.hint")} hintDone={t("home.needs.hintDone")} emptyTitle={t("home.needs.allClear")} emptyBody={t("home.needs.allClearBody")} />} />
          ) : (
            <>
          <Section delay={110}>
            <NeedsYou cards={needs.isPending && !needs.data ? [] : cards} title={t("home.needs.title")} hint={t("home.needs.hint")} hintDone={t("home.needs.hintDone")} emptyTitle={t("home.needs.allClear")} emptyBody={t("home.needs.allClearBody")} />
          </Section>
          {widgetRows.map((r, i) => (
            <Section key={r.row} delay={140 + i * 70}>
              <WidgetRow title={t(`widgets.rows.${r.row}`)} ids={r.items.map((w) => w.id)}>{r.items.map((w) => w.node)}</WidgetRow>
            </Section>
          ))}
            </>
          )}
          <Section delay={360} pt={22} row justify="center">
            <Button kind="secondary" size="sm" label={t("home.edit")} onPress={() => router.push(screenHref("CustomizeHome", t("home.edit")))} />
          </Section>
          {barOpen ? <TapAway label={t("home.bar.collapse")} onPress={() => setBarOpen(false)} /> : null}
        </View>
      </ExpandScrollView>
      <Sheet open={quickOpen} onClose={() => setQuickOpen(false)} label={t("home.quickAdd")} closeLabel={t("close")}>
        <SheetTitle>{t("home.quickAdd")}</SheetTitle>
        <QuickAddGrid tiles={tiles} />
      </Sheet>
    </TabScreen>
  );
}

export type { NeedsYouItem };
