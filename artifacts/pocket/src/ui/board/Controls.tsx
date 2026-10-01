// Components.dc.html · "Controls": switches, the stepper and the segmented control in one card;
// checkboxes and the round tick; the radio list.
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Card, Hairline } from "../Card";
import { Checkbox, RadioRow } from "../Check";
import { Segmented } from "../Segmented";
import { Stepper } from "../Stepper";
import { Switch } from "../Switch";
import { BoardGroup, BoardPad, BoardRow, BoardSection } from "../sandbox";

const CHECKS = [["a", false, false], ["b", false, false], ["t", true, false], ["z", false, true]] as const;

export function ControlsSection() {
  const { t } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`board.controls.${k}`, o);
  const [sw1, setSw1] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [days, setDays] = useState(30);
  const [seg, setSeg] = useState(2);
  const [chk, setChk] = useState<Record<string, boolean>>({ a: true, b: false, t: true });
  const [radio, setRadio] = useState(0);
  return (
    <>
      <BoardSection title={c("title")} />
      <BoardGroup label={c("group1")} />
      <BoardPad>
        <Card>
          <BoardRow title={c("deposit")} sub={c("on")}><Switch value={sw1} onChange={setSw1} label={c("deposit")} /></BoardRow>
          <Hairline />
          <BoardRow title={c("text")} sub={c("off")}><Switch value={sw2} onChange={setSw2} label={c("text")} /></BoardRow>
          <Hairline />
          <BoardRow title={c("card")} sub={c("disabled")}><Switch value={false} label={c("card")} disabled /></BoardRow>
          <Hairline />
          <BoardRow title={c("valid")} sub={c("stepper")}>
            <Stepper value={c("days", { count: days })} canDec={days > 7}
              onDec={() => setDays((d) => Math.max(7, d - 7))} onInc={() => setDays((d) => d + 7)}
              decLabel={c("fewer")} incLabel={c("more")} />
          </BoardRow>
          <Hairline />
          <BoardRow title={c("appearance")} sub={c("segmented")} stacked>
            <Segmented label={c("appearance")} options={[t("sandbox.appearance.light"), t("sandbox.appearance.dark"), t("sandbox.appearance.auto")]} value={seg} onChange={setSeg} />
          </BoardRow>
        </Card>
      </BoardPad>
      <BoardGroup label={c("group2")} />
      <BoardPad>
        <Card>
          {CHECKS.map(([k, round, dis], i) => (
            <View key={k}>
              {i > 0 ? <Hairline inset={56} /> : null}
              <BoardRow title={c(`checks.${k}.label`)} sub={c(`checks.${k}.sub`)} lead
                leading={<Checkbox checked={!!chk[k]} round={round} disabled={dis} label={c(`checks.${k}.label`)} onChange={(v) => setChk((o) => ({ ...o, [k]: v }))} />} />
            </View>
          ))}
        </Card>
      </BoardPad>
      <BoardGroup label={c("group3")} />
      <BoardPad>
        <Card accessibilityRole="radiogroup" accessibilityLabel={c("schedule")}>
          {[0, 1, 2].map((n) => (
            <View key={n}>
              {n > 0 ? <Hairline inset={50} /> : null}
              <RadioRow selected={radio === n} onPress={() => setRadio(n)} title={c(`radios.${n}.label`)} sub={c(`radios.${n}.sub`)} />
            </View>
          ))}
        </Card>
      </BoardPad>
    </>
  );
}
