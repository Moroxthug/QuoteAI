// CrewMap's map (CrewMap.dc.html): the abstract street grid (`card` roads on `soft`, `sunk` blocks) with the people who are sharing as 40 avatars (a ring of `card`,
// an `ok` dot, the picked one scaled up with an `ink` ring), and the glass title pill with the live count.
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Avatar } from "./Avatar";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Status } from "./Status";
import { Text } from "./Text";
import { useTheme } from "./theme";

const MAP_W = 390;
const MAP_H = 420;
const BLOCKS: [number, number, number, number][] = [[10, 200, 52, 60], [150, 96, 60, 44], [150, 320, 60, 50], [300, 248, 80, 60]];

export type MapMarker = { id: string; initials: string; tint: 1 | 2 | 3 | 4 | 5; x: number; y: number; label: string };

/** The map area: reports its size so the caller can fit positions to it, and draws the markers it is given. */
export function CrewMapSurface({ markers, selected, onPick, onSize, label }: { markers: MapMarker[]; selected: string | null; onPick: (id: string) => void; onSize: (w: number, h: number) => void; label: string }) {
  const { colors, scheme } = useTheme();
  const road = scheme === "dark" ? colors.line2 : colors.card;
  const [box, setBox] = useState({ w: MAP_W, h: MAP_H });
  return (
    <View accessibilityLabel={label} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.soft, overflow: "hidden" }}
      onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setBox({ w: width, h: height }); onSize(width, height); }}>
      <Svg width={box.w} height={box.h} viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", top: 0, left: 0 }}>
        {BLOCKS.map(([x, y, w, h], i) => <Rect key={i} x={x} y={y} width={w} height={h} rx={6} fill={colors.sunk} opacity={scheme === "dark" ? 0.35 : 0.55} />)}
        <Path d="M0 80h390M0 180h390M0 300h390M40 0v420M130 0v430M230 0v420M340 0v420" stroke={road} strokeWidth={12} fill="none" />
        <Path d="M0 130h390M0 240h390M0 360h390M85 0v420M180 0v420M285 0v420" stroke={road} strokeWidth={5} fill="none" />
        <Path d="M-10 400L390 40" stroke={road} strokeWidth={9} fill="none" />
      </Svg>
      {markers.map((m) => {
        const on = selected === m.id;
        return (
          <Press key={m.id} onPress={() => onPick(m.id)} accessibilityRole="button" accessibilityLabel={m.label} hitSlop={4}
            style={{ position: "absolute", left: m.x - 20, top: m.y - 20, zIndex: on ? 3 : 1, transform: [{ scale: on ? 1.18 : 1 }],
              borderRadius: 24, boxShadow: on ? `0 0 0 3px ${colors.card}, 0 0 0 5px ${colors.ink}` : `0 0 0 3px ${colors.card}` }}>
            <Avatar initials={m.initials} tint={m.tint} size={40} />
            <View style={{ position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors["ok-dot"], borderWidth: 2.5, borderColor: colors.card }} />
          </Press>
        );
      })}
    </View>
  );
}

/** The glass title pill: "Crew map" and the live count. */
export function MapTitle({ title, live, liveWord }: { title: string; live: boolean; liveWord: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.glass, boxShadow: `0 0 0 1px ${colors.ring}` }}>
      <Text size={15} weight={600} tracking={-0.02} accessibilityRole="header">{title}</Text>
      <Status tone={live ? "ok" : "mute"} shape={live ? "live" : "off"}>{liveWord}</Status>
    </View>
  );
}

/** The bottom panel: a `card` surface with 28 top corners, a grab handle (more / less) and whatever is inside. */
export function MapPanel({ height, grabLabel, onGrab, children }: { height: number; grabLabel: string; onGrab: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height, zIndex: 6, backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, boxShadow: `0 -10px 30px -12px ${colors.shadow}, 0 0 0 1px ${colors.ring}`, overflow: "hidden" }}>
      <Press onPress={onGrab} accessibilityRole="button" accessibilityLabel={grabLabel} style={{ height: 24, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 36, height: 5, borderRadius: 5, backgroundColor: colors.line2 }} />
      </Press>
      {children}
    </View>
  );
}

/** Where the title row, the back button and the title pill sit over the map. */
export function MapTop({ children }: { children: ReactNode }) {
  return <View style={{ position: "absolute", left: 16, right: 16, top: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, zIndex: 5 }}>{children}</View>;
}

/** One person in the panel: avatar, name, a status with a line, and call / text buttons (44 round). */
export function MapRow({ name, initials, tint, status, sub, picked, first, onPress, onText, onCall, textLabel, callLabel }: {
  name: string; initials: string; tint: 1 | 2 | 3 | 4 | 5; status: ReactNode; sub: string; picked?: boolean; first?: boolean; onPress?: () => void; onText?: () => void; onCall?: () => void; textLabel: string; callLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={name}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 16, minHeight: 44, backgroundColor: picked ? colors.soft : "transparent", borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <Avatar initials={initials} tint={tint} size={38} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {status}
          <Text size={12.5} color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{sub}</Text>
        </View>
      </View>
      {onText ? <RoundAction glyph="text" label={textLabel} onPress={onText} /> : null}
      {onCall ? <RoundAction glyph="phone" label={callLabel} onPress={onCall} ok /> : null}
    </Press>
  );
}

function RoundAction({ glyph, label, onPress, ok }: { glyph: "text" | "phone"; label: string; onPress: () => void; ok?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ok ? colors["ok-soft"] : colors.sunk, alignItems: "center", justifyContent: "center" }}>
      <Glyph name={glyph} size={19} color={ok ? "ok" : "ink"} weight={1.9} />
    </Press>
  );
}
