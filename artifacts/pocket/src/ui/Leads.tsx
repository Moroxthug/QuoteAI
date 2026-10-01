// Pieces of the Leads screen (Leads.dc.html).
// LeadTabs: the pipeline tabs (COMPONENTS §13) with a 12.5 / 600 count at 55 % beside each word.
// LeadNotice: the green banner under the tabs (a check icon, one sentence, an optional Undo on `card`).
// LeadHead: a lead card's top: avatar, name, the source line, a Won status, the ask (two lines) and the follow-up line.
// ReplyBox: the suggested reply (`soft`, radius 16, a `line` ring, padding 12): caption and tag, the text, the send button.
// LeadActions: the card's link and main action (44, radius 13); LostLink: "Mark lost", 44 tall, 13.5 / 500 muted.
// ChannelSeg: the 124 wide (150 in French) Text / Email switch in the follow-up plan row.
// NewLeadForm: the inline card at the top (name, email, phone, Follow up by, notes, Cancel and Save).
// ConnectCard: "Bring leads in on their own".
import { useState } from "react";
import { ScrollView, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { tokens } from "@/theme/tokens";
import { canSaveLead, emailOk, type NewLead } from "@/lib/leads";
import { Avatar, type AvatarTint } from "./Avatar";
import { Button } from "./Button";
import { Card } from "./Card";
import { TextField } from "./Field";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Segmented } from "./Segmented";
import { Status, Tag } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

export function LeadTabs({ tabs, active, onChange, label }: { tabs: { key: string; label: string; count: number }[]; active: number; onChange: (i: number) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.ground }}>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.line }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label}
        contentContainerStyle={{ gap: tokens.space.tabGap, paddingHorizontal: 20 }}>
        {tabs.map((tab, i) => {
          const on = i === active;
          return (
            <Press key={tab.key} onPress={() => onChange(i)} accessibilityRole="tab" accessibilityLabel={`${tab.label}, ${tab.count}`} accessibilityState={{ selected: on }}
              style={{ height: tokens.size.tab + 1, paddingBottom: 1, justifyContent: "center", flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text size={14.5} weight={on ? 600 : 500} color={on ? "ink" : "muted"} numberOfLines={1}>{tab.label}</Text>
              <Num size={12.5} weight={600} color={on ? "ink" : "muted"} opacity={0.55}>{tab.count}</Num>
              {on ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, borderRadius: 2, backgroundColor: colors.ink }} /> : null}
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function LeadNotice({ text, undo, onUndo }: { text: string; undo?: string; onUndo?: () => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="summary" accessibilityLiveRegion="polite"
      style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12, paddingHorizontal: 14, borderRadius: tokens.radius.banner, backgroundColor: colors["ok-soft"] }}>
      <Icon name="check" tone="sage" size={24} />
      <Text size={13.5} leading={1.4} color="ok" style={{ flexShrink: 1, flexGrow: 1 }}>{text}</Text>
      {undo && onUndo ? (
        <Press onPress={onUndo} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.card, flexShrink: 0 }}>
          <Text size={13.5} weight={600}>{undo}</Text>
        </Press>
      ) : null}
    </View>
  );
}

function ClockGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={8.5} /><Path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function LeadHead({ initials, tint, name, sourceIcon, sourceTone, source, wonLabel, ask, open, followLabel, follow, followTone }: {
  initials: string; tint: AvatarTint; name: string; sourceIcon: IconName; sourceTone: Tone; source: string; wonLabel?: string; ask: string; open: boolean;
  followLabel?: string; follow?: string; followTone?: "late" | "due" | "plain";
}) {
  const { colors } = useTheme();
  const followColor: ColorName = followTone === "late" ? "bad" : followTone === "due" ? "warn" : "ink";
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar initials={initials} tint={tint} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text size={15} weight={600} tracking={-0.015} numberOfLines={1}>{name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Icon name={sourceIcon} tone={sourceTone} size={16} />
            <Text size={12.5} color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{source}</Text>
          </View>
        </View>
        {wonLabel ? <Status tone="ok" shape="check">{wonLabel}</Status> : null}
      </View>
      {ask ? <Text size={14.5} leading={1.45} color={open ? "ink" : "t2"} numberOfLines={2} style={{ marginTop: 12 }}>{ask}</Text> : null}
      {follow && followLabel ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
          <ClockGlyph color={colors.muted} />
          <Text size={12.5} color="muted">{followLabel} <Text size={12.5} weight={600} color={followColor}>{follow}</Text></Text>
        </View>
      ) : null}
    </View>
  );
}

/** The ask in full, inside an open card (.l-full: 13.5, t2, 1.5, 4 above and 6 below). */
export function FullAsk({ children }: { children: string }) {
  return <Text size={13.5} leading={1.5} color="t2" style={{ marginTop: 4, marginBottom: 6 }}>{children}</Text>;
}

