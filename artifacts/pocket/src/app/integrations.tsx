// Integrations.dc.html. Connected apps: a search and a category strip, the apps that are connected on top (with their state: Connected, Needs attention, Paused), then the rest as tiles
// (Connect, Coming soon, or the plan that includes it). States: default, first time (nothing connected: three good places to start), view only, loading and can't load.
// Where the server has the app its answer decides (QuickBooks, Wave, Stripe, Google Calendar, Outlook, WhatsApp, Google Business Profile through its Local Services status, HomeStars
// by its review link). Xero, Google Drive and Home Depot Pro have nothing on the server yet and read Coming soon. Connecting needs the provider's sign-in page, so Connect opens
// quoteai.ca (QuickBooks has its own screen here, Jobber is the Imports screen, HomeStars is the review link in Company details). "Missing an app?" opens a mail to support.
import { Fragment, useState } from "react";
import { Redirect, router } from "expo-router";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { APPS, CATS, counts, isOn, requiredPlan, tileOrder, visible, type AppDef, type AppId, type Cat, type State } from "@/lib/integrations";
import { screenHref } from "@/lib/nav";
import { API_ORIGIN } from "@/lib/session";
import { useAppStates } from "@/lib/useAppStates";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Card, Hairline } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { AppTile, FirstCard, FootNote, PageLede, PlanTag, SuggestTile, TileButton, TileGrid } from "@/ui/Integrations";
import { ScrollPage, Section } from "@/ui/Layout";
import { ListRow, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { Status, Tag } from "@/ui/Status";

const STATE_LOOK: Record<Exclude<State, "soon" | "locked">, { tone: "ok" | "bad" | "warn" | "mute"; shape: "check" | "alert" | "pause" | "off" }> = {
  connected: { tone: "ok", shape: "check" }, attention: { tone: "bad", shape: "alert" }, paused: { tone: "warn", shape: "pause" }, none: { tone: "mute", shape: "off" },
};
const SUGGEST: AppId[] = ["qbo", "stripe", "gcal"];

export default function Integrations() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`ig.${k}`, o) as string;
  const { status } = useSession();
  const toast = useToast();
  const { role } = useRole();
  const canEdit = role === "owner" || role === "admin";
  const { apps, loading } = useAppStates();
  const [cat, setCat] = useState<"all" | Cat>("all");
  const [term, setTerm] = useState("");
  const [asked, setAsked] = useState(false);

  if (status === "out") return <Redirect href="/" />;

  const states = Object.fromEntries(APPS.map((a) => [a.id, apps[a.id].state])) as Record<AppId, State>;
  const words = (id: AppId) => `${t(`apps.${id}.name`)} ${t(`apps.${id}.desc`)}`;
  const shown = visible(APPS, cat, term, words);
  const n = counts(states);
  const firstTime = !loading && n.on === 0 && !term.trim();
  const sugOn = firstTime;
  const top = shown.filter((a) => isOn(states[a.id]));
  const topList = sugOn ? APPS.filter((a) => SUGGEST.includes(a.id) && (cat === "all" || a.cat === cat) && states[a.id] !== "locked") : top;
  const rest = tileOrder(shown.filter((a) => !isOn(states[a.id]) && !(sugOn && SUGGEST.includes(a.id))), states);
  const web = () => void Linking.openURL(`${API_ORIGIN}/dashboard/settings/apps`).catch(() => toast({ message: t("toast.failed") }));
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const open = (a: AppDef) => {
    if (a.id === "qbo") router.push(screenHref("Integration", t("apps.qbo.name")));
    else if (a.id === "wa") router.push(screenHref("SetMessaging", t("apps.wa.name")));
    else if (a.id === "jobber") router.push(screenHref("Imports", t("apps.jobber.name")));
    else if (a.id === "hs") router.push(screenHref("SetCompany", t("apps.hs.name")));
    else web();
  };
  const lineOf = (a: AppDef): string => {
    const l = apps[a.id];
    if (sugOn) return t(`apps.${a.id}.sug`);
    if (l.failures) return t("lines.failed", { count: l.failures });
    if (a.id === "stripe" && l.state === "attention") return t("lines.stripe");
    if (a.id === "hs") return t("lines.hs");
    return l.detail || t("lines.on");
  };
  const catName = (id: AppId) => (cat === "all" ? t(`cats.${APPS.find((a) => a.id === id)!.cat}`) : undefined);
  const summary = n.on === 0 ? t("summary.none") : t("summary.on", { count: n.on }) + (n.attention ? t(n.attention === 1 ? "summary.attention" : "summary.attention_other", { count: n.attention }) : "");
  const mailto = `mailto:support@quoteai.ca?subject=${encodeURIComponent(t("suggest.subject"))}`;

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <Section pt={4} px={20}><PageTitle>{t("title")}</PageTitle><PageLede>{summary}</PageLede></Section>
        {!canEdit && !loading ? <Section pt={14} px={16}><Banner tone="info" icon="lock" iconTone="slate" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></Section> : null}
        <Section delay={50} pt={16} px={16}><Search label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={term} onChangeText={setTerm} autoCorrect={false} onClear={term ? () => setTerm("") : undefined} clearLabel={t("clear")} /></Section>
        <Section delay={80} pt={12}>
          <ChipStrip label={t("category")}>
            {CATS.map((c) => <Chip key={c} label={t(`cats.${c}`)} count={c === "all" ? APPS.length : APPS.filter((a) => a.cat === c).length} selected={cat === c} onPress={() => setCat(c)} />)}
          </ChipStrip>
        </Section>

        {loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={220} radius={22} /><Skeleton height={180} radius={22} /></Section>
        ) : (
          <>
            {firstTime ? <Section delay={110} pt={18} px={16}><FirstCard icon={<Icon name="sync" tone="violet" size={36} />} title={t("first.title")} body={t("first.body")} /></Section> : null}
            {topList.length ? (
              <Section delay={130} pt={20} px={16}>
                <SectionHeader title={sugOn ? t("first.start") : t("connected")} link={String(topList.length)} />
                <Card>
                  {topList.map((a, i) => {
                    const s = states[a.id];
                    const look = STATE_LOOK[s === "soon" || s === "locked" ? "none" : s];
                    return (
                      <Fragment key={a.id}>
                        {i ? <Hairline inset={0} /> : null}
                        <ListRow onPress={() => open(a)} accessibilityLabel={`${t(`apps.${a.id}.name`)}, ${lineOf(a)}, ${t(`state.${s === "soon" || s === "locked" ? "none" : s}`)}`}
                          title={t(`apps.${a.id}.name`)} meta={lineOf(a)} leading={<Icon name={a.icon} tone={a.tone as "sage"} size={28} />}
                          trailing={<Status tone={look.tone} shape={look.shape}>{t(`state.${s === "soon" || s === "locked" ? "none" : s}`)}</Status>} trailingRow />
                      </Fragment>
                    );
                  })}
                </Card>
              </Section>
            ) : null}
            {rest.length || !term ? (
              <Section delay={160} pt={22} px={16}>
                <SectionHeader title={cat === "all" ? t("moreApps") : t(`cats.${cat}`)} link={String(rest.length)} />
                <TileGrid>
                  {rest.map((a) => {
                    const s = states[a.id];
                    const need = requiredPlan(a);
                    return (
                      <AppTile key={a.id} icon={<Icon name={a.icon} tone={a.tone as "sage"} size={36} />} category={catName(a.id)} name={t(`apps.${a.id}.name`)} desc={t(`apps.${a.id}.desc`)}
                        foot={s === "soon" ? <Tag>{t("soon")}</Tag> : s === "locked" ? <PlanTag>{t("plan", { plan: t(`plans.${need ?? "monthly_elite"}`) })}</PlanTag> : canEdit ? <TileButton label={t("connect")} onPress={() => open(a)} /> : <Status tone="mute" shape="off" plain>{t("state.none")}</Status>} />
                    );
                  })}
                  {!term && canEdit ? <SuggestTile title={asked ? t("suggest.thanks") : t("suggest.title")} sub={asked ? t("suggest.thanksSub") : t("suggest.sub")} onPress={() => { setAsked(true); void Linking.openURL(mailto); }} /> : null}
                </TileGrid>
              </Section>
            ) : null}
            {!topList.length && !rest.length && term ? <Empty icon="search" iconTone="slate" title={t("empty.title")} body={t("empty.body")} action={t("clear")} actionKind="secondary" onAction={() => setTerm("")} /> : null}
            {rest.some((a) => states[a.id] === "locked") ? <FootNote>{t("planNote")}</FootNote> : null}
            <FootNote faint>{t("trademark")}</FootNote>
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}

