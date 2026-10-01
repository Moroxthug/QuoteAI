// SignIn.dc.html: the states are default, wrong, unverified, offline, expired, cancelled.
// `expired` and `cancelled` arrive from an emailed link (?notice=); the rest come from the
// server's answer to the sign-in.
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { auth, type AuthProblem } from "@/lib/auth";
import { useSession } from "@/lib/useSession";
import { AuthBody, AuthHeader, FieldButton, OrDivider, PillLink, TextLink } from "@/ui/Auth";
import { Button } from "@/ui/Button";
import { Banner, useToast, type BannerTone } from "@/ui/Feedback";
import { FormCard, FormRow } from "@/ui/FormCard";
import { Icon } from "@/ui/Icon";
import { PageTitle } from "@/ui/Header";
import type { IconName, Tone } from "@/ui/Icon";
import { Section, Spacer, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

type Notice = "wrong" | "unverified" | "offline" | "expired" | "cancelled" | "pending" | "failed";
const BANNER: Record<Notice, { tone: BannerTone; icon: IconName; iconTone: Tone }> = {
  wrong: { tone: "bad", icon: "warn", iconTone: "rose" },
  unverified: { tone: "info", icon: "mail", iconTone: "sky" },
  offline: { tone: "warn", icon: "cloud", iconTone: "amber" },
  expired: { tone: "warn", icon: "clock", iconTone: "amber" },
  cancelled: { tone: "ok", icon: "check", iconTone: "sage" },
  pending: { tone: "warn", icon: "clock", iconTone: "amber" },
  failed: { tone: "warn", icon: "warn", iconTone: "amber" },
};

function noticeFor(problem: AuthProblem): Notice {
  switch (problem) {
    case "wrong": return "wrong";
    case "unverified": return "unverified";
    case "offline": return "offline";
    case "cancelled": return "pending";
    default: return "failed";
  }
}

export default function SignIn() {
  const { t } = useTranslation();
  const toast = useToast();
  const { refresh } = useSession();
  const params = useLocalSearchParams<{ notice?: string; email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(params.notice === "expired" || params.notice === "cancelled" ? params.notice : null);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/welcome"));
  const toCode = () => router.push({ pathname: "/verify", params: { email: email.trim() } });

  async function submit() {
    if (busy) return;
    if (!email.trim() || password.length < 8) { setNotice("wrong"); return; }
    setBusy(true);
    setNotice(null);
    const r = await auth.signIn(email.trim(), password);
    if (!r.ok) {
      setBusy(false);
      setNotice(noticeFor(r.problem));
      return;
    }
    if (r.data.twoStep) {
      setBusy(false);
      router.push("/two-step");
      return;
    }
    await refresh();
    setBusy(false);
    router.replace("/");
  }

  const banner = notice ? BANNER[notice] : null;
  return (
    <Screen>
      <AuthHeader onBack={back} backLabel={t("auth.back")} />
      <AuthBody>
        <Section px={20} pt={26} gap={8}>
          <PageTitle>{t("signIn.title")}</PageTitle>
          <Text color="muted" leading={1.45}>{t("signIn.sub")}</Text>
        </Section>
        {notice && banner ? (
          <Section px={16} pt={18}>
            <Banner tone={banner.tone} icon={banner.icon} iconTone={banner.iconTone} lead={t(`signIn.banner.${notice}.lead`)}
              link={notice === "unverified" ? t("signIn.banner.unverified.link") : undefined} onLink={toCode}>
              {t(`signIn.banner.${notice}.text`, { email: email.trim() })}
            </Banner>
          </Section>
        ) : null}
        <Section delay={60} px={16} pt={18}>
          <FormCard error={notice === "wrong"}>
            <FormRow first icon="mail" tone="sky" label={t("signIn.email")} value={email} onChangeText={(v) => { setEmail(v); setNotice(null); }}
              placeholder={t("auth.emailPlaceholder")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
            <FormRow icon="key" tone="violet" label={t("signIn.password")} value={password} onChangeText={(v) => { setPassword(v); setNotice(null); }}
              placeholder={t("auth.passwordPlaceholder")} secureTextEntry={!shown} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password"
              onSubmitEditing={() => void submit()} returnKeyType="go"
              trailing={<FieldButton glyph={shown ? "eyeOff" : "eye"} label={shown ? t("auth.hide") : t("auth.show")} selected={shown} onPress={() => setShown(!shown)} />} />
          </FormCard>
          <Stack row justify="flex-end" pt={12} px={4}>
            <TextLink label={t("signIn.forgot")} onPress={() => router.push({ pathname: "/forgot-password", params: { email: email.trim() } })} />
          </Stack>
        </Section>
        <Section delay={100} px={16} pt={20} gap={14}>
          <Button size="lg" label={t("signIn.signIn")} busy={busy ? t("signIn.signing") : false} block onPress={() => void submit()} />
          <OrDivider label={t("auth.or")} />
          <Button size="lg" kind="secondary" label={t("signIn.faceId")} block onPress={() => toast({ message: t("signIn.faceIdOff") })}
            icon={<Icon name="face" tone="slate" size={24} />} />
        </Section>
        <Spacer />
        <Section pt={24} gap={12} align="center">
          <Stack row gap={4} align="center">
            <Text size={14.5} color="muted">{t("signIn.newTo")}</Text>
            <TextLink label={t("signIn.create")} size={14.5} weight={600} color="ink" onPress={() => router.replace("/sign-up")} />
          </Stack>
          <PillLink icon="cone" label={t("signIn.crew")} onPress={() => router.push("/join-code")} />
        </Section>
      </AuthBody>
    </Screen>
  );
}