export function ReplyBox({ caption, tag, text, sendLabel, onSend, busy, disabled, note }: { caption: string; tag: string; text: string; sendLabel: string; onSend: () => void; busy?: boolean; disabled?: boolean; note?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10, marginTop: 8, padding: 12, borderRadius: 16, backgroundColor: colors.soft, boxShadow: `0 0 0 1px ${colors.line}` }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text size={12.5} color="muted" style={{ flexShrink: 1 }}>{caption}</Text>
        <Tag accent>{tag}</Tag>
      </View>
      <Text size={13.5} leading={1.45}>{text}</Text>
      {note ? <Text size={12.5} color="bad">{note}</Text> : null}
      <Press onPress={onSend} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={sendLabel}
        style={{ minHeight: 44, borderRadius: 13, backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.line2}`, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled || busy ? 0.5 : 1 }}>
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 12 20 4l-6 16-3-7z" /></Svg>
        <Text size={14.5} weight={600}>{sendLabel}</Text>
      </Press>
    </View>
  );
}

/** .xc-acts with the link optional: the sunk link and the one primary action, side by side. */
export function LeadActions({ link, onLink, main, onMain }: { link?: string; onLink?: () => void; main?: string; onMain?: () => void }) {
  const { colors } = useTheme();
  if (!link && !main) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
      {link ? (
        <Press onPress={onLink} accessibilityRole="button" style={{ flex: 1, height: 44, borderRadius: 13, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{link}</Text>
        </Press>
      ) : null}
      {main ? (
        <Press onPress={onMain} accessibilityRole="link" style={{ flex: 1, height: 44, borderRadius: 13, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }}>
          <Text size={14.5} weight={600} color="on-inv" numberOfLines={1}>{main}</Text>
        </Press>
      ) : null}
    </View>
  );
}

export function LostLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" style={{ height: 44, marginTop: 4, alignItems: "center", justifyContent: "center" }}>
      <Text size={13.5} weight={500} color="muted">{label}</Text>
    </Press>
  );
}

export function ChannelSeg({ options, value, onChange, label, wide }: { options: string[]; value: number; onChange: (i: number) => void; label: string; wide?: boolean }) {
  return (
    <View style={{ width: (wide ? 150 : 124) + (options.length > 2 ? 70 : 0) }}>
      <Segmented options={options} value={value} onChange={onChange} label={label} />
    </View>
  );
}

export function NewLeadForm({ labels, busy, onSave, onClose }: {
  labels: { title: string; close: string; name: string; namePlaceholder: string; email: string; emailPlaceholder: string; emailInvalid: string; phone: string; phonePlaceholder: string; by: string; sms: string; mail: string; notes: string; notesPlaceholder: string; cancel: string; save: string; saving: string };
  busy: boolean; onSave: (d: NewLead) => void; onClose: () => void;
}) {
  const [d, setD] = useState<NewLead>({ name: "", email: "", phone: "", channel: "sms", notes: "" });
  const set = (k: keyof NewLead) => (v: string) => setD((x) => ({ ...x, [k]: v }));
  const [touched, setTouched] = useState(false);
  return (
    <Card style={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text size={17} weight={600} tracking={-0.025} accessibilityRole="header">{labels.title}</Text>
        <Press onPress={onClose} accessibilityRole="button" accessibilityLabel={labels.close} style={{ width: 44, height: 44, marginRight: -10, marginVertical: -10, alignItems: "center", justifyContent: "center" }}>
          <Glyph name="close" size={18} />
        </Press>
      </View>
      <TextField label={labels.name} value={d.name} onChangeText={set("name")} placeholder={labels.namePlaceholder} autoCapitalize="words" autoCorrect={false} />
      <TextField label={labels.email} value={d.email} onChangeText={(v) => { set("email")(v); setTouched(true); }} placeholder={labels.emailPlaceholder} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        error={touched && !emailOk(d.email) ? labels.emailInvalid : undefined} />
      <TextField label={labels.phone} value={d.phone} onChangeText={set("phone")} placeholder={labels.phonePlaceholder} keyboardType="phone-pad" numeric />
      <View style={{ gap: 6 }}>
        <Text size={12.5} color="muted" style={{ paddingLeft: 2 }}>{labels.by}</Text>
        <Segmented options={[labels.sms, labels.mail]} value={d.channel === "sms" ? 0 : 1} onChange={(i) => setD((x) => ({ ...x, channel: i === 0 ? "sms" : "email" }))} label={labels.by} />
      </View>
      <TextField label={labels.notes} value={d.notes} onChangeText={set("notes")} placeholder={labels.notesPlaceholder} multiline />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        <Button label={labels.cancel} kind="secondary" onPress={onClose} grow />
        <Button label={labels.save} busy={busy ? labels.saving : false} disabled={!canSaveLead(d)} onPress={() => onSave(d)} grow />
      </View>
    </Card>
  );
}

export function ConnectCard({ title, sub, action, onPress }: { title: string; sub: string; action: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: `0 0 0 1px ${colors.line2}` }}>
      <Icon name="funnel" tone="violet" size={30} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={600}>{title}</Text>
        <Text size={12.5} color="muted" leading={1.4}>{sub}</Text>
      </View>
      <Button label={action} kind="secondary" size="sm" onPress={onPress} />
    </Card>
  );
}
