// COMPONENTS §15, "Form card" (the screens' .form / .fr / .fl): grouped rows 62 tall inside one
// card, a hairline between them. Each row: a 24 gradient icon, then a 12.5 muted label over a
// 16 input (gap 3), then an optional trailing control. The focused row is tinted `soft`; the
// card's ring turns `bad` on error.
import { forwardRef, useState, type ReactNode } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { tokens } from "@/theme/tokens";
import { board } from "@/theme/board";
import { Hairline } from "./Card";
import { inputText, noOutline, usePlaceholder } from "./Field";
import { Icon, type IconName, type Tone } from "./Icon";
import { shadow } from "./shadow";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function FormCard({ children, error }: { children: ReactNode; error?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: tokens.radius.card, overflow: "hidden", boxShadow: error ? `0 0 0 1.5px ${colors.bad}` : shadow("ring", colors) }}>
      {children}
    </View>
  );
}

export { Hairline as FormDivider };

type RowProps = Omit<TextInputProps, "style" | "placeholderTextColor" | "editable"> & {
  icon: IconName;
  tone: Tone;
  label: string;
  /** A trailing control (the show / hide button); 40 wide. */
  trailing?: ReactNode;
  numeric?: boolean;
  disabled?: boolean;
  first?: boolean;
};

export const FormRow = forwardRef<TextInput, RowProps>(function FormRow({ icon, tone, label, trailing, numeric, disabled, first, onFocus, onBlur, ...rest }, ref) {
  const { colors, scheme } = useTheme();
  const placeholder = usePlaceholder();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, minHeight: 62, paddingVertical: 10, paddingLeft: 16, paddingRight: 14, backgroundColor: focused ? colors.soft : "transparent", opacity: disabled ? 0.5 : 1 }}>
        <Icon name={icon} tone={tone} size={24} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text size={12.5} color="muted" importantForAccessibility="no">{label}</Text>
          <TextInput
            {...rest}
            ref={ref}
            editable={!disabled}
            accessibilityLabel={label}
            placeholderTextColor={scheme === "dark" ? board.placeholderDark : placeholder}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            style={[inputText(colors, { numeric }), { fontSize: 16, height: 24, padding: 0 }, noOutline]}
          />
        </View>
        {trailing}
      </View>
    </View>
  );
});
