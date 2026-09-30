// /sandbox mirrors docs/pocket-design/Components.dc.html section by section (phase 123.3 fills
// the sections, one component at a time).
import { ScrollView } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { BoardGroup, BoardHeader, SandboxSwitches } from "@/ui/sandbox";

export default function Sandbox() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ScrollView>
        <BoardHeader title={t("sandbox.title")} intro={t("sandbox.intro")} />
        <SandboxSwitches />
        <Link href="/sandbox/foundations"><BoardGroup label={`${t("sandbox.foundations")} →`} /></Link>
        <Text> </Text>
      </ScrollView>
    </Screen>
  );
}
