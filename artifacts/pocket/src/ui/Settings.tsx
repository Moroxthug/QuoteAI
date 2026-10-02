// The Settings boards' building blocks (Settings, SetCompany, SetTaxes, SetQuotes, SetInvoices... .dc.html): a group (title, card, a note under it), a row
// (a 28 icon, the label over what it does, and on the right a switch, a stepper, a value, a status, a button or a chevron; a segmented control or a note
// below), a typed field row, and the "Unsaved changes" bar. Sizes are the boards' own (.set-*, .row, .txt).
import type { ReactNode } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { VoiceOrb } from "./Assistant";
import { Button } from "./Button";
import { Card, Hairline } from "./Card";
import { inputText, noOutline, usePlaceholder } from "./Field";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { cssShadow } from "./shadow";
import { Segmented } from "./Segmented";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

/** A list to choose one from in a sheet (the provinces with their tax), the chosen one ticked. */
export function ChoiceList({ items, chosen, onPick }: { items: { id: string; name: string; sub?: string }[]; chosen: string | null; onPick: (id: string) => void }) {
  return (
    <View>
      {items.map((c, i) => (
        <View key={c.id}>
          {i ? <Hairline inset={0} /> : null}
          <Press onPress={() => onPick(c.id)} accessibilityRole="radio" accessibilityState={{ checked: c.id === chosen }} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 8 }}>
            <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
              <Text size={15} weight={500}>{c.name}</Text>
              {c.sub ? <Text size={12.5} color="muted">{c.sub}</Text> : null}
            </View>
            {c.id === chosen ? <Glyph name="check" size={20} color="acc" /> : null}
          </Press>
        </View>
      ))}
    </View>
  );
}

/** The line under a sheet's title. */
export function SheetNote({ children }: { children: string }) {
  return <Text size={13.5} color="muted" style={{ marginBottom: 8 }}>{children}</Text>;
}

/** Settings' foot: the version and the three small links. */
export function VersionFoot({ version, links }: { version: string; links: { label: string; onPress: () => void }[] }) {
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <Text size={11.5} color="faint">{version}</Text>
      <View style={{ flexDirection: "row", gap: 18 }}>
        {links.map((l) => <Press key={l.label} onPress={l.onPress} accessibilityRole="link" hitSlop={10}><Text size={12.5} color="muted">{l.label}</Text></Press>)}
      </View>
    </View>
  );
}

/** `.set-gt`, the card with its margin 0 16, and `.set-foot` under it. */
export function SetGroup({ title, foot, first, children }: { title?: string; foot?: string; first?: boolean; children: ReactNode }) {
  return (
    <View style={{ paddingTop: title ? 26 : first ? 12 : 0 }}>
      {title ? <Text size={17} weight={600} tracking={-0.025} accessibilityRole="header" style={{ marginHorizontal: 20, marginBottom: 10 }}>{title}</Text> : null}
      <View style={{ marginHorizontal: 16 }}><Card>{children}</Card></View>
      {foot ? <Text size={12.5} color="muted" leading={1.45} style={{ marginHorizontal: 20, marginTop: 10 }}>{foot}</Text> : null}
    </View>
  );
}

/** The 28 icon of a row; `top` lines it with the first line of a row that has a control below. */
function RowIcon({ icon, tone, top }: { icon: IconName; tone: Tone; top?: boolean }) {
  return <View style={{ width: 28, height: 28, flexShrink: 0, marginTop: top ? 14 : 0 }}><Icon name={icon} tone={tone} size={28} /></View>;
}

/** One row: `control` on the right of the label, `below` under it (a segmented control), `note` under that. A row with `onPress` opens something. */
export function SetRow({ first, icon, tone, label, sub, control, below, note, onPress, disabled, labelTone }: {
  first?: boolean; icon: IconName; tone: Tone; label: string; sub?: string; control?: ReactNode; below?: ReactNode; note?: string; onPress?: () => void; disabled?: boolean; labelTone?: "ink" | "muted";
}) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: below ? "flex-start" : "center", gap: 14, paddingHorizontal: 16 }}>
      <RowIcon icon={icon} tone={tone} top={!!below} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: below ? 56 : 60 }}>
          <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2, paddingVertical: 11 }}>
            <Text size={15} weight={500} color={labelTone ?? "ink"}>{label}</Text>
            {sub ? <Text size={12.5} color="muted" leading={1.35}>{sub}</Text> : null}
          </View>
          {control}
        </View>
        {below}
        {note ? <Text size={12.5} color="muted" leading={1.45} style={{ paddingBottom: 14, marginTop: -4 }}>{note}</Text> : null}
      </View>
    </View>
  );
  return (
    <>
      {first ? null : <Hairline inset={58} />}
      {onPress ? <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={[label, sub].filter(Boolean).join(", ")}>{body}</Press> : body}
    </>
  );
}

/** `.set-seg`: the segmented control under a row's label. */
export function SetSegment({ options, value, onChange, label, labels, disabled }: { options: string[]; value: number; onChange: (i: number) => void; label: string; labels?: string[]; disabled?: boolean }) {
  return <View style={{ marginBottom: 14, opacity: disabled ? 0.55 : 1 }} pointerEvents={disabled ? "none" : "auto"}><Segmented options={options} value={value} onChange={onChange} label={label} labels={labels} /></View>;
}

