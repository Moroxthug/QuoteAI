// COMPONENTS §15 and the Inputs section of Components.dc.html.
// Field: a 12.5 muted label (padding-left 2) over the control, gap 6; an error line under it
// (12.5 `bad`, 14 alert glyph, gap 6).
// TextField: 46 tall, radius 13, `card`, a 1 px `line2` ring, 15 text, padding 0 14. Focus: a
// 1.5 `acc` ring; error: a 1.5 `bad` ring; disabled 50 %. Multi-line: padding 12×14, 1.45 leading.
// AffixField (.cp-aff): 48 tall, radius 13, gap 8, a 14.5 muted prefix and/or suffix.
// SelectField (.cp-sel): a 48 button, the value 15 (or Manrope 14.5/500 for dates and times),
// an optional 16 chevron in `faint`.
// CodeField (.cp-code): one box per digit, 52 tall, radius 13, Manrope 21/600, gap 6, an 8×2
// `line2` dash after the first half; the next box to fill gets a 1.5 `acc` ring and a 4 `acc-soft` halo.
// Inputs that hold numbers (amounts, quantities, codes, phone numbers) are Manrope throughout.
import { useRef, useState, type ReactNode } from "react";
import { Platform, TextInput, View, type TextInputProps, type TextStyle } from "react-native";
import { board } from "@/theme/board";
import { geist, manrope, type Weight } from "./fonts";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme, type Colors } from "./theme";

/** Placeholders: `faint`, or the board's night value. */
export function usePlaceholder(): string {
  const { scheme, colors } = useTheme();
  return scheme === "dark" ? board.placeholderDark : colors.faint;
}

// No browser focus outline on web: the ring is drawn by the box shadow.
export const noOutline = Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as unknown as TextStyle) : null;

function ring(colors: Colors, state: { focused?: boolean; error?: boolean }): string {
  if (state.error) return `0 0 0 1.5px ${colors.bad}`;
  if (state.focused) return `0 0 0 1.5px ${colors.acc}`;
  return `0 0 0 1px ${colors.line2}`;
}

/** The text style of an input: Geist 15, or Manrope for numbers; −0.01em as on the body. */
export function inputText(colors: Colors, { numeric, weight = 400 }: { numeric?: boolean; weight?: Weight }): TextStyle {
  return {
    fontFamily: numeric ? manrope(weight) : geist(weight),
    fontVariant: numeric ? ["tabular-nums"] : undefined,
    fontSize: 15,
    letterSpacing: -0.15,
    color: colors.ink,
    includeFontPadding: false,
  };
}

export function ErrorLine({ children }: { children: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Glyph name="alert" size={14} color="bad" />
      <Text size={12.5} color="bad" style={{ flexShrink: 1 }}>{children}</Text>
    </View>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text size={12.5} color="muted" style={{ paddingLeft: 2 }} importantForAccessibility="no">{label}</Text>
      {children}
      {error ? <ErrorLine>{error}</ErrorLine> : null}
    </View>
  );
}

type InputProps = Omit<TextInputProps, "style" | "editable" | "placeholderTextColor"> & {
  label: string;
  error?: string;
  disabled?: boolean;
  numeric?: boolean;
  weight?: Weight;
  /** Show the focus ring without focus (the board's "focused" sample). */
  forceFocused?: boolean;
};

function useFocus(props: Pick<TextInputProps, "onFocus" | "onBlur">) {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    handlers: {
      onFocus: (e: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => { setFocused(true); props.onFocus?.(e); },
      onBlur: (e: Parameters<NonNullable<TextInputProps["onBlur"]>>[0]) => { setFocused(false); props.onBlur?.(e); },
    },
  };
}

export function TextField({ label, error, disabled, numeric, weight, forceFocused, multiline, onFocus, onBlur, ...rest }: InputProps) {
  const { colors } = useTheme();
  const placeholder = usePlaceholder();
  const { focused, handlers } = useFocus({ onFocus, onBlur });
  return (
    <Field label={label} error={error}>
      {/* The ring sits on a wrapper: Android draws no box shadow on a TextInput. */}
      <View style={{ borderRadius: 13, backgroundColor: colors.card, boxShadow: ring(colors, { focused: focused || forceFocused, error: !!error }), opacity: disabled ? 0.5 : 1 }}>
      <TextInput
        {...rest}
        {...handlers}
        multiline={multiline}
        editable={!disabled}
        accessibilityLabel={label}
        accessibilityHint={error}
        aria-invalid={!!error}
        placeholderTextColor={placeholder}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          inputText(colors, { numeric, weight }),
          {
            // Multi-line: rows=3 at a 1.45 leading (22) plus 12 above and below.
            minHeight: multiline ? 3 * 22 + 24 : 46, paddingHorizontal: 14,
            paddingVertical: multiline ? 12 : 0, lineHeight: multiline ? 22 : undefined,
          },
          noOutline,
        ]}
      />
      </View>
    </Field>
  );
}

