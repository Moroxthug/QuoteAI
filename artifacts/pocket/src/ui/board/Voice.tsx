// Components.dc.html · "Voice": the mic button in its three states (the first row cycles idle →
// listening → transcribing on tap), with the level meter while listening.
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Card, Hairline } from "../Card";
import { Text } from "../Text";
import { LevelMeter, MicButton, type MicState } from "../Voice";
import { BoardGroup, BoardPad, BoardSection } from "../sandbox";

const STATES: MicState[] = ["idle", "live", "busy"];

function MicRow({ state, onPress }: { state: MicState; onPress?: () => void }) {
  const { t } = useTranslation();
  const c = (k: string) => t(`board.voice.${state}.${k}`);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, minHeight: 60 }}>
      <MicButton state={state} onPress={onPress} label={c("aria")} />
      <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
        <Text weight={500}>{c("title")}</Text>
        <Text size={12.5} color="muted" leading={1.35}>{c("sub")}</Text>
      </View>
      {state === "live" ? <LevelMeter /> : null}
    </View>
  );
}

export function VoiceSection() {
  const { t } = useTranslation();
  const [n, setN] = useState(0);
  return (
    <>
      <BoardSection title={t("board.voice.title")} />
      <BoardGroup label={t("board.voice.group")} />
      <BoardPad>
        <Card>
          <MicRow state={STATES[n]!} onPress={() => setN((i) => (i + 1) % 3)} />
          <Hairline />
          <MicRow state="live" />
          <Hairline />
          <MicRow state="busy" />
        </Card>
      </BoardPad>
    </>
  );
}