/** `.set-step`: a `sunk` well with 34 minus / plus buttons around the value (Manrope 13.5, 60 wide). */
export function SetStepper({ value, onDec, onInc, decLabel, incLabel, canDec = true, canInc = true, disabled }: {
  value: string; onDec: () => void; onInc: () => void; decLabel: string; incLabel: string; canDec?: boolean; canInc?: boolean; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const btn = (glyph: "minus" | "plus", label: string, onPress: () => void, enabled: boolean) => (
    <Press onPress={onPress} disabled={!enabled || disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={5}
      style={{ width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", opacity: enabled && !disabled ? 1 : 0.35 }}>
      <Glyph name={glyph} size={14} weight={2.2} />
    </Press>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.sunk, borderRadius: 11, padding: 2, flexShrink: 0, opacity: disabled ? 0.5 : 1 }}>
      {btn("minus", decLabel, onDec, canDec)}
      <Num size={13.5} weight={500} align="center" accessibilityLiveRegion="polite" style={{ minWidth: 60 }}>{value}</Num>
      {btn("plus", incLabel, onInc, canInc)}
    </View>
  );
}

/** `.set-val`: the value on the right of a row, muted, one line; a link row adds the chevron. */
export function SetValue({ value, mono, chevron }: { value: string; mono?: boolean; chevron?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, maxWidth: "52%" }}>
      {value ? (mono ? <Num size={13.5} weight={400} color="muted" numberOfLines={1}>{value}</Num> : <Text size={13.5} color="muted" numberOfLines={1}>{value}</Text>) : null}
      {chevron ? <Glyph name="chevron" size={15} color="faint" /> : null}
    </View>
  );
}

/** A button in a row's control slot (Connect, Change). */
export function SetButton({ label, kind = "secondary", onPress, disabled }: { label: string; kind?: "primary" | "secondary"; onPress: () => void; disabled?: boolean }) {
  return <Button size="sm" kind={kind} label={label} onPress={onPress} disabled={disabled} />;
}

/** `.set-in`: a row's field: the label 12.5 muted over the value 15, in the same card as the other rows. */
export function SetField({ first, icon, tone, label, status, mono, disabled, ...rest }: Omit<TextInputProps, "style" | "placeholderTextColor" | "editable"> & {
  first?: boolean; icon: IconName; tone: Tone; label: string; status?: ReactNode; mono?: boolean; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const placeholder = usePlaceholder();
  return (
    <>
      {first ? null : <Hairline inset={58} />}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16 }}>
        <RowIcon icon={icon} tone={tone} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3, paddingVertical: 11 }}>
            <Text size={12.5} color="muted" importantForAccessibility="no">{label}</Text>
            <TextInput {...rest} editable={!disabled} accessibilityLabel={label} placeholderTextColor={placeholder}
              style={[inputText(colors, { numeric: mono }), { height: 22, padding: 0, paddingVertical: 0, color: colors.ink }, noOutline]} />
          </View>
          {status}
        </View>
      </View>
    </>
  );
}

/** `.set-sheetbar`: floating over the bottom: "Unsaved changes" with Discard and Save. */
export function SaveBar({ message, discard, save, onDiscard, onSave, busy }: { message: string; discard: string; save: string; onDiscard: () => void; onSave: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="summary" accessibilityLabel={message}
      style={{ position: "absolute", left: 16, right: 16, bottom: 26, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingLeft: 18, paddingRight: 8, borderRadius: 24,
        backgroundColor: colors.glass, boxShadow: `${cssShadow("0 10px 30px -8px var(--shadow)", colors)}, 0 0 0 1px ${colors.ring}` }}>
      <Text size={14.5} weight={500} style={{ flexGrow: 1, flexShrink: 1 }}>{message}</Text>
      <Button size="md" kind="secondary" label={discard} onPress={onDiscard} disabled={busy} />
      <Button size="md" label={save} onPress={onSave} busy={busy ? save : false} />
    </View>
  );
}

/** The Settings voice row: the label, the name chosen, and three orbs to choose from (a radio group; the chosen one is ringed in `ink` and 4 % larger). */
export function VoicePicker({ icon, tone, label, sub, group, voices, value, onChange, disabled }: {
  icon: IconName; tone: Tone; label: string; sub: string; group: string; voices: { id: "ember" | "tide" | "stone"; name: string }[]; value: "ember" | "tide" | "stone"; onChange: (v: "ember" | "tide" | "stone") => void; disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, paddingHorizontal: 16, paddingTop: 4 }}>
      <RowIcon icon={icon} tone={tone} top />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, paddingBottom: 14 }}>
        <View style={{ gap: 2, paddingVertical: 11 }}>
          <Text size={15} weight={500}>{label}</Text>
          <Text size={12.5} color="muted" leading={1.35}>{sub}</Text>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel={group} style={{ flexDirection: "row", gap: 4, marginTop: 3 }}>
          {voices.map((v) => {
            const on = v.id === value;
            return (
              <Press key={v.id} onPress={() => onChange(v.id)} disabled={disabled} accessibilityRole="radio" accessibilityLabel={v.name} accessibilityState={{ checked: on, disabled: !!disabled }}
                style={{ flex: 1, alignItems: "center", gap: 7, paddingVertical: 2, opacity: disabled ? 0.5 : 1 }}>
                <View style={{ borderRadius: 33, padding: 3, transform: [{ scale: on ? 1.04 : 1 }], boxShadow: on ? `0 0 0 2px ${colors.ink}` : `0 0 0 1px ${colors.line2}` }}>
                  <VoiceOrb voice={v.id} size={48} ring={false} />
                </View>
                <Text size={12.5} weight={500} color={on ? "ink" : "muted"}>{v.name}</Text>
              </Press>
            );
          })}
        </View>
      </View>
    </View>
  );
}
