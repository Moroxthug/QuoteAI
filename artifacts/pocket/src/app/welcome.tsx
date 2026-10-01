// Welcome.dc.html: three slides, then Create an account / I have an account / Join your team.
// Showing it marks the welcome as seen, so a signed-out phone opens on Sign in afterwards.
import { useEffect } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Locale } from "@/lib/format";
import { markWelcomeSeen } from "@/lib/useSession";
import { AuthBody, TextLink } from "@/ui/Auth";
import { Button } from "@/ui/Button";
import { Section, Spacer, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { TourLink, WelcomeCarousel, WelcomeHeader } from "@/ui/WelcomeArt";

export default function Welcome() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  useEffect(() => { void markWelcomeSeen(); }, []);
  return (
    <Screen>
      <AuthBody bottom={28}>
        <WelcomeHeader />
        <WelcomeCarousel locale={locale} />
        <Spacer />
        <Section delay={120} px={20} gap={10} pt={16}>
          <Button size="lg" label={t("welcome.create")} block onPress={() => router.push("/sign-up")} />
          <Button size="lg" kind="secondary" label={t("welcome.have")} block onPress={() => router.push("/sign-in")} />
          <Stack row justify="center" align="center" gap={4} wrap>
            <Text size={14.5} color="muted">{t("welcome.crewQ")}</Text>
            <TextLink label={t("welcome.crewA")} size={14.5} weight={600} color="ink" onPress={() => router.push("/join-code")} />
          </Stack>
          <TourLink label={t("welcome.tour")} onPress={() => router.push({ pathname: "/coming-soon", params: { title: t("welcome.tourTitle") } })} />
        </Section>
      </AuthBody>
    </Screen>
  );
}
