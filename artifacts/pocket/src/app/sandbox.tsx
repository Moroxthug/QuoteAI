// /sandbox mirrors docs/pocket-design/Components.dc.html, section by section (phases 154–156).
import { ScrollView, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/theme/tokens";

const c = tokens.color.light;
const title = tokens.type.roles.pageTitle;

export default function Sandbox() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.ground }} contentContainerStyle={{ paddingTop: insets.top + tokens.space.gutter, paddingHorizontal: tokens.space.gutter }}>
      <Text style={{ color: c.ink, fontSize: title.size, fontWeight: "600" }}>{t("sandbox.title")}</Text>
    </ScrollView>
  );
}
