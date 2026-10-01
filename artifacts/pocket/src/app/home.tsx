// Temporary Home: where sign-up lands until SmartHome is built in phase 125 ("sign-up to an
// empty Home"). Signed out → back to "/".
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { Empty } from "@/ui/Feedback";
import { PageTitle } from "@/ui/Header";
import { Section, Spacer } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { useSession } from "@/lib/useSession";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Home() {
  const { t } = useTranslation();
  const { status, user, signOut } = useSession();
  const insets = useSafeAreaInsets();
  if (status === "out") return <Redirect href="/" />;
  return (
    <Screen>
      <Section px={20} pt={26 + insets.top} gap={8}>
        <PageTitle>{t("home.title")}</PageTitle>
      </Section>
      <Section delay={60} px={16} pt={18}>
        <Empty icon="house" title={user ? t("home.greeting", { name: user.name.split(" ")[0] }) : t("home.emptyTitle")} body={t("home.emptyBody")} />
      </Section>
      <Spacer />
      <Section px={16} pb={32 + insets.bottom}>
        <Button kind="secondary" label={t("home.signOut")} block onPress={() => void signOut().then(() => router.replace("/"))} />
      </Section>
    </Screen>
  );
}
