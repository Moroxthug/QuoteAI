// Invites.dc.html pieces.
// InviteHero (.iv-hero): the card of a single invitation: padding 20 18 18, company tile + name + role tag,
//   the sentence in 17 `t2` (names in 600 `ink`), a hairline, the ticks, and the "Sent to" line in 12.5 `faint`.
// InviteRow (.iv-row): a row of the "multiple" list: a 28 icon, name + role tag, then Decline / Accept (md) or
//   the answer's status with a 36 tall Undo.
// PickRow (.lrow, min 76): a company tile, name, role tag and a radio.
// AccountRow (.lrow, min 64): the wrong-account card's two rows.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { boldSplit, type Answer } from "@/lib/invites";
import { Button } from "./Button";
import { Card } from "./Card";
import { Hairline } from "./Card";
import { CanList, CompanyTile, PickRadio } from "./Company";
import { Icon } from "./Icon";
import { Press } from "./motion";
import { Status, Tag } from "./Status";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** A sentence whose given words are bold (the board's iv-line: 17 / 400 / −0.02em, bold words 600 in `ink`). */
export function BoldLine({ sentence, bolds }: { sentence: string; bolds: string[] }) {
  return (
    <Text size={17} leading={1.4} tracking={-0.02} color="t2">
      {boldSplit(sentence, bolds).map((p, i) => (p.bold ? <Text key={i} size={17} leading={1.4} tracking={-0.02} weight={600}>{p.text}</Text> : p.text))}
    </Text>
  );
}

export function InviteHero({ company, role, status, sentence, can, sentTo }: {
  company: string; role: string; status?: ReactNode; sentence: string; can: string[]; sentTo?: string;
}) {
  return (
    <Card>
      <View style={{ paddingTop: 20, paddingHorizontal: 18, paddingBottom: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1, minWidth: 0 }}>
            <CompanyTile size={44} />
            <Text size={15} weight={600} numberOfLines={2} style={{ flexShrink: 1 }}>{company}</Text>
          </View>
          <View>{status ?? <Tag>{role}</Tag>}</View>
        </View>
        <View style={{ marginTop: 14 }}><BoldLine sentence={sentence} bolds={[company, role]} /></View>
        {can.length ? (
          <>
            <View style={{ marginTop: 16, marginBottom: 14 }}><Hairline inset={0} /></View>
            <CanList items={can} />
          </>
        ) : null}
        {sentTo ? <View style={{ marginTop: 14 }}><Text size={12.5} color="faint">{sentTo}</Text></View> : null}
      </View>
    </Card>
  );
}

export function InviteRow({ company, role, answer, labels, onAnswer }: {
  company: string; role: string; answer: Answer;
  labels: { decline: string; accept: string; undo: string; declined: string; joined: string };
  onAnswer: (a: Answer) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16 }}>
      <Icon name="building" tone="violet" size={28} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text weight={500} numberOfLines={2} style={{ flexShrink: 1 }}>{company}</Text>
          <View><Tag>{role}</Tag></View>
        </View>
        {answer === "" ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Button kind="secondary" size="md" label={labels.decline} grow onPress={() => onAnswer("no")} />
            <Button size="md" label={labels.accept} grow onPress={() => onAnswer("yes")} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <View>{answer === "yes" ? <Status tone="ok" shape="check">{labels.joined}</Status> : <Status tone="bad" shape="x">{labels.declined}</Status>}</View>
            <Press onPress={() => onAnswer("")} accessibilityRole="button" accessibilityLabel={labels.undo} style={{ height: 36, paddingHorizontal: 4, justifyContent: "center" }} hitSlop={{ top: 4, bottom: 4 }}>
              <Text size={13.5} weight={500} color="muted">{labels.undo}</Text>
            </Press>
          </View>
        )}
      </View>
    </View>
  );
}

export function PickRow({ company, role, on, onPress }: { company: string; role: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityLabel={`${company}, ${role}`} accessibilityState={{ checked: on }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 76, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: pressed ? colors.soft : "transparent" })}>
      <CompanyTile size={44} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}><Text size={15} weight={600} numberOfLines={2}>{company}</Text></View>
      <View><Tag>{role}</Tag></View>
      <PickRadio on={on} />
    </Pressable>
  );
}

export function AccountRow({ leading, title, sub }: { leading: ReactNode; title: string; sub: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 12, paddingHorizontal: 16 }}>
      {leading}
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
      </View>
    </View>
  );
}
