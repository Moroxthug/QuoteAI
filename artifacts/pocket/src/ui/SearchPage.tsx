// Search.dc.html: the box with Cancel, and a result row (an avatar for a client or a 38 glyph, the title with the match drawn in `acc`, the line under it,
// and on the right an amount, a status or a chevron). Sizes are the board's own (.sr-*).
import type { ReactNode } from "react";
import { View } from "react-native";
import { highlight } from "@/lib/search";
import { Avatar, type AvatarTint } from "./Avatar";
import { Hairline } from "./Card";
import { Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { RowChevron } from "./Row";
import { Search } from "./Search";
import { Text, Num } from "./Text";
import { useTheme } from "./theme";

/** `.sr-top`: the search box (with the `acc` ring and a clear button once something is typed) and Cancel. */
export function SearchTop({ value, onChange, onSubmit, placeholder, label, clearLabel, cancel, onCancel }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder: string; label: string; clearLabel: string; cancel: string; onCancel: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 14, paddingLeft: 16, paddingRight: 8 }}>
      <View style={{ flexGrow: 1, flexShrink: 1 }}>
        <Search label={label} ring value={value} onChangeText={onChange} onSubmitEditing={onSubmit} placeholder={placeholder} autoFocus autoCorrect={false} autoCapitalize="none"
          onClear={value ? () => onChange("") : undefined} clearLabel={clearLabel} />
      </View>
      <Press onPress={onCancel} accessibilityRole="button" accessibilityLabel={cancel} style={{ height: 44, paddingHorizontal: 10, justifyContent: "center" }}>
        <Text size={15} weight={500}>{cancel}</Text>
      </Press>
    </View>
  );
}

/** The title with the part that matched drawn on `acc-soft` (.sr-hl). */
function Highlighted({ title, term }: { title: string; term: string }) {
  const { colors } = useTheme();
  const [a, b, c] = highlight(title, term);
  return (
    <Text size={14.5} weight={500} numberOfLines={1}>
      {a}
      {b ? <Text size={14.5} weight={500} tint={colors["acc-soft-t"]} style={{ backgroundColor: colors["acc-soft"], borderRadius: 4 }}>{b}</Text> : null}
      {c}
    </Text>
  );
}

/** `.lrow.sr-row`: avatar or glyph, the title and line, and the right side. */
export function HitRow({ first, avatar, icon, tone, title, term, sub, right, chevron, onPress }: {
  first?: boolean; avatar?: { initials: string; tint: AvatarTint }; icon?: IconName; tone?: Tone; title: string; term?: string; sub: string; right?: ReactNode; chevron?: boolean; onPress: () => void;
}) {
  return (
    <>
      {first ? null : <Hairline inset={0} />}
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${sub}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
        {avatar ? <Avatar initials={avatar.initials} tint={avatar.tint} /> : (
          <View style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={icon ?? "dot"} tone={tone ?? "slate"} size={28} /></View>
        )}
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          {term ? <Highlighted title={title} term={term} /> : <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>}
          <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
        </View>
        {right ? <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>{right}</View> : null}
        {chevron ? <RowChevron /> : null}
      </Press>
    </>
  );
}

/** The kind of a recently opened row ("Quote", "Job"): 12.5 muted on the right. */
export function HitKind({ children }: { children: string }) {
  return <Text size={12.5} color="muted">{children}</Text>;
}

/** A figure on the right of a result (14.5/600). */
export function HitAmount({ children }: { children: string }) {
  return <Num size={14.5} weight={600}>{children}</Num>;
}

/** A result group's heading with how many matched (`.sh` with a muted count). */
export function GroupHead({ title, count, link, onLink }: { title: string; count: number; link?: string; onLink?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 4, paddingBottom: 10 }}>
      <Text weight={600} tracking={-0.02} accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
        <Text size={13.5} weight={500} color="muted">{`  ${count}`}</Text>
      </Text>
      {link ? (
        <Press onPress={onLink} accessibilityRole="link" hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}><Text size={13.5} color="muted">{link}</Text></Press>
      ) : null}
    </View>
  );
}
