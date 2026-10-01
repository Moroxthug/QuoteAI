// The motion test screen for /sandbox/motion: phase 123.4's motion pieces on one test screen — the header, rise, expandable
// cards (a list that detaches, and a card on its own; one open at a time), the swipe row, the
// sheet and the floating tab bar with the orb. Sample data from the boards' world.
import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { money, type Locale } from "@/lib/format";
import { Avatar } from "../Avatar";
import { Button } from "../Button";
import { Card } from "../Card";
import { RadioRow } from "../Check";
import { ExpandCard, ExpandScrollView, XcActions, XcButton, XcCaption, XcDivider, XcRow } from "../Expand";
import { useToast } from "../Feedback";
import { Header } from "../Header";
import { Rise } from "../motion";
import { RowBody, RowList } from "../Row";
import { Screen } from "../Screen";
import { Sheet } from "../Sheet";
import { Status } from "../Status";
import { SwipeRow } from "../SwipeRow";
import { TAB_BAR_SPACE, TabBar, type TabKey } from "../TabBar";
import { Num, Text } from "../Text";
import { BoardGroup, BoardPad, SandboxSwitches } from "../sandbox";

const QUOTES = [
  { id: "q119", ini: "DW", tint: 1 as const, amount: 4131.05, tone: "acc" as const, shape: "q2" as const },
  { id: "q118", ini: "PN", tint: 2 as const, amount: 1865.1, tone: "info" as const, shape: "q1" as const },
  { id: "q117", ini: "TH", tint: 4 as const, amount: 23040, tone: "ok" as const, shape: "check" as const },
];

export function MotionBoard() {
  const { t, i18n } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`sandbox.motion.${k}`, o);
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const [reminded, setReminded] = useState(false);
  const [tab, setTab] = useState<TabKey>("quotes");
  return (
    <Screen floating={
      <TabBar active={tab} onTab={setTab} label={m("main")} orbLabel={m("orb")} onOrb={() => toast({ message: m("orbSoon") })}
        labels={{ home: m("tabs.home"), quotes: m("tabs.quotes"), jobs: m("tabs.jobs"), clients: m("tabs.clients") }} />
    }>
      <Header title={m("title")} onBack={() => router.back()} backLabel={m("back")} onMore={() => setSheet(true)} moreLabel={m("more")} />
      <ExpandScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}>
        <Rise><SandboxSwitches /></Rise>
        <Rise delay={60}>
          <BoardGroup label={m("list")} />
          <BoardPad>
            <Card style={{ overflow: "visible" }}>
              <RowList>
                {QUOTES.map((q, i) => (
                  <ExpandCard key={q.id} id={q.id} variant="row" list="quotes" label={`${m(`q.${i}.client`)}, ${m(`q.${i}.no`)}`}
                    head={<RowBody leading={<Avatar initials={q.ini} tint={q.tint} />} title={m(`q.${i}.client`)} meta={m(`q.${i}.job`)}
                      trailing={<><Num size={14.5} weight={600}>{money(q.amount, locale)}</Num><Status tone={q.tone} shape={q.shape}>{m(`q.${i}.status`)}</Status></>} />}>
                    <XcDivider />
                    <XcCaption>{m("next")}</XcCaption>
                    <XcRow first title={m("reminder")} sub={m("reminderSub")}
                      right={<XcButton label={reminded ? m("sent") : m("send")} tone={reminded ? "done" : "primary"} onPress={() => setReminded(true)} />} />
                    <XcRow title={m("deposit")} sub={m("depositSub")} right={<Num size={14.5} weight={600}>{money(q.amount / 2, locale)}</Num>} />
                    <XcActions link={m("open")} main={m("call")} onMain={() => toast({ message: m("calling") })} />
                  </ExpandCard>
                ))}
              </RowList>
            </Card>
          </BoardPad>
        </Rise>
        <Rise delay={120}>
          <BoardGroup label={m("single")} />
          <BoardPad>
            <ExpandCard id="glance" label={m("glance")}
              head={<View style={{ gap: 3 }}><Text size={12.5} color="muted">{m("glance")}</Text><Num size={19} weight={600} tracking={-0.03}>{money(15396, locale, { cents: false })}</Num></View>}>
              <XcDivider />
              <XcRow first title={m("q.0.client")} sub={m("q.0.job")} right={<Status plain tone="acc" shape="q2">{m("q.0.status")}</Status>} />
              <XcRow title={m("q.1.client")} sub={m("q.1.job")} right={<Status plain tone="info" shape="q1">{m("q.1.status")}</Status>} />
              <XcActions link={m("openAll")} />
            </ExpandCard>
          </BoardPad>
        </Rise>
        <Rise delay={180}>
          <BoardGroup label={m("swipe")} />
          <BoardPad>
            <SwipeRow open={swiped} onOpenChange={setSwiped} accessibilityLabel={m("q.1.client")}
              actions={[
                { key: "archive", label: t("board.rows.archive"), icon: "box", iconTone: "slate", tone: "mute", onPress: () => { setSwiped(false); toast({ message: t("board.feedback.archived"), action: t("board.feedback.undo") }); } },
                { key: "delete", label: t("board.rows.delete"), icon: "warn", iconTone: "clay", tone: "bad", onPress: () => setSwiped(false) },
              ]}>
              <RowBody leading={<Avatar initials="PN" tint={2} />} title={m("q.1.client")} meta={m("q.1.job")} trailing={<Num size={14.5} weight={600}>{money(1865.1, locale)}</Num>} />
            </SwipeRow>
          </BoardPad>
        </Rise>
        <Rise delay={240}>
          <BoardGroup label={m("sheetLabel")} />
          <BoardPad><Button label={m("openSheet")} kind="secondary" onPress={() => setSheet(true)} block /></BoardPad>
        </Rise>
      </ExpandScrollView>
      <Sheet open={sheet} onClose={() => setSheet(false)} label={m("sheetTitle")} closeLabel={m("close")}>
        <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6 }}>
          <Text size={19} weight={600} tracking={-0.02} accessibilityRole="header">{m("sheetTitle")}</Text>
        </View>
        <View accessibilityRole="radiogroup">
          {[0, 1, 2].map((n) => <RadioRow key={n} selected={pick === n} onPress={() => setPick(n)} title={t(`board.controls.radios.${n}.label`)} sub={t(`board.controls.radios.${n}.sub`)} />)}
        </View>
        <View style={{ padding: 16 }}><Button label={m("done")} onPress={() => setSheet(false)} block /></View>
      </Sheet>
    </Screen>
  );
}
