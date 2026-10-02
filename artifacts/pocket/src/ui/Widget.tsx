// SetWidget.dc.html: the preview of the form as it looks on the contractor's site (a browser frame with the address, the form in the chosen colour on a white or dark page), and the
// card with the code to paste, Copy code and "Email to web person".
import { View } from "react-native";
import { board } from "@/theme/board";
import { Button } from "./Button";
import { Card } from "./Card";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export function WidgetPreview({ address, initials, colour, dark, title, lede, kinds, fields, button }: {
  address: string; initials: string; colour: string; dark: boolean; title: string; lede: string; kinds: string[]; fields: string[]; button: string;
}) {
  const { colors } = useTheme();
  const s = dark ? board.widgetSurface.dark : board.widgetSurface.light;
  return (
    <Card style={{ padding: 12, backgroundColor: colors.sunk, boxShadow: "none" }} accessibilityLabel={title} accessible>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 2, paddingHorizontal: 4, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 5 }}>{[0, 1, 2].map((i) => <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line2 }} />)}</View>
        <View style={{ flexGrow: 1, flexShrink: 1, height: 24, borderRadius: 8, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
          <Text size={11.5} color="muted" numberOfLines={1}>{address}</Text>
        </View>
      </View>
      <View style={{ borderRadius: 18, padding: 16, gap: 10, backgroundColor: s.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: colour }}><Text size={10.5} weight={600} tint={board.white} allowFontScaling={false}>{initials}</Text></View>
          <Text size={16} weight={600} tracking={-0.02} tint={s.fg}>{title}</Text>
        </View>
        <Text size={12.5} leading={1.4} tint={s.fg} style={{ opacity: 0.7 }}>{lede}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {kinds.map((k, i) => (
            <View key={k} style={{ height: 28, paddingHorizontal: 10, borderRadius: 999, justifyContent: "center", backgroundColor: i === kinds.length - 1 ? colour : s.chip }}>
              <Text size={12.5} weight={500} tint={i === kinds.length - 1 ? board.white : s.chipFg}>{k}</Text>
            </View>
          ))}
        </View>
        {fields.map((f) => <View key={f} style={{ height: 36, borderRadius: 10, justifyContent: "center", paddingHorizontal: 12, backgroundColor: s.input }}><Text size={12.5} tint={s.inputFg}>{f}</Text></View>)}
        <View style={{ height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colour }}><Text size={13.5} weight={600} tint={board.white}>{button}</Text></View>
      </View>
    </Card>
  );
}

/** The code in a `sunk` box with the two buttons under it (inside a settings card, so it has no card of its own). */
export function CodeBlock({ code, copy, mail, onCopy, onMail }: { code: string; copy: string; mail: string; onCopy: () => void; onMail: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: 14, paddingHorizontal: 16 }}>
      <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.sunk }}>
        <Num size={12.5} weight={500} color="t2" leading={1.5} selectable>{code}</Num>
      </View>
      <View style={{ flexDirection: "row", gap: 8, paddingTop: 12, paddingBottom: 14 }}>
        <View style={{ flex: 1 }}><Button kind="primary" size="md" block label={copy} onPress={onCopy} /></View>
        <View style={{ flex: 1 }}><Button kind="secondary" size="md" block label={mail} onPress={onMail} /></View>
      </View>
    </View>
  );
}
