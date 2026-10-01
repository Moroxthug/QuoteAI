// A date picked in a sheet ("Pick a date"): the month as a grid of 44 cells, previous and next month in the title row,
// today ringed, the chosen day filled with `inv`. The app has no native date picker, and the boards draw dates as chips and
// fields, so this one sheet serves every screen that needs a date. Weeks start on Sunday (Canada).
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Sheet, SheetTitle } from "./Sheet";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  prevLabel: string;
  nextLabel: string;
  locale: "en-CA" | "fr-CA";
  value: Date | null;
  onPick: (d: Date) => void;
  /** Days before this one can't be picked. */
  min?: Date;
};

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function DateSheet({ open, onClose, title, closeLabel, prevLabel, nextLabel, locale, value, onPick, min }: Props) {
  const { colors } = useTheme();
  const today = new Date();
  const [shown, setShown] = useState(() => new Date((value ?? today).getFullYear(), (value ?? today).getMonth(), 1, 12));
  useEffect(() => { if (open) { const b = value ?? new Date(); setShown(new Date(b.getFullYear(), b.getMonth(), 1, 12)); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = new Date(shown.getFullYear(), shown.getMonth(), 1, 12);
  const lead = first.getDay();
  const count = new Date(shown.getFullYear(), shown.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(shown.getFullYear(), shown.getMonth(), i + 1, 12))];
  while (cells.length % 7) cells.push(null);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2026, 9, 4 + i, 12)));
  const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(shown);
  const go = (n: number) => setShown(new Date(shown.getFullYear(), shown.getMonth() + n, 1, 12));
  const minDay = min ? new Date(min.getFullYear(), min.getMonth(), min.getDate(), 12) : null;

  return (
    <Sheet open={open} onClose={onClose} label={title} closeLabel={closeLabel}>
      <SheetTitle>{title}</SheetTitle>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 6 }}>
        <Press onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel={prevLabel} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Glyph name="back" size={20} /></Press>
        <Text size={15} weight={600} accessibilityRole="header">{month}</Text>
        <Press onPress={() => go(1)} accessibilityRole="button" accessibilityLabel={nextLabel} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Glyph name="chevron" size={20} /></Press>
      </View>
      <View style={{ flexDirection: "row" }}>
        {weekdays.map((w, i) => <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}><Text size={11.5} color="faint" weight={500}>{w}</Text></View>)}
      </View>
      <View style={{ paddingBottom: 12 }}>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {cells.slice(r * 7, r * 7 + 7).map((c, i) => {
              if (!c) return <View key={i} style={{ flex: 1, height: 44 }} />;
              const on = !!value && sameDay(c, value);
              const off = !!minDay && c < minDay;
              const isToday = sameDay(c, today);
              return (
                <View key={i} style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Press onPress={() => { onPick(c); onClose(); }} disabled={off} accessibilityRole="button" accessibilityState={{ selected: on, disabled: off }}
                    accessibilityLabel={new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(c)}
                    style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.inv : "transparent", boxShadow: isToday && !on ? `inset 0 0 0 1.5px ${colors.line2}` : undefined, opacity: off ? 0.35 : 1 }}>
                    <Num size={14.5} weight={on ? 600 : 500} color={on ? "on-inv" : "ink"}>{String(c.getDate())}</Num>
                  </Press>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </Sheet>
  );
}
