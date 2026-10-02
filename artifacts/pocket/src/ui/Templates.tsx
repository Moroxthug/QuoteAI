// MessageTemplates.dc.html: the list of templates (a radio row each, with the "Default" or "Edited" tag), the composer (subject, the message with its {slots} as chips that can be
// taken out, the dashed chips that add one, and a count), and the preview (an email or a text bubble).
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { board } from "@/theme/board";
import { Card, Hairline } from "./Card";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Tag } from "./Status";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export function TemplateList({ items, selected, onPick, label }: { items: { id: string; name: string; sub: string; tag: string; edited: boolean }[]; selected: string; onPick: (id: string) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Card accessibilityRole="radiogroup" accessibilityLabel={label}>
      {items.map((t, i) => (
        <View key={t.id}>
          {i ? <Hairline inset={0} /> : null}
          <Press onPress={() => onPick(t.id)} accessibilityRole="radio" accessibilityState={{ checked: t.id === selected }} accessibilityLabel={`${t.name}, ${t.sub}, ${t.tag}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44, backgroundColor: t.id === selected ? colors.soft : "transparent" }}>
            <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
              <Text size={14.5} weight={500} numberOfLines={1}>{t.name}</Text>
              <Text size={12.5} color="muted" numberOfLines={1}>{t.sub}</Text>
            </View>
            <Tag accent={t.edited}>{t.tag}</Tag>
          </Press>
        </View>
      ))}
    </Card>
  );
}

/** A slot in a text: the label on `acc-soft`, with a small ✕ when it can be taken out. */
function Slot({ label, onRemove, removeLabel }: { label: string; onRemove?: () => void; removeLabel?: string }) {
  const { colors } = useTheme();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: 8, marginVertical: 1, marginHorizontal: 1, borderRadius: 8, backgroundColor: colors["acc-soft"] }}>
      <Text size={13.5} weight={500} color="acc-soft-t">{label}</Text>
      {onRemove ? <Glyph name="close" size={11} color="acc-soft-t" weight={2.4} /> : null}
    </View>
  );
  return onRemove ? <Press onPress={onRemove} accessibilityRole="button" accessibilityLabel={removeLabel} hitSlop={6}>{body}</Press> : body;
}

export type Piece = { key: string; text?: string; slot?: string; onRemove?: () => void; removeLabel?: string };

/** Words and slots running on, wrapping lines. */
function Run({ pieces, size, leading }: { pieces: Piece[]; size: 15; leading: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
      {pieces.map((p) => (p.slot !== undefined
        ? <Slot key={p.key} label={p.slot} onRemove={p.onRemove} removeLabel={p.removeLabel} />
        : p.text!.split(/(\s+)/).filter(Boolean).map((w, i) => <Text key={`${p.key}-${i}`} size={size} leading={leading}>{w}</Text>)))}
    </View>
  );
}

export function Composer({ subjectLabel, subject, messageLabel, body, insertLabel, adds, onAdd, count, countSub, countWarn }: {
  subjectLabel?: string; subject?: Piece[]; messageLabel: string; body: Piece[]; insertLabel?: string; adds?: { key: string; label: string }[]; onAdd?: (key: string) => void; count: string; countSub: string; countWarn?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Card>
      {subject ? (
        <View style={{ paddingVertical: 12, paddingHorizontal: 16, gap: 3, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Text size={12.5} color="muted">{subjectLabel}</Text>
          <Run pieces={subject} size={15} leading={1.7} />
        </View>
      ) : null}
      <View style={{ paddingVertical: 14, paddingHorizontal: 16, minHeight: 120, gap: 4 }} accessibilityLabel={messageLabel}>
        <Text size={12.5} color="muted" leading={1.3}>{messageLabel}</Text>
        <Run pieces={body} size={15} leading={1.75} />
      </View>
      {adds && onAdd ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 12, gap: 8 }}>
          <Text size={12.5} color="muted" style={{ paddingHorizontal: 16 }}>{insertLabel}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {adds.map((a) => (
              <Press key={a.key} onPress={() => onAdd(a.key)} accessibilityRole="button" accessibilityLabel={a.label}
                style={{ height: 32, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: colors.acc, flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Glyph name="plus" size={12} color="acc-t" weight={2.4} />
                <Text size={12.5} weight={500} color="acc-t">{a.label}</Text>
              </Press>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", gap: 12, backgroundColor: colors.soft }}>
        <Num size={12.5} color="muted">{count}</Num>
        <Text size={12.5} color={countWarn ? "warn" : "muted"} style={{ flexShrink: 1 }} align="right">{countSub}</Text>
      </View>
    </Card>
  );
}

/** The email as the client sees it, or the text bubble (violet; green for WhatsApp) with its time and sender. */
export function MessagePreview({ email, bubble }: { email?: { from: string; subject: string; text: string }; bubble?: { time: string; text: string; from: string; whatsapp: boolean } }): ReactNode {
  const { colors } = useTheme();
  return (
    <Card padded style={{ gap: 8 }}>
      {email ? (
        <View style={{ borderRadius: 16, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
          <View style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 2, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Text size={12.5} color="muted">{email.from}</Text>
            <Text size={14.5} weight={600}>{email.subject}</Text>
          </View>
          <Text size={14.5} leading={1.5} color="t2" style={{ paddingVertical: 12, paddingHorizontal: 14 }}>{email.text}</Text>
        </View>
      ) : null}
      {bubble ? (
        <>
          <Num size={11.5} color="faint" style={{ alignSelf: "center" }}>{bubble.time}</Num>
          <View style={{ alignSelf: "flex-end", maxWidth: "84%", paddingVertical: 10, paddingHorizontal: 13, borderTopLeftRadius: 19, borderTopRightRadius: 19, borderBottomLeftRadius: 19, borderBottomRightRadius: 6, backgroundColor: bubble.whatsapp ? board.waBubble : colors.acc }}>
            <Text size={14.5} leading={1.42} tint={board.white}>{bubble.text}</Text>
          </View>
          <Text size={11.5} color="faint" style={{ alignSelf: "flex-end" }}>{bubble.from}</Text>
        </>
      ) : null}
    </Card>
  );
}