export function AffixField({ label, error, disabled, numeric = true, weight, forceFocused, prefix, suffix, onFocus, onBlur, ...rest }: InputProps & { prefix?: string; suffix?: string }) {
  const { colors } = useTheme();
  const placeholder = usePlaceholder();
  const { focused, handlers } = useFocus({ onFocus, onBlur });
  const fx = (s: string) => <Text size={14.5} color="muted" style={{ flexShrink: 0 }} importantForAccessibility="no">{s}</Text>;
  return (
    <Field label={label} error={error}>
      <View style={{
        flexDirection: "row", alignItems: "center", minHeight: 48, borderRadius: 13, backgroundColor: colors.card, paddingHorizontal: 14, gap: 8,
        boxShadow: ring(colors, { focused: focused || forceFocused, error: !!error }), opacity: disabled ? 0.5 : 1,
      }}>
        {prefix ? fx(prefix) : null}
        <TextInput
          {...rest}
          {...handlers}
          editable={!disabled}
          accessibilityLabel={[label, suffix].filter(Boolean).join(", ")}
          aria-invalid={!!error}
          placeholderTextColor={placeholder}
          style={[inputText(colors, { numeric, weight }), { flexGrow: 1, flexShrink: 1, minWidth: 0, alignSelf: "stretch", paddingVertical: 0, paddingHorizontal: 0 }, noOutline]}
        />
        {suffix ? fx(suffix) : null}
      </View>
    </Field>
  );
}

export function SelectField({ label, value, onPress, chevron = true, mono, error, disabled }: { label: string; value: string; onPress?: () => void; chevron?: boolean; /** Dates and times: Manrope 14.5/500. */ mono?: boolean; error?: string; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Field label={label} error={error}>
      <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} accessibilityState={{ disabled: !!disabled }}
        style={{
          flexDirection: "row", alignItems: "center", minHeight: 48, borderRadius: 13, backgroundColor: colors.card, paddingHorizontal: 14, gap: 10,
          boxShadow: ring(colors, { error: !!error }), opacity: disabled ? 0.5 : 1,
        }}>
        {mono
          ? <Num size={14.5} weight={500} style={{ flexGrow: 1, flexShrink: 1 }}>{value}</Num>
          : <Text style={{ flexGrow: 1, flexShrink: 1 }}>{value}</Text>}
        {chevron ? <Glyph name="chevronDown" size={16} color="faint" /> : null}
      </Press>
    </Field>
  );
}

export function CodeField({ label, value, onChange, length = 6, error, disabled, autoFocus }: { label: string; value: string; onChange: (v: string) => void; length?: number; error?: string; disabled?: boolean; autoFocus?: boolean }) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const half = Math.ceil(length / 2);
  const next = Math.min(value.length, length - 1);
  const done = value.length >= length;
  const box = (i: number) => {
    const active = !disabled && !done && i === next;
    const shadow = error
      ? `0 0 0 1.5px ${colors.bad}`
      : active ? `0 0 0 1.5px ${colors.acc}, 0 0 0 4px ${colors["acc-soft"]}` : `0 0 0 1px ${colors.line2}`;
    return (
      <View key={i} style={{ flex: 1, minHeight: 52, borderRadius: 13, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", boxShadow: shadow }}>
        <Num size={21} weight={600}>{value[i] ?? ""}</Num>
      </View>
    );
  };
  return (
    <Field label={label} error={error}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1 }}>
        {Array.from({ length }, (_, i) => (
          i === half ? [<View key="dash" style={{ width: 8, height: 2, borderRadius: 2, backgroundColor: colors.line2, flexShrink: 0 }} />, box(i)] : box(i)
        ))}
        {/* One real input over the boxes: the keyboard, paste and SMS autofill all land here. */}
        <TextInput
          ref={input}
          value={value}
          onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
          maxLength={length}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
          editable={!disabled}
          autoFocus={autoFocus}
          caretHidden
          accessibilityLabel={label}
          aria-invalid={!!error}
          style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: "transparent" }, noOutline]}
        />
      </View>
    </Field>
  );
}
