// Components.dc.html · "Buttons": each kind in its four states (a 2-column grid, gap 10),
// the four sizes, the small row, and the floating action bar.
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, type ButtonKind } from "../Button";
import { Glyph } from "../Icon";
import { Press } from "../motion";
import { shadow } from "../shadow";
import { useTheme } from "../theme";
import { BoardCaption, BoardGroup, BoardPad, BoardSection } from "../sandbox";

const KINDS: ButtonKind[] = ["primary", "secondary", "destructive", "accent", "link"];

export function ButtonsSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const b = (k: string) => t(`board.buttons.${k}`);
  const cell = (node: React.ReactNode, cap: string) => (
    <View style={{ width: "48.5%", gap: 6 }}>
      {node}
      <BoardCaption>{cap}</BoardCaption>
    </View>
  );
  return (
    <>
      <BoardSection title={b("title")} />
      {KINDS.map((k) => (
        <View key={k}>
          <BoardGroup label={b(`${k}.name`)} />
          <BoardPad style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
            {cell(<Button kind={k} label={b(`${k}.label`)} block />, b("default"))}
            {cell(<Button kind={k} label={b(`${k}.label`)} block forcePressed />, b("pressed"))}
            {cell(<Button kind={k} label={b(`${k}.label`)} block disabled />, b("disabled"))}
            {cell(<Button kind={k} label={b(`${k}.label`)} block busy={b(`${k}.busy`)} />, b("loading"))}
          </BoardPad>
        </View>
      ))}
      <BoardGroup label={b("sizes")} />
      <BoardPad style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Button size="sm" label={b("small")} />
          <Button size="md" label={b("medium")} />
          <Button label={b("defaultSize")} />
        </View>
        <Button size="lg" label={b("large")} block />
      </BoardPad>
      <BoardGroup label={b("smallGroup")} />
      <BoardPad style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button size="sm" label={b("send")} />
        <Button size="sm" kind="secondary" label={b("edit")} />
        <Button size="sm" kind="destructive" label={b("remove")} />
        <Button size="sm" kind="accent" label={b("reload")} />
        <Button size="sm" kind="secondary" label={b("newQuote")} icon={<Glyph name="plus" size={14} weight={2.4} />} />
      </BoardPad>
      <BoardGroup label={b("fab")} />
      <BoardPad style={{ flexDirection: "row", gap: 10 }}>
        <Press accessibilityRole="button" accessibilityLabel={b("more")}
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.glass, alignItems: "center", justifyContent: "center", boxShadow: `${shadow("float", colors)}, ${shadow("ring", colors)}` }}>
          <Glyph name="more" size={20} />
        </Press>
        <Button size="lg" label={b("primary.label")} grow style={{ boxShadow: shadow("float", colors) }} />
      </BoardPad>
    </>
  );
}
