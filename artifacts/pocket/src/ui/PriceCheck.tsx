// Pieces of the Price check screen (PriceCheck.dc.html): the range bar (band around your reference, the reference tick,
// the suggested price and this quote's price), the line card, the suggestion box, the key and the loading cards.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Card } from "./Card";
import { Skeleton } from "./Feedback";
import { Text } from "./Text";
import { useTheme } from "./theme";

type Dot = "warn" | "info" | "ok-dot" | "faint";

export function RangeBar({ you, reference, bandLo, bandHi, suggested, youColor, label }: { you: number; reference: number; bandLo: number; bandHi: number; suggested?: number; youColor: Dot; label: string }) {
  const { colors } = useTheme();
  const pct = (n: number) => `${Math.max(0, Math.min(100, n))}%` as const;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ height: 28, marginTop: 4 }}>
      <View style={{ position: "absolute", left: 0, right: 0, top: 12, height: 4, borderRadius: 4, backgroundColor: colors.sunk }} />
      <View style={{ position: "absolute", left: pct(bandLo), width: `${Math.max(0, Math.min(100, bandHi) - Math.max(0, bandLo))}%`, top: 10, height: 8, borderRadius: 5, backgroundColor: colors["ok-soft"], boxShadow: `inset 0 0 0 1px ${colors["ok-dot"]}` }} />
      <View style={{ position: "absolute", left: pct(reference), top: 6, width: 2, height: 16, borderRadius: 2, marginLeft: -1, backgroundColor: colors.faint }} />
      {suggested != null ? <View style={{ position: "absolute", left: pct(suggested), top: 8, width: 12, height: 12, borderRadius: 6, marginLeft: -6, borderWidth: 2.5, borderColor: colors.acc, backgroundColor: colors.card }} /> : null}
      <View style={{ position: "absolute", left: pct(you), top: 6, width: 16, height: 16, borderRadius: 8, marginLeft: -8, borderWidth: 3, borderColor: colors.card, backgroundColor: colors[youColor], boxShadow: `0 0 0 1px ${colors.line2}` }} />
    </View>
  );
}

export function PriceCard({ name, sub, status, children }: { name: string; sub: ReactNode; status: ReactNode; children?: ReactNode }) {
  return (
    <Card padded style={{ paddingVertical: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flexShrink: 1, gap: 2 }}>
          <Text weight={500} leading={1.3}>{name}</Text>
          {sub}
        </View>
        {status}
      </View>
      {children}
    </Card>
  );
}

export function Reason({ children }: { children: string }) {
  return <Text size={13.5} color="t2" leading={1.45} style={{ marginTop: 10 }}>{children}</Text>;
}

export function SuggestBox({ children, action }: { children: ReactNode; action: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: colors.soft, boxShadow: `0 0 0 1px ${colors.line}`, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>{children}</View>
      {action}
    </View>
  );
}

export function KeyRow({ items }: { items: { node: ReactNode; label: string }[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6, paddingHorizontal: 20 }}>
      {items.map((i) => <View key={i.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>{i.node}<Text size={12.5} color="muted">{i.label}</Text></View>)}
    </View>
  );
}

export function KeySwatch({ kind }: { kind: "band" | "reference" | "you" | "suggested" }) {
  const { colors } = useTheme();
  if (kind === "band") return <View style={{ width: 14, height: 8, borderRadius: 4, backgroundColor: colors["ok-soft"], boxShadow: `inset 0 0 0 1px ${colors["ok-dot"]}` }} />;
  if (kind === "reference") return <View style={{ width: 2, height: 12, borderRadius: 2, backgroundColor: colors.faint }} />;
  if (kind === "you") return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink }} />;
  return <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: colors.acc }} />;
}

export function LoadingCards() {
  return (
    <View style={{ gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <Card key={i} padded style={{ gap: 10 }}><Skeleton height={14} width="55%" /><Skeleton height={i ? 8 : 28} width={i ? "100%" : "60%"} /><Skeleton height={12} width="45%" /></Card>
      ))}
    </View>
  );
}

export function Footnote({ children }: { children: string }) {
  return <Text size={12.5} color="muted" leading={1.45} style={{ marginHorizontal: 4 }}>{children}</Text>;
}
