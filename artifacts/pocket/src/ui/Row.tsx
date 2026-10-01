// COMPONENTS §18 and the Rows section of Components.dc.html.
// SectionHeader (.sh): a 15/600 title (−0.02em) and a 13.5 muted link, padding 0 4 10.
// ListRow (.lrow): min 44, padding 12×16, gap 12. Left: icon or avatar. Middle: title 14.5/500
// and meta 12.5 muted, one line each with ellipsis. Right: a column (end-aligned, gap 4) for a
// figure and/or a status, or anything given. Pressed: `soft`. Rows in a list are divided by a
// full-width 1 px `line` (RowList).
// MenuRow (.cp-row.in): min 60, a 28 icon, title 15/500 over a 12.5 muted line, an optional
// 13.5 muted value, a 15 chevron in `faint`; hairlines inset 56 (MenuList).
import { Children, Fragment, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Hairline } from "./Card";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function SectionHeader({ title, link, onLink }: { title: string; link?: string; onLink?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 4, paddingBottom: 10 }}>
      <Text weight={600} tracking={-0.02} accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</Text>
      {link ? (
        <Press onPress={onLink} accessibilityRole="link" hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <Text size={13.5} color="muted">{link}</Text>
        </Press>
      ) : null}
    </View>
  );
}

type RowProps = {
  title: string;
  meta?: string;
  leading?: ReactNode;
  /** The right column (figure, status), end-aligned with a gap of 4. */
  trailing?: ReactNode;
  /** Lay the right side out in a row instead (gap 8), as the board's "64 % ›" row does. */
  trailingRow?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** The row's content without its own press, for rows inside other pressables (SwipeRow). */
export function RowBody({ title, meta, leading, trailing, trailingRow }: Omit<RowProps, "onPress" | "accessibilityLabel">) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
      {leading}
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
        {meta ? <Text size={12.5} color="muted" numberOfLines={1}>{meta}</Text> : null}
      </View>
      {trailing ? (
        <View style={trailingRow ? { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 } : { alignItems: "flex-end", gap: 4, flexShrink: 0 }}>{trailing}</View>
      ) : null}
    </View>
  );
}

export function ListRow({ onPress, accessibilityLabel, ...body }: RowProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.soft : "transparent" })}>
      <RowBody {...body} />
    </Pressable>
  );
}

/** The 15 chevron at the end of rows that open something. */
export function RowChevron() {
  return <Glyph name="chevron" size={15} color="faint" />;
}

/** Rows in one list: a full-width hairline between each. */
export function RowList({ children, inset = 0 }: { children: ReactNode; inset?: number }) {
  const items = Children.toArray(children);
  return (
    <>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <Hairline inset={inset} /> : null}
          {child}
        </Fragment>
      ))}
    </>
  );
}

export function MenuRow({ icon, title, sub, value, onPress, chevron = true }: { icon?: ReactNode; title: string; sub?: string; value?: string; onPress?: () => void; chevron?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 60,
        backgroundColor: pressed ? colors.soft : "transparent",
      })}>
      {icon}
      <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
        <Text weight={500}>{title}</Text>
        {sub ? <Text size={12.5} color="muted" leading={1.35}>{sub}</Text> : null}
      </View>
      {value ? <Text size={13.5} color="muted" style={{ flexShrink: 0 }}>{value}</Text> : null}
      {chevron ? <RowChevron /> : null}
    </Pressable>
  );
}

/** Menu rows: hairlines inset 56, past the icon. */
export function MenuList({ children }: { children: ReactNode }) {
  return <RowList inset={56}>{children}</RowList>;
}

/** The board's group label (12.5 muted, padding 0 4) above a later group of rows. */
export function GroupLabel({ children }: { children: string }) {
  return <Text size={12.5} color="muted" style={{ paddingHorizontal: 4 }}>{children}</Text>;
}

/** The board's .sw-hint under the first list: a left arrow and a 12 muted line, centred. */
export function SwipeHint({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 10 }}>
      <Glyph name="back" size={14} color="muted" />
      <Text size={12.5} color="muted">{children}</Text>
    </View>
  );
}
