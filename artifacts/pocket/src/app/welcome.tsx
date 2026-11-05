// The first screen on a signed-out phone: logo, one line, then the ways in. Owner ruling 2026-11-05: this
// replaces Welcome.dc.html's three slides. Showing it marks it as seen, so a signed-out phone opens on Sign in afterwards.
import { useEffect } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { markWelcomeSeen } from "@/lib/useSession";
import { AuthBody, TextLink, WelcomeHeader } from "@/ui/Auth";
import { Button } from "@/ui/Button";
import { PageTitle } from "@/ui/Header";
import { Section, Spacer, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { SignUpTerms } from "@/ui/SignUpMeter";
import { SocialButtons } from "@/ui/SocialButtons";
import { Text } from "@/ui/Text";

const SITE = "https://quoteai.ca";

export default function Welcome() {
  const { t } = useTranslation();
  useEffect(() => { void markWelcomeSeen(); }, []);
  return (
    <Screen>
      <AuthBody bottom={20}>
        <WelcomeHeader />
        <Spacer />
        <Section px={20} pt={32} gap={8}>
          <PageTitle>{t("welcome.title")}</PageTitle>
          <Text color="muted" leading={1.45}>{t("welcome.sub")}</Text>
        </Section>
        <Section delay={60} px={20} gap={10} pt={24}>
          <SocialButtons />
          <Button size="lg" label={t("welcome.create")} block onPress={() => router.push("/sign-up")} />
          <Button size="lg" kind="secondary" label={t("welcome.have")} block onPress={() => router.push("/sign-in")} />
          <Stack row justify="center" align="center" gap={4} wrap>
            <Text size={14.5} color="muted">{t("welcome.crewQ")}</Text>
            <TextLink label={t("welcome.crewA")} size={14.5} weight={600} color="ink" onPress={() => router.push("/join-code")} />
          </Stack>
          <SignUpTerms lead={t("signUp.terms1")} terms={t("signUp.terms")} and={t("signUp.and")} privacy={t("signUp.privacy")}
            onTerms={() => void Linking.openURL(`${SITE}/terms`)} onPrivacy={() => void Linking.openURL(`${SITE}/privacy-policy`)} />
        </Section>
      </AuthBody>
    </Screen>
  );
}
