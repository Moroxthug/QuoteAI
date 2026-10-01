// The board's .cp-step ("Quote valid for"): a `sunk` well, radius 11, padding 2, with 36 minus /
// plus buttons (radius 9, 14 glyphs at 2.2) around the value in Manrope 13.5/500, 64 wide.
// A button at its limit is disabled at 35 %.
import { View } from "react-native";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Num } from "./Text";
import { useTheme } from "./theme";

type Props = {
  /** The value as shown ("30 days"); all of it is Manrope on the board (.mono). */
  value: string;
  onDec: () => void;
  onInc: () => void;
  decLabel: string;
  incLabel: string;
  canDec?: boolean;
  canInc?: boolean;
};

function Btn({ glyph, label, onPress, enabled }: { glyph: "minus" | "plus"; label: string; onPress: () => void; enabled: boolean }) {
  return (
    <Press onPress={onPress} disabled={!enabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !enabled }}
      hitSlop={4} style={{ width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center", opacity: enabled ? 1 : 0.35 }}>
      <Glyph name={glyph} size={14} weight={2.2} />
    </Press>
  );
}

export function Stepper({ value, onDec, onInc, decLabel, incLabel, canDec = true, canInc = true }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.sunk, borderRadius: 11, padding: 2, flexShrink: 0 }}>
      <Btn glyph="minus" label={decLabel} onPress={onDec} enabled={canDec} />
      <Num size={13.5} weight={500} align="center" accessibilityLiveRegion="polite" style={{ minWidth: 64 }}>{value}</Num>
      <Btn glyph="plus" label={incLabel} onPress={onInc} enabled={canInc} />
    </View>
  );
}
