// HelpCentre.dc.html: the topic tiles (a glyph, the topic, "N articles"), the video cards (a 196 wide thumbnail with a play button and the length), the article's body (paragraphs,
// headings, numbered steps, bullets, a note) and the "Was this helpful?" card.
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Button } from "./Button";
import { Card, Hairline } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";
import type { HelpBlock, Lang } from "@/lib/help";

export function TopicGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}

export function TopicTile({ icon, tone, label, count, onPress }: { icon: IconName; tone: Tone; label: string; count: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: "31.5%", flexGrow: 1 }}>
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${count}`}
        style={{ minHeight: 96, borderRadius: 18, backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.ring}`, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 6 }}>
        <Icon name={icon} tone={tone} size={30} />
        <Text size={13.5} weight={500} align="center" numberOfLines={2}>{label}</Text>
        <Text size={11.5} color="muted" align="center" style={{ marginTop: -4 }}>{count}</Text>
      </Press>
    </View>
  );
}

export function VideoStrip({ children }: { children: ReactNode }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>{children}</ScrollView>;
}

/** A video: the thumbnail (the topic's glyph, a round play button, the length), the title and the topic. */
export function VideoCard({ icon, tone, title, topic, length, label, onPress }: { icon: IconName; tone: Tone; title: string; topic: string; length: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 196, gap: 8 }}>
      <View style={{ height: 112, borderRadius: 18, backgroundColor: colors.sunk, boxShadow: `0 0 0 1px ${colors.ring}`, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <Icon name={icon} tone={tone} size={36} />
        <View style={{ position: "absolute", left: 10, bottom: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.glass, boxShadow: `0 0 0 1px ${colors.ring}`, alignItems: "center", justifyContent: "center" }}><Glyph name="play" size={14} /></View>
        <View style={{ position: "absolute", right: 10, bottom: 10, height: 24, paddingHorizontal: 8, borderRadius: 8, backgroundColor: colors.glass, justifyContent: "center" }}><Num size={11.5}>{length}</Num></View>
      </View>
      <View style={{ gap: 2, paddingHorizontal: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={2}>{title}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{topic}</Text>
      </View>
    </Press>
  );
}

/** The article's blocks: p, h, steps (numbered, in a card), bullets and a note. */
export function ArticleBody({ blocks, lang, note }: { blocks: HelpBlock[]; lang: Lang; note: (text: string) => ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 14 }}>
      {blocks.map((b, i) => {
        if (b.type === "p") return <Text key={i} size={14.5} leading={1.55} color="t2">{b.text[lang]}</Text>;
        if (b.type === "h") return <Text key={i} size={17} weight={600} tracking={-0.025} accessibilityRole="header" style={{ marginTop: 6 }}>{b.text[lang]}</Text>;
        if (b.type === "note") return <View key={i}>{note(b.text[lang])}</View>;
        if (b.type === "steps") {
          return (
            <Card key={i}>
              {b.items.map((s, j) => (
                <View key={j}>
                  {j ? <Hairline inset={0} /> : null}
                  <View style={{ flexDirection: "row", gap: 14, paddingVertical: 14, paddingHorizontal: 16 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Num size={13.5} weight={600}>{String(j + 1)}</Num></View>
                    <Text size={14.5} leading={1.5} style={{ flexShrink: 1, paddingTop: 2 }}>{s[lang]}</Text>
                  </View>
                </View>
              ))}
            </Card>
          );
        }
        return (
          <View key={i} style={{ gap: 8 }}>
            {b.items.map((s, j) => (
              <View key={j} style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted, marginTop: 9 }} />
                <Text size={14.5} leading={1.5} color="t2" style={{ flexShrink: 1 }}>{s[lang]}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

/** The article's head: a 24 title and a muted line. */
export function ArticleHead({ title, meta }: { title: string; meta: string }) {
  return (
    <View>
      <Text size={24} weight={600} tracking={-0.035} leading={1.15} accessibilityRole="header">{title}</Text>
      <Text size={12.5} color="muted" style={{ marginTop: 8 }}>{meta}</Text>
    </View>
  );
}

/** The small print under "Talk to us". */
export function SmallPrint({ children }: { children: string }) {
  return <Text size={12.5} color="faint" style={{ marginHorizontal: 4, marginTop: 10 }}>{children}</Text>;
}

/** "Was this helpful?": the question with Yes and No, a thank-you, or an offer of a person. */
export function HelpfulCard({ state, question, yes, no, thanks, sorry, chat, missing, onYes, onNo, onChat, onMissing }: {
  state: "ask" | "yes" | "no"; question: string; yes: string; no: string; thanks: string; sorry: string; chat: string; missing: string;
  onYes: () => void; onNo: () => void; onChat: () => void; onMissing: () => void;
}) {
  return (
    <Card padded>
      {state === "ask" ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Text size={15} weight={600}>{question}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button size="sm" kind="secondary" label={yes} onPress={onYes} />
            <Button size="sm" kind="secondary" label={no} onPress={onNo} />
          </View>
        </View>
      ) : state === "yes" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Icon name="check" tone="sage" size={24} /><Text size={14.5} weight={500}>{thanks}</Text></View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Icon name="chat" tone="violet" size={24} /><Text size={14.5} weight={500}>{sorry}</Text></View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button size="md" block label={chat} onPress={onChat} /></View>
            <View style={{ flex: 1 }}><Button size="md" kind="secondary" block label={missing} onPress={onMissing} /></View>
          </View>
        </View>
      )}
    </Card>
  );
}

/** "Help" with the chat state on the right. */
export function TitleWithState({ title, state }: { title: string; state: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingLeft: 20, paddingRight: 16 }}>
      <Text size={30} weight={600} tracking={-0.045} leading={1.1} accessibilityRole="header">{title}</Text>
      {state}
    </View>
  );
}

/** The section header with the board's 20 side padding (the videos run edge to edge below it). */
export function WideHeader({ children }: { children: ReactNode }) {
  return <View style={{ paddingHorizontal: 20 }}>{children}</View>;
}

/** A glyph in a 28 wide box, so the text beside a row of them lines up. */
export function Lead({ children }: { children: ReactNode }) {
  return <View style={{ width: 28, alignItems: "center" }}>{children}</View>;
}
