// COMPONENTS §14 (.search): 44 tall, radius 14, `sunk`, padding 0 14, gap 9; a 17 search glyph
// in `faint`, the input 15, placeholder `faint`. The Search screen's own box (.sr-top .search) has the `acc` ring
// and, once something is typed, a round 28 clear button.
import { TextInput, View, type TextInputProps } from "react-native";
import { inputText, noOutline, usePlaceholder } from "./Field";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { useTheme } from "./theme";

export function Search({ label, ring, onClear, clearLabel, ...rest }: Omit<TextInputProps, "style" | "placeholderTextColor"> & { label: string; ring?: boolean; onClear?: () => void; clearLabel?: string }) {
  const { colors } = useTheme();
  const placeholder = usePlaceholder();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44, borderRadius: 14, backgroundColor: colors.sunk, paddingHorizontal: 14, gap: 9, boxShadow: ring ? `0 0 0 1.5px ${colors.acc}` : undefined }}>
      <Glyph name="search" size={17} color="faint" />
      <TextInput
        {...rest}
        accessibilityLabel={label}
        accessibilityRole="search"
        returnKeyType="search"
        placeholderTextColor={placeholder}
        style={[inputText(colors, {}), { flexGrow: 1, flexShrink: 1, minWidth: 0, alignSelf: "stretch", paddingVertical: 0, paddingHorizontal: 0 }, noOutline]}
      />
      {onClear && clearLabel ? (
        <Press onPress={onClear} accessibilityRole="button" accessibilityLabel={clearLabel} hitSlop={8}
          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.line2, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Glyph name="close" size={12} weight={2.2} color="t2" />
        </Press>
      ) : null}
    </View>
  );
}
