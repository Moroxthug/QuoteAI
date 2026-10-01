// Components.dc.html · "Feedback": the five banners, the empty and error states, loading
// skeletons (stat strip, list, card) and the toast with Undo.
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { money, sentence, time, type Locale } from "@/lib/format";
import { Card } from "../Card";
import { Banner, Empty, Skeleton, Toast } from "../Feedback";
import { RowList } from "../Row";
import { BoardGroup, BoardPad, BoardSection } from "../sandbox";

const LIST = [["55%", "75%"], ["42%", "66%"], ["60%", "50%"]] as const;

export function FeedbackSection() {
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`board.feedback.${k}`, o);
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const [undone, setUndone] = useState(false);
  return (
    <>
      <BoardSection title={c("title")} />
      <BoardGroup label={c("banners")} />
      <BoardPad style={{ gap: 10 }}>
        <Banner tone="info" icon="eye" iconTone="sky" lead={c("viewed")}>{sentence(c("viewedMore", { time: time(new Date(2026, 8, 29, 9, 12), locale) }))}</Banner>
        <Banner tone="warn" icon="cloud" iconTone="amber" lead={c("offline")}>{c("offlineMore")}</Banner>
        <Banner tone="ok" icon="check" iconTone="sage" lead={c("deposit")}>{c("depositMore", { amount: money(11520, locale) })}</Banner>
        <Banner tone="bad" icon="warn" iconTone="clay" lead={c("overdue", { count: 9 })}>{c("overdueMore")}</Banner>
        <Banner tone="acc" icon="star" iconTone="violet" lead={c("drafted", { count: 12 })}>{c("draftedMore")}</Banner>
      </BoardPad>
      <BoardGroup label={c("empty")} />
      <BoardPad>
        <Card><Empty icon="doc" title={c("noQuotes")} body={c("noQuotesBody")} action={c("newQuote")} onAction={() => {}} link={c("watch")} onLink={() => {}} /></Card>
      </BoardPad>
      <BoardGroup label={c("error")} />
      <BoardPad>
        <Card><Empty icon="cloud" iconTone="slate" title={c("didntLoad")} body={c("didntLoadBody")} action={c("retry")} actionKind="secondary" onAction={() => {}} padding={{ v: 28, h: 24 }} /></Card>
      </BoardPad>
      <BoardGroup label={c("loading")} />
      <BoardPad style={{ gap: 10 }}>
        <Card style={{ flexDirection: "row", gap: 14, padding: 16 }}>
          {["85%", "85%", "70%"].map((w, i) => (
            <View key={i} style={{ flex: 1, gap: 8 }}><Skeleton width="60%" height={9} /><Skeleton width={w as `${number}%`} height={16} /></View>
          ))}
        </Card>
        <Card>
          <RowList>
            {LIST.map(([a, b], i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
                <Skeleton width={38} height={38} radius={19} />
                <View style={{ flex: 1, gap: 8 }}><Skeleton width={a} height={11} /><Skeleton width={b} height={9} /></View>
                <Skeleton width={64} height={12} />
              </View>
            ))}
          </RowList>
        </Card>
        <Card style={{ padding: 18, gap: 10 }}>
          <Skeleton width="40%" height={10} />
          <Skeleton width="55%" height={26} />
          <Skeleton height={80} radius={12} />
        </Card>
      </BoardPad>
      <BoardGroup label={c("toast")} />
      <BoardPad>
        <Toast message={undone ? c("restored") : c("archived")} action={undone ? c("again") : c("undo")} onAction={() => setUndone((u) => !u)} />
      </BoardPad>
    </>
  );
}
