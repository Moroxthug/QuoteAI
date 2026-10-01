// SmartHome pieces that only Home uses (SmartHome.dc.html).
// HomeHeader: the date and the site weather (12.5/500 muted, a 14 weather glyph) over the greeting
// (24/600, -0.035em); on the right a 40 round `sunk` plus (Quick add) and a 40 `inv` avatar with the
// person's initials (a 10 violet dot when notifications are waiting) that opens the Menu.
// QuickAddGrid: the Quick add sheet's 3 x 2 tiles (radius 18, ring): a 32 icon, the name 13.5/500 and
// a muted 11.5 line.
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glyph, Icon, type GlyphName, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function HomeHeader({ date, weather, weatherGlyph, greeting, quickLabel, onQuick, menuLabel, onMenu, initials, unread, unreadLabel }: {
  date: string; weather?: string; weatherGlyph?: GlyphName; greeting: string; quickLabel: string; onQuick: () => void;
  menuLabel: string; onMenu: () => void; initials: string; unread?: boolean; unreadLabel?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 18 + insets.top, paddingHorizontal: 20 }}>
      <View style={{ flexShrink: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text size={12.5} weight={500} color="muted">{date}</Text>
          {weather ? (
            <>
              <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: colors.faint }} />
              {weatherGlyph ? <Glyph name={weatherGlyph} size={14} color="muted" weight={1.8} /> : null}
              <Text size={12.5} weight={500} color="muted">{weather}</Text>
            </>
          ) : null}
        </View>
        <Text size={24} weight={600} tracking={-0.035} leading={1.15} accessibilityRole="header">{greeting}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
        <Press onPress={onQuick} accessibilityRole="button" accessibilityLabel={quickLabel} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}>
          <Glyph name="plus" size={19} weight={2.1} />
        </Press>
        <Press onPress={onMenu} accessibilityRole="button" accessibilityLabel={unread && unreadLabel ? `${menuLabel}. ${unreadLabel}` : menuLabel}
          hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }}>
          <Text size={13.5} weight={600} color="on-inv" allowFontScaling={false}>{initials}</Text>
          {unread ? <View style={{ position: "absolute", top: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.acc, boxShadow: `0 0 0 2px ${colors.ground}` }} /> : null}
        </Press>
      </View>
    </View>
  );
}

export type QuickTile = { key: string; icon: IconName; tone: Tone; label: string; sub: string; onPress: () => void };

export function QuickAddGrid({ tiles }: { tiles: QuickTile[] }) {
  const { colors } = useTheme();
  const rows = [tiles.slice(0, 3), tiles.slice(3, 6)];
  return (
    <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          {r.map((t) => (
            <Press key={t.key} onPress={t.onPress} accessibilityRole="button" accessibilityLabel={`${t.label}. ${t.sub}`}
              style={{ flex: 1, minHeight: 112, borderRadius: 18, backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.ring}`, padding: 12, gap: 8 }}>
              <Icon name={t.icon} tone={t.tone} size={32} />
              <View style={{ gap: 2 }}>
                <Text size={13.5} weight={500} numberOfLines={2}>{t.label}</Text>
                <Text size={11.5} color="muted" leading={1.3} numberOfLines={2}>{t.sub}</Text>
              </View>
            </Press>
          ))}
        </View>
      ))}
    </View>
  );
}
