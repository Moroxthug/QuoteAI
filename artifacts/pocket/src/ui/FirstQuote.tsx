// The pieces of FirstQuote.dc.html that the kit doesn't have (.fq-step, .fq-try, .fq-li, .fq-tot,
// .fq-radio, .fq-orb, the job box with its round mic, the header with "Skip for now", the bottom bar).
import type { ReactNode } from "react";
import { TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { board } from "@/theme/board";
import { Card, Hairline } from "./Card";
import { inputText, noOutline, usePlaceholder } from "./Field";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { IconButton } from "./Header";
import { Press } from "./motion";
import { shadow } from "./shadow";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

/** The header (60 tall): back (44) on the left on the check and send steps, "Skip for now" on the right. */
export function FqHeader({ onBack, backLabel, skip, onSkip }: { onBack?: () => void; backLabel: string; skip?: string; onSkip?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 60 + insets.top, paddingTop: 8 + insets.top, paddingLeft: 8, paddingRight: 12 }}>
      {onBack ? <IconButton glyph="back" label={backLabel} onPress={onBack} /> : <View style={{ width: 44 }} />}
      {skip ? (
        <Press onPress={onSkip} accessibilityRole="link" accessibilityLabel={skip} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: "center" }}>
          <Text size={14.5} weight={500} color="muted">{skip}</Text>
        </Press>
      ) : null}
    </View>
  );
}

/** The bar under the scrolling body: the step's one button over a hairline (padding 14 16 34). */
export function FqBottomBar({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 14 + Math.max(insets.bottom, 20), backgroundColor: colors.ground, boxShadow: `0 -1px 0 ${colors.line}` }}>
      {children}
    </View>
  );
}

export type FqStep = { name: string; sub: string; state: "done" | "now" | "later"; sr: string; n: number };

/** The three steps in one card: a 26 dot (number, or a tick when done), the name over a muted line. */
export function FqSteps({ steps, label }: { steps: FqStep[]; label: string }) {
  const { colors } = useTheme();
  return (
    <Card accessibilityRole="list" accessibilityLabel={label}>
      {steps.map((s, i) => (
        <View key={i} accessibilityRole="none" accessible accessibilityLabel={`${s.name}. ${s.sub}. ${s.sr}`}>
          {i > 0 ? <Hairline inset={0} /> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 16, minHeight: 52, opacity: s.state === "later" ? 0.55 : 1 }}>
            <View importantForAccessibility="no-hide-descendants" style={[
              { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", flexShrink: 0 },
              s.state === "now" ? { backgroundColor: colors.inv } : s.state === "done" ? { backgroundColor: colors["ok-dot"] } : { borderWidth: 1.5, borderColor: colors.line2 },
            ]}>
              {s.state === "done" ? <Glyph name="check" size={12} tint={board.white} weight={3.2} /> : <Num size={12.5} weight={600} color={s.state === "now" ? "on-inv" : "muted"}>{String(s.n)}</Num>}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text size={14.5} weight={500} color={s.state === "done" ? "muted" : "ink"}>{s.name}</Text>
              <Text size={12.5} color="muted">{s.sub}</Text>
            </View>
          </View>
        </View>
      ))}
    </Card>
  );
}

/** The job box: a 4-line text area and, under it, the hint and the round 52 mic. */
export function FqJobBox({ value, onChange, label, placeholder, hint, micLabel, onMic, listening }: {
  value: string; onChange: (v: string) => void; label: string; placeholder: string; hint: string; micLabel: string; onMic: () => void; listening?: boolean;
}) {
  const { colors } = useTheme();
  const placeholderColor = usePlaceholder();
  return (
    <Card style={{ paddingTop: 4, paddingHorizontal: 4, paddingBottom: 10 }}>
      <TextInput
        value={value} onChangeText={onChange} multiline accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={placeholderColor}
        textAlignVertical="top" autoCapitalize="sentences"
        style={[inputText(colors, {}), { fontSize: 16, lineHeight: 24, minHeight: 118, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 6 }, noOutline]}
      />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 6, paddingLeft: 14, paddingRight: 8 }}>
        <Text size={12.5} color="muted" style={{ flexShrink: 1 }} accessibilityLiveRegion="polite">{hint}</Text>
        <Press onPress={onMic} accessibilityRole="button" accessibilityLabel={micLabel} accessibilityState={{ busy: !!listening }}
          style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.acc, alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: board.fqMicShadow }}>
          <Glyph name="mic" size={22} tint={board.white} />
        </Press>
      </View>
    </Card>
  );
}

