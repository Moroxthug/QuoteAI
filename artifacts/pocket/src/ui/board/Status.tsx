// Components.dc.html · "Status": the 11 shapes, plain statuses and tags, then each part of the
// app's statuses (quotes, invoices, jobs, contracts, leads, crew and time, permits).
import type { ReactNode } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Status, Tag, type StatusShape, type StatusTone } from "../Status";
import { BoardGroup, BoardPad, BoardSection } from "../sandbox";

type S = readonly [key: string, tone: StatusTone, shape: StatusShape];

const SHAPES: readonly S[] = [
  ["notSent", "mute", "draft"], ["onItsWay", "info", "q1"], ["seen", "acc", "q2"], ["nearly", "warn", "q3"], ["done", "ok", "check"], ["now", "ok", "live"],
  ["waiting", "warn", "clock"], ["paused", "warn", "pause"], ["needsYou", "bad", "alert"], ["stopped", "bad", "x"], ["inactive", "mute", "off"],
];

const GROUPS: readonly (readonly [string, readonly S[]])[] = [
  ["quotes", [["draft", "mute", "draft"], ["sent", "info", "q1"], ["viewed", "acc", "q2"], ["accepted", "ok", "check"], ["declined", "bad", "x"], ["expired", "mute", "off"]]],
  ["invoices", [["draft", "mute", "draft"], ["scheduled", "info", "clock"], ["sent", "info", "q1"], ["viewed", "acc", "q2"], ["awaiting", "warn", "clock"], ["partial", "warn", "q3"], ["paid", "ok", "check"], ["overdue", "bad", "alert"], ["void", "mute", "x"]]],
  ["jobs", [["planning", "info", "q1"], ["active", "ok", "live"], ["hold", "warn", "pause"], ["completed", "mute", "check"]]],
  ["contracts", [["draft", "mute", "draft"], ["sent", "info", "q1"], ["viewed", "acc", "q2"], ["signed", "ok", "check"], ["declined", "bad", "x"], ["voided", "mute", "x"], ["expired", "mute", "off"]]],
  ["leads", [["new", "acc", "dot"], ["contacted", "info", "q1"], ["quoted", "acc", "q2"], ["won", "ok", "check"], ["lost", "bad", "x"], ["unsubscribed", "mute", "off"]]],
  ["crew", [["onSite", "ok", "live"], ["enRoute", "warn", "q1"], ["off", "mute", "off"], ["toApprove", "warn", "clock"], ["approved", "ok", "check"], ["rejected", "bad", "x"]]],
  ["permits", [["needed", "warn", "clock"], ["applied", "info", "q1"], ["issued", "ok", "check"], ["closed", "mute", "check"], ["notRequired", "mute", "off"]]],
];

/** .cp-p.cp-wrap: padding 0 16, wrapping with gap 8. */
function Wrap({ children }: { children: ReactNode }) {
  return <BoardPad><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>{children}</View></BoardPad>;
}

export function StatusSection() {
  const { t } = useTranslation();
  const c = (k: string) => t(`board.status.${k}`);
  return (
    <>
      <BoardSection title={c("title")} />
      <BoardGroup label={c("shapesLabel")} />
      <Wrap>{SHAPES.map(([k, tone, shape]) => <Status key={k} tone={tone} shape={shape}>{c(`shapes.${k}`)}</Status>)}</Wrap>
      <BoardGroup label={c("plainLabel")} />
      <Wrap>
        <Status plain tone="acc" shape="q2">{c("viewedAgo")}</Status>
        <Status plain tone="warn">{c("expiresFri")}</Status>
        <Status plain tone="ok" shape="live">{c("onSite")}</Status>
        <Tag>{c("foreman")}</Tag>
        <Tag accent>{c("admin")}</Tag>
        <Tag>{c("hst")}</Tag>
      </Wrap>
      {GROUPS.map(([g, items]) => (
        <View key={g}>
          <BoardGroup label={c(`groups.${g}.name`)} />
          <Wrap>{items.map(([k, tone, shape]) => <Status key={k} tone={tone} shape={shape}>{c(`groups.${g}.${k}`)}</Status>)}</Wrap>
        </View>
      ))}
    </>
  );
}
