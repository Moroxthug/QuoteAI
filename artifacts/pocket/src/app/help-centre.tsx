// HelpCentre.dc.html. Help: a search, the popular articles, the topics, six short videos, and four ways to reach us (chat, email, call, report a problem). Opening an article shows it
// (`?slug=`), with "Was this helpful?" and what to read next. States: default, search, no results, offline.
// The articles are the web help centre's (content/helpArticles.ts: eleven, both languages, kept on the phone so they work offline). The board's sample articles are not these:
// the topics, counts and the order follow the real ones. Videos: two have a player (VideoPlayer); the others read Coming soon. Chat opens the web help page (the chat lives there);
// "Chat online" is the server's own answer.
import { useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateWithYear, number as num, type Locale } from "@/lib/format";
import { ARTICLES, categoryName, countsByTopic, findBySlug, popular, related, search, type HelpArticle, type HelpCategory } from "@/lib/help";
import { comingSoonHref, screenHref } from "@/lib/nav";
import { API_ORIGIN } from "@/lib/session";
import { clock, VIDEOS } from "@/lib/videos";

/** Only the videos that exist are listed; the other four appear when they are made (Phase 130). */
const SHOWN_VIDEOS = VIDEOS.filter((v) => v.playable);
import { useSession } from "@/lib/useSession";
import { Card, Hairline } from "@/ui/Card";
import { Banner, Empty, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ArticleBody, ArticleHead, HelpfulCard, Lead, SmallPrint, TitleWithState, TopicGrid, TopicTile, VideoCard, VideoStrip, WideHeader } from "@/ui/Help";
import { Icon, type IconName, type Tone } from "@/ui/Icon";
import { ScrollPage, Section } from "@/ui/Layout";
import { ListRow, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { Status } from "@/ui/Status";

const TOPIC: Record<HelpCategory, { icon: IconName; tone: Tone }> = {
  start: { icon: "spark", tone: "violet" }, quotes: { icon: "doc", tone: "violet" }, contracts: { icon: "pen", tone: "indigo" }, jobs: { icon: "cone", tone: "amber" },
  money: { icon: "receipt", tone: "sage" }, team: { icon: "users", tone: "azure" }, growth: { icon: "link", tone: "indigo" },
};
const SITE = "https://quoteai.ca";

export default function HelpCentre() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`hc.${k}`, o) as string;
  const lang: "en" | "fr" = i18n.language === "fr" ? "fr" : "en";
  const locale: Locale = lang === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const toast = useToast();
  const params = useLocalSearchParams<{ slug?: string; q?: string }>();
  const [term, setTerm] = useState(params.q ?? "");
  const [helpful, setHelpful] = useState<"yes" | "no" | null>(null);
  const online = useQuery({ queryKey: ["support-online"], queryFn: () => api<{ online: boolean }>("/api/support/admin-status"), retry: 0, staleTime: 60_000, enabled: status !== "offline" });
  if (status === "out") return <Redirect href="/" />;

  const offline = status === "offline";
  const chatOn = !offline && !!online.data?.online;
  const article = findBySlug(params.slug);
  const open = (a: HelpArticle) => { setHelpful(null); router.setParams({ slug: a.slug }); };
  const back = () => (article ? router.setParams({ slug: undefined }) : router.canGoBack() ? router.back() : router.replace(screenHref("Menu", t("title"))));
  const url = (path: string) => void Linking.openURL(`${SITE}${path}`).catch(() => toast({ message: t("failed") }));
  const hits = search(ARTICLES, term, lang);
  const searching = term.trim().length > 0;
  const ago = (iso: string) => dateWithYear(new Date(`${iso}T12:00:00`), new Date(), locale);
  const topicOf = (a: HelpArticle) => categoryName(a.category, lang);
  const articleRow = (a: HelpArticle, first: boolean) => (
    <View key={a.slug}>
      {first ? null : <Hairline inset={0} />}
      <ListRow onPress={() => open(a)} title={a.title[lang]} meta={`${topicOf(a)} · ${t("article.read", { count: a.readingTimeMin, date: ago(a.updatedAt) }).split(" · ")[0]}`}
        leading={<Lead><Icon name={TOPIC[a.category].icon} tone={TOPIC[a.category].tone} size={28} /></Lead>} />
    </View>
  );
  const chatPill = <Status tone={chatOn ? "ok" : "mute"} shape={chatOn ? "live" : "off"}>{chatOn ? t("chatOnline") : t("chatOffline")}</Status>;

  if (article) {
    const more = related(article, ARTICLES);
    return (
      <Screen>
        <Header title="" backLabel={t("article.back")} onBack={back} />
        <ScrollPage bottom={56}>
          <Section pt={6} px={20}><ArticleHead title={article.title[lang]} meta={t("article.read", { count: article.readingTimeMin, date: ago(article.updatedAt) })} /></Section>
          <Section delay={40} pt={16} px={16}>
            <ArticleBody blocks={article.blocks} lang={lang} note={(text) => <Banner tone="acc" icon="spark" iconTone="violet" lead={text} />} />
          </Section>
          <Section delay={80} pt={20} px={16}>
            <HelpfulCard state={helpful ?? "ask"} question={t("article.helpful")} yes={t("article.yes")} no={t("article.no")} thanks={t("article.thanks")} sorry={t("article.sorry")} chat={t("article.chat")} missing={t("article.missing")}
              onYes={() => setHelpful("yes")} onNo={() => setHelpful("no")} onChat={() => url("/help")} onMissing={() => router.push(screenHref("Feedback", "", { from: article.title[lang] }))} />
          </Section>
          <Section delay={110} pt={22} px={16}>
            <SectionHeader title={t("article.related")} />
            <Card>{more.map((a, i) => articleRow(a, i === 0))}</Card>
          </Section>
        </ScrollPage>
      </Screen>
    );
  }

  const counts = countsByTopic(ARTICLES);
  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <Section pt={2}><TitleWithState title={t("title")} state={chatPill} /></Section>
        {offline ? <Section pt={14} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body")}</Banner></Section> : null}
        <Section delay={40} pt={16} px={16}><Search label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={term} onChangeText={setTerm} autoCorrect={false} onClear={term ? () => setTerm("") : undefined} clearLabel={t("clear")} /></Section>

        {searching && hits.length ? (
          <Section pt={18} px={16}>
            <SectionHeader title={t("results")} link={t(hits.length === 1 ? "found_one" : "found_other", { count: hits.length })} />
            <Card>{hits.map((a, i) => articleRow(a, i === 0))}</Card>
          </Section>
        ) : null}
        {searching && !hits.length ? (
          <Empty icon="search" iconTone="slate" title={t("none.title", { q: term.trim() })} body={t("none.body")} action={t("none.action")} actionKind="secondary" onAction={() => url("/help")} />
        ) : null}

        {!searching ? (
          <>
            <Section delay={70} pt={22} px={16}>
              <SectionHeader title={t("popular")} />
              <Card>{popular(ARTICLES).map((a, i) => articleRow(a, i === 0))}</Card>
            </Section>
            <Section delay={100} pt={22} px={16}>
              <SectionHeader title={t("topics")} />
              <TopicGrid>
                {counts.map((c) => (
                  <TopicTile key={c.topic} icon={TOPIC[c.topic].icon} tone={TOPIC[c.topic].tone} label={categoryName(c.topic, lang)} count={t(c.n === 1 ? "articles_one" : "articles_other", { count: c.n })}
                    onPress={() => { const first = ARTICLES.find((a) => a.category === c.topic); if (first) open(first); }} />
                ))}
              </TopicGrid>
            </Section>
            <Section delay={130} pt={22}>
              <WideHeader><SectionHeader title={t("videos")} link={t("videoCount", { count: num(SHOWN_VIDEOS.length, locale) })} /></WideHeader>
              <VideoStrip>
                {SHOWN_VIDEOS.map((v) => {
                  const info = tr(`hc.video.${v.id}`, { returnObjects: true }) as unknown as string[];
                  return <VideoCard key={v.id} icon={v.icon} tone={v.tone} title={info[0]!} topic={info[1]!} length={offline ? t("video.offline") : clock(v.secs)} label={t("video.watch", { title: info[0], dur: clock(v.secs) })}
                    onPress={() => (v.playable ? router.push(screenHref("VideoPlayer", "", { video: v.id })) : router.push(comingSoonHref(info[0]!)))} />;
                })}
              </VideoStrip>
            </Section>
          </>
        ) : null}

        <Section delay={160} pt={24} px={16}>
          <SectionHeader title={t("talk.title")} />
          <Card>
            <ListRow onPress={() => url("/help")} title={t("talk.chat.0")} meta={offline ? t("talk.chat.2") : t("talk.chat.1")} leading={<Lead><Icon name="chat" tone="violet" size={28} /></Lead>}
              trailing={<Status tone={chatOn ? "ok" : "mute"} shape={chatOn ? "live" : "off"}>{chatOn ? t("talk.chat.3") : t("talk.chat.4")}</Status>} />
            <Hairline inset={0} />
            <ListRow onPress={() => void Linking.openURL("mailto:support@quoteai.ca")} title={t("talk.email.0")} meta={t("talk.email.1")} leading={<Lead><Icon name="mail" tone="azure" size={28} /></Lead>} />
            <Hairline inset={0} />
            <ListRow onPress={() => void Linking.openURL("tel:18557868324")} title={t("talk.call.0")} meta={t("talk.call.1")} leading={<Lead><Icon name="phone" tone="sage" size={28} /></Lead>} />
            <Hairline inset={0} />
            <ListRow onPress={() => router.push(screenHref("Feedback", "", { from: t("title") }))} title={t("talk.problem.0")} meta={t("talk.problem.1")} leading={<Lead><Icon name="warn" tone="amber" size={28} /></Lead>} />
          </Card>
          <SmallPrint>{t("talk.hours")}</SmallPrint>
        </Section>
      </ScrollPage>
    </Screen>
  );
}