/** "Try: repaint a 12×14 bedroom": a 40 tall violet-tint pill with the brush icon. */
export function FqTry({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingVertical: 8, paddingLeft: 10, paddingRight: 14, borderRadius: 999, backgroundColor: colors["acc-soft"] }}>
      <Icon name="brush" tone="violet" size={22} />
      <Text size={13.5} weight={500} color="acc-soft-t" leading={1.3} style={{ flexShrink: 1 }}>{label}</Text>
    </Press>
  );
}

/** A priced line: the name over a muted line, the amount at the end; hairline between lines. */
export function FqLine({ name, sub, amount, first }: { name: string; sub?: string; amount: string; first?: boolean }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14, paddingVertical: 11 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={14.5}>{name}</Text>
          {sub ? <Text size={12.5} color="muted" style={{ marginTop: 2 }}>{sub}</Text> : null}
        </View>
        <Num size={14.5} weight={400} style={{ flexShrink: 0 }}>{amount}</Num>
      </View>
    </View>
  );
}

/** Subtotal / tax rows (13.5 muted), or the total (15/600 and a 24/600 figure). */
export function FqTotal({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return big ? (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 8 }}>
      <Text size={15} weight={600}>{label}</Text>
      <Num size={24} weight={600} tracking={-0.03}>{value}</Num>
    </View>
  ) : (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <Text size={13.5} color="muted">{label}</Text>
      <Num size={13.5} weight={400} color="muted">{value}</Num>
    </View>
  );
}

/** A thin rule with the card's own spacing between the lines and the totals. */
export function FqRule() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.line, marginTop: 4, marginBottom: 8 }} />;
}

/** One choice in the "Send it to" card: icon, title over a muted line, a 22 radio. */
export function FqChoice({ icon, tone, title, sub, selected, onPress, first }: { icon: IconName; tone: Tone; title: string; sub: string; selected: boolean; onPress: () => void; first?: boolean }) {
  const { colors } = useTheme();
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <Press onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${title}. ${sub}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 66, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Icon name={icon} tone={tone} size={26} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
        </View>
        <View importantForAccessibility="no-hide-descendants" style={{ width: 22, height: 22, borderRadius: 11, borderWidth: selected ? 7 : 1.5, borderColor: selected ? colors.inv : colors.line2, flexShrink: 0 }} />
      </Press>
    </View>
  );
}

/** A row with an icon, a title over a muted line and something at the end (the PDF row, the notification row). */
export function FqInfoRow({ icon, tone, title, sub, minHeight = 60, trailing, wrap }: { icon: IconName; tone: Tone; title: string; sub: string; minHeight?: number; trailing?: ReactNode; wrap?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Icon name={icon} tone={tone} size={26} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={wrap ? undefined : 1}>{title}</Text>
        <Text size={12.5} color="muted" numberOfLines={wrap ? undefined : 1}>{sub}</Text>
      </View>
      {trailing}
    </View>
  );
}

/** The done step's orb: a 76 round card with the sent icon and a soft green glow behind it. */
export function FqOrb({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="image" style={{ width: 76, height: 76, alignItems: "center", justifyContent: "center" }}>
      <View pointerEvents="none" style={{ position: "absolute", top: -26, left: -26, right: -26, bottom: -26 }}>
        <Svg width="100%" height="100%" viewBox="0 0 128 128">
          <Defs>
            <RadialGradient id="fqGlow" cx="64" cy="64" r="64" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={board.fqOrbGlow} stopOpacity={0.45} />
              <Stop offset="1" stopColor={board.fqOrbGlow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={64} cy={64} r={64} fill="url(#fqGlow)" />
        </Svg>
      </View>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", boxShadow: `${shadow("ring", colors)}, 0 18px 36px -18px ${colors.shadow}` }}>
        <Icon name="send" tone="sage" size={40} />
      </View>
    </View>
  );
}

/** The priced quote's card: padding 18 18 14. */
export function FqQuoteCard({ children }: { children: ReactNode }) {
  return <Card style={{ paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 }}>{children}</Card>;
}

/** The quote's title (17/600), its number under it (12.5 muted) and its status at the end. */
export function FqQuoteHead({ title, sub, status }: { title: string; sub?: string; status: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={17} weight={600} tracking={-0.02}>{title}</Text>
        {sub ? <Text size={12.5} color="muted" style={{ marginTop: 3 }}>{sub}</Text> : null}
      </View>
      {status}
    </View>
  );
}

/** "From sign-up to sent": the time as a 32/600 figure at the end. */
export function FqElapsed({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <Card style={{ padding: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text size={13.5} color="muted">{label}</Text>
          <Text size={12.5} color="faint">{sub}</Text>
        </View>
        <Num size={32} weight={600} tracking={-0.045}>{value}</Num>
      </View>
    </Card>
  );
}
