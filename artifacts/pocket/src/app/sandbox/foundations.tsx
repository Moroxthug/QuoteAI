// /sandbox/foundations: phase 123.2's check of the type scale, the digit rule, icons and grounds.
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { BoardGroup, BoardHeader, BoardSection, SandboxSwitches } from "@/ui/sandbox";
import { GroundPicker, IconSheet, TypeScale } from "@/ui/foundations";

export default function Foundations() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ScrollView>
        <BoardHeader title={t("sandbox.foundations")} intro={t("sandbox.digits")} />
        <SandboxSwitches />
        <BoardSection title={t("sandbox.typeScale")} />
        <BoardGroup label="Geist 400 · 500 · 600" />
        <TypeScale sample={t("sandbox.digits")} />
        <BoardSection title={t("sandbox.icons")} />
        <BoardGroup label="69 · 13" />
        <IconSheet />
        <BoardSection title={t("sandbox.grounds")} />
        <BoardGroup label="16" />
        <GroundPicker />
        <Text> </Text>
      </ScrollView>
    </Screen>
  );
}
