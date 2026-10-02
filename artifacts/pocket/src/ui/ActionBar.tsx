// COMPONENTS §9, the floating action bar of detail screens: in the tab bar's place (16 from the sides, 26 from
// the bottom), a glass button on the left and one 56 pill primary button. The glass button is a 56 round "more",
// or, where the board draws a word (Quote's "Preview"), a 56 tall pill with it. One primary action per screen.
// The primary turns solid green (`ok-dot`) once its action is done ("Sent to Dana"), as Quote.dc.html draws it.
// Put it in Screen's `floating`; leave ACTION_BAR_SPACE at the bottom of the content.
import type { ReactNode } from "react";
import { useBarVisible } from "@/lib/barStore";
import { View } from "react-native";
import { BlurView } from "expo-blur";
import { board } from "@/theme/board";
import { tokens } from "@/theme/tokens";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { useBlurTarget } from "./Screen";
import { shadow } from "./shadow";
import { useFloatBottom } from "./TabBar";
import { Text } from "./Text";
import { useTheme } from "./theme";

export const ACTION_BAR_SPACE = 120;

export function ActionBar({ label, onPress, moreLabel, onMore, secondary, onSecondary, icon, disabled, busy, done, quiet }: {
  label: string; onPress: () => void; moreLabel: string; onMore?: () => void; /** A word on the glass button instead of "more". */ secondary?: string; onSecondary?: () => void;
  icon?: ReactNode; disabled?: boolean; busy?: boolean; /** The action is finished: the button turns green. */ done?: boolean; /** Nothing to do now ("Waiting for Dana"): `sunk`, muted, no shadow, as Contract.dc.html draws it. */ quiet?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const bottom = useFloatBottom() + (useBarVisible() ? 72 : 0);
  const target = useBlurTarget();
  const word = !!secondary;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: tokens.space.fabBarInset.side, right: tokens.space.fabBarInset.side, bottom, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ height: 56, minWidth: 56, borderRadius: 28, boxShadow: `${shadow("float", colors)}, ${shadow("ring", colors)}` }}>
        <BlurView intensity={40} tint={scheme === "dark" ? "dark" : "light"} blurTarget={target ?? undefined} blurMethod={target ? "dimezisBlurViewSdk31Plus" : "none"}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, overflow: "hidden" }} />
        <Press onPress={word ? onSecondary : onMore} accessibilityRole="button" accessibilityLabel={word ? secondary : moreLabel}
          style={{ flex: 1, minWidth: 56, borderRadius: 28, backgroundColor: colors.glass, alignItems: "center", justifyContent: "center", paddingHorizontal: word ? 20 : 0 }}>
          {word ? <Text size={14.5} weight={500}>{secondary}</Text> : <Glyph name="more" size={20} />}
        </Press>
      </View>
      <Press onPress={onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: !!busy, disabled: !!disabled }}
        style={{ flexGrow: 1, flexShrink: 1, height: 56, borderRadius: 28, backgroundColor: done ? colors["ok-dot"] : quiet ? colors.sunk : colors.inv, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.4 : 1, boxShadow: quiet ? undefined : shadow("float", colors) }}>
        {icon}
        <Text size={15} weight={600} color={done ? undefined : quiet ? "muted" : "on-inv"} tint={done ? board.white : undefined} numberOfLines={1}>{label}</Text>
      </Press>
    </View>
  );
}
