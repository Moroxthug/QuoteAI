// Dunning.dc.html. Subscription payment: what happens when the plan's payment doesn't go through, step by step (a banner on Home, a 7-day grace period, read-only, Free after 21 days,
// fixed at any time), told to the owner or, for everyone else, as what they would see. Nothing is bought here: the buttons open quoteai.ca. Roles: owner, teammate.
// The board's calendar dates belong to one example; the phone does not know of a failed payment (the server doesn't keep one yet), so the steps are counted in days from the failure and
// the card's last digits are left out. "Message Marco" is "Message the owner" and opens the team screen.
import { Redirect, router } from "expo-router";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { Card, Hairline } from "@/ui/Card";
import { Banner } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { ImportLine } from "@/ui/Imports";
import { BannerWithActions, DayWord, DunningHead, Foot, Gap, GraceBody, LineList, MiniHome, Step, Timeline } from "@/ui/Dunning";
import { ScrollPage, Section } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Status } from "@/ui/Status";
import { PLANS_URL } from "@/lib/plan";
import { screenHref } from "@/lib/nav";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { initialsOf } from "@/lib/invites";

export default function Dunning() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`du.${k}`, o) as string;
  const { status, user } = useSession();
  const { isOwner } = useRole();
  if (status === "out") return <Redirect href="/" />;

  const who = isOwner ? "owner" : "member";
  const first = (user?.name ?? "").split(" ")[0] ?? "";
  const open = () => void Linking.openURL(PLANS_URL);
  const act = isOwner ? open : () => router.push(screenHref("Team", t("s1.member.action")));
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SetPlan", t("title"))));
  const works = tr("du.s3.w", { returnObjects: true }) as unknown as string[];
  const paused = tr("du.s3.p", { returnObjects: true }) as unknown as string[];
  const quotes = tr("du.s4.quotes", { returnObjects: true }) as unknown as string[];
  const jobs = tr("du.s4.jobs", { returnObjects: true }) as unknown as string[];
  const sampleRows = (
    <>
      <ImportLine first left={<Icon name="user" tone="rose" size={28} />} title="Tom & Lena Hart" sub="INV-0412 · $2,340" right={<Status tone="bad" shape="alert">{t("s1.late")}</Status>} />
      <ImportLine left={<Icon name="user" tone="violet" size={28} />} title="Priya Nair" sub="Kitchen backsplash" right={<Status tone="acc" shape="q2">{t("s1.viewed")}</Status>} />
    </>
  );

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <Section pt={10} px={20}><DunningHead title={t("title")} intro={t(`intro.${who}`)} /></Section>
        <Timeline>
          <Step dot="bad" title={t("s1.title")} right={<DayWord>{t("s1.day")}</DayWord>} caption={t("s1.cap")}>
            <MiniHome label={t("s1.mini")} greeting={tr("du.greeting", { name: first || initialsOf(user?.name ?? "") })}
              banner={(
                <BannerWithActions banner={<Banner tone="bad" icon="card" iconTone="rose" lead={t(`s1.${who}.lead`)}>{t(`s1.${who}.body`)}</Banner>}
                  actions={(<><Button size="sm" kind="secondary" label={t(`s1.${who}.action`)} onPress={act} /><Button size="sm" kind="ghost" label={t("s1.later")} onPress={() => undefined} /></>)} />
              )} rows={sampleRows} />
          </Step>
          <Step dot="warn-dot" title={t("s2.title")} right={<Status tone="warn" shape="clock">{t("s2.end")}</Status>} caption={t("s2.cap")}>
            <GraceBody title={t(`s2.${who}.lead`)} body={t(`s2.${who}.body`)} meter={t("s2.meter")} from={t("s2.from")} to={t("s2.to")}
              action={<Button size="md" kind="secondary" block label={t(`s1.${who}.action`)} onPress={act} />} />
          </Step>
          <Step dot="warn-dot" title={t("s3.title")} right={<DayWord>{t("s3.day")}</DayWord>} caption={t("s3.cap")}>
            <Banner tone="warn" icon="lock" iconTone="amber" lead={t("s3.lead")}>{t(`s3.${who}`)}</Banner>
            <Gap>
              <Card>
                <LineList heading={t("s3.works")} items={[{ icon: "eye", tone: "sage", text: works[0]! }, { icon: "card", tone: "sage", text: works[1]! }, { icon: "users", tone: "sage", text: works[2]! }, { icon: "export", tone: "sage", text: works[3]! }]} />
                <Hairline inset={0} />
                <LineList off heading={t("s3.paused")} items={paused.map((p) => ({ icon: "lock" as const, tone: "slate" as const, text: p }))} />
              </Card>
            </Gap>
          </Step>
          <Step dot="muted" title={t("s4.title")} right={<DayWord>{t("s4.day")}</DayWord>} caption={t("s4.cap")}>
            <Banner tone="info" icon="tier1" iconTone="sky" lead={t("s4.lead")} link={t("s4.link")} onLink={open}>{t("s4.body")}</Banner>
            <Gap>
              <Card>
                <ImportLine first left={<Icon name="doc" tone="violet" size={28} />} title={quotes[0]!} sub={quotes[1]} right={<Status tone="ok" shape="check">{quotes[2]!}</Status>} />
                <ImportLine left={<Icon name="cone" tone="amber" size={28} />} title={jobs[0]!} sub={jobs[1]} right={<Status tone="mute" shape="dot">{jobs[2]!}</Status>} />
                <ImportLine left={<Icon name="users" tone="azure" size={28} />} title={t("s4.team")} sub={isOwner ? t("s4.teamOwner") : t("s4.teamMember")} right={<Status tone="warn" shape="pause">{t("s4.teamPaused")}</Status>} />
              </Card>
            </Gap>
          </Step>
          <Step dot="ok-dot" last title={t("s5.title")} right={<DayWord>{t("s5.day")}</DayWord>} caption={t("s5.cap")}>
            <Banner tone="ok" icon="check" iconTone="sage" lead={t("s5.lead")}>{t("s5.body")}</Banner>
          </Step>
        </Timeline>
        <Foot>{t("foot")}</Foot>
      </ScrollPage>
    </Screen>
  );
}
