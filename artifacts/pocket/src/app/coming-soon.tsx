// One shared "Coming soon" screen (owner ruling 2026-09-30): every link to a later phase's screen
// opens it with that screen's real title: the normal back header, the title, one short line.
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Empty } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { Screen } from "@/ui/Screen";

export default function ComingSoon() {
  const { t } = useTranslation();
  const { title } = useLocalSearchParams<{ title?: string }>();
  return (
    <Screen>
      <Header title={title ?? ""} backLabel={t("comingSoon.back")} onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <Empty icon="spark" title={title ?? ""} body={t("comingSoon.line")} />
    </Screen>
  );
}
