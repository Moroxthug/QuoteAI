// COMPONENTS §14 (.search): 44 tall, radius 14, `sunk`, padding 0 14, gap 9; a 17 search glyph
// in `faint`, the input 15, placeholder `faint`.
import { TextInput, View, type TextInputProps } from "react-native";
import { inputText, noOutline, usePlaceholder } from "./Field";
import { Glyph } from "./Icon";
import { useTheme } from "./theme";

export function Search({ label, ...rest }: Omit<TextInputProps, "style" | "placeholderTextColor"> & { label: string }) {
  const { colors } = useTheme();
  const placeholder = usePlaceholder();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44, borderRadius: 14, backgroundColor: colors.sunk, paddingHorizontal: 14, gap: 9 }}>
      <Glyph name="search" size={17} color="faint" />
      <TextInput
        {...rest}
        accessibilityLabel={label}
        accessibilityRole="search"
        returnKeyType="search"
        placeholderTextColor={placeholder}
        style={[inputText(colors, {}), { flexGrow: 1, flexShrink: 1, minWidth: 0, alignSelf: "stretch", paddingVertical: 0, paddingHorizontal: 0 }, noOutline]}
      />
    </View>
  );
}
