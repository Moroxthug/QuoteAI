// /sandbox mirrors docs/pocket-design/Components.dc.html section by section.
// `/sandbox?only=Rows` shows one section under the switches (for checking a part on a device
// without scrolling the whole board).
import type { ComponentType } from "react";
import { Pressable, ScrollView } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { BoardGroup, BoardHeader, SandboxSwitches } from "@/ui/sandbox";
import { ButtonsSection } from "@/ui/board/Buttons";
import { ChipsSection } from "@/ui/board/Chips";
import { ControlsSection } from "@/ui/board/Controls";
import { InputsSection } from "@/ui/board/Inputs";
import { StatusSection } from "@/ui/board/Status";
import { RowsSection } from "@/ui/board/Rows";
import { NumbersSection } from "@/ui/board/Numbers";
import { FeedbackSection } from "@/ui/board/Feedback";
import { PeopleSection } from "@/ui/board/People";

/** The board's sections, in its order. */
const SECTIONS: [string, ComponentType][] = [
  ["Buttons", ButtonsSection],
  ["Chips", ChipsSection],
  ["Controls", ControlsSection],
  ["Inputs", InputsSection],
  ["Status", StatusSection],
  ["Rows", RowsSection],
  ["Numbers", NumbersSection],
  ["Feedback", FeedbackSection],
  ["People", PeopleSection],
];

export default function Sandbox() {
  const { t } = useTranslation();
  const { only } = useLocalSearchParams<{ only?: string }>();
  const shown = SECTIONS.filter(([name]) => !only || name.toLowerCase() === only.toLowerCase());
  return (
    <Screen>
      <ScrollView>
        <BoardHeader title={t("sandbox.title")} intro={t("sandbox.intro")} />
        <SandboxSwitches />
        <Link href="/sandbox/foundations" asChild><Pressable accessibilityRole="link"><BoardGroup label={`${t("sandbox.foundations")} →`} /></Pressable></Link>
        {shown.map(([name, Section]) => <Section key={name} />)}
        <Text> </Text>
      </ScrollView>
    </Screen>
  );
}
