// SignUp.dc.html: the states are default, emailTaken, weakPassword, closed. `closed` comes from the
// server's registration switch, `emailTaken` / `weakPassword` from its answer to the sign-up (the
// client checks the 8-character minimum first). Success opens Verify, which sends the first code.
import { useEffect, useRef, useState } from "react";
import { Linking, type TextInput } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { auth, MIN_PASSWORD, type AuthProblem } from "@/lib/auth";
import { kvSet } from "@/lib/kv";
import { COMPANY_KEY } from "@/lib/signUpCompany";
import { strength, type Strength } from "@/lib/signUpStrength";
import { AuthBody, AuthHeader, FieldButton, TextLink } from "@/ui/Auth";
import { Button } from "@/ui/Button";
import { Banner, type BannerTone } from "@/ui/Feedback";
import { FormCard, FormRow } from "@/ui/FormCard";
import { PageTitle } from "@/ui/Header";
import type { IconName, Tone } from "@/ui/Icon";
import { Section, Spacer, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { SignUpMeter, SignUpTerms } from "@/ui/SignUpMeter";
import { Text } from "@/ui/Text";

type Notice = "taken" | "closed" | "offline" | "failed";
const BANNER: Record<Notice, { tone: BannerTone; icon: IconName; iconTone: Tone }> = {
  taken: { tone: "bad", icon: "mail", iconTone: "rose" },
  closed: { tone: "acc", icon: "lock", iconTone: "violet" },
  offline: { tone: "warn", icon: "cloud", iconTone: "amber" },
  failed: { tone: "warn", icon: "warn", iconTone: "amber" },
};

const SITE = "https://quoteai.ca";
/** Where a person on a closed beta asks to be let in (the web page's own mail link). */
const ACCESS_REQUEST = "mailto:support@quoteai.ca?subject=Beta%20access%20request";
export default function SignUp() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const companyRef = useRef<TextInput>(null);

  useEffect(() => {
    let live = true;
    void auth.registrationOpen().then((o) => { if (live) setOpen(o); });
    return () => { live = false; };
  }, []);

  const typed = strength(password);
  const serverWeak = problem === "weakPassword" && typed > 1;
  const level: Strength = serverWeak ? 1 : typed;
  const taken = problem === "emailTaken";
  const weak = level === 1;
  const closed = !open || problem === "closed";
  const notice: Notice | null = taken ? "taken" : closed ? "closed" : problem === "offline" ? "offline" : problem === "failed" || problem === "expired" || problem === "wrong" ? "failed" : null;
  const ready = name.trim().length > 0 && email.includes("@") && password.length >= MIN_PASSWORD && !taken && !closed;

  const back = () => (router.canGoBack() ? router.back() : router.replace("/welcome"));

  async function submit() {
    if (busy || !ready) return;
    setBusy(true);
    setProblem(null);
    const r = await auth.signUp(name.trim(), email.trim(), password);
    setBusy(false);
    if (!r.ok) {
      setProblem(r.problem);
      if (r.problem === "weakPassword") passRef.current?.focus();
      return;
    }
    await kvSet(COMPANY_KEY, company.trim() || null);
    router.push({ pathname: "/verify", params: { email: email.trim() } });
  }

  const banner = notice ? BANNER[notice] : null;
  return (
    <Screen>
      <AuthHeader onBack={back} backLabel={t("auth.back")} />
      <AuthBody>
        <Section px={20} pt={22} gap={8}>
          <PageTitle>{t("signUp.title")}</PageTitle>
          <Text color="muted" leading={1.45}>{t("signUp.sub")}</Text>
        </Section>
        {notice && banner ? (
          <Section px={16} pt={18}>
            <Banner tone={banner.tone} icon={banner.icon} iconTone={banner.iconTone} lead={t(`signUp.banner.${notice}.lead`)}
              link={notice === "taken" || notice === "closed" ? t(`signUp.banner.${notice}.link`) : undefined}
              onLink={notice === "taken" ? () => router.replace({ pathname: "/sign-in", params: { email: email.trim() } }) : () => void Linking.openURL(ACCESS_REQUEST)}>
              {t(`signUp.banner.${notice}.text`)}
            </Banner>
          </Section>
        ) : null}
        <Section delay={60} px={16} pt={18}>
          <FormCard>
            <FormRow first icon="user" tone="violet" label={t("signUp.name")} value={name} onChangeText={setName}
              placeholder={t("signUp.namePlaceholder")} autoCapitalize="words" autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
            <FormRow ref={emailRef} icon="mail" tone="sky" label={taken ? t("signUp.emailTaken") : t("signUp.email")} invalid={taken} value={email}
              onChangeText={(v) => { setEmail(v); if (problem === "emailTaken") setProblem(null); }}
              placeholder={t("auth.emailPlaceholder")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
              returnKeyType="next" onSubmitEditing={() => passRef.current?.focus()} />
            <FormRow ref={passRef} icon="key" tone="violet" label={t("signUp.password")} invalid={weak} value={password}
              onChangeText={(v) => { setPassword(v); if (problem === "weakPassword") setProblem(null); }}
              placeholder={t("auth.passwordPlaceholder")} secureTextEntry={!shown} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword"
              returnKeyType="next" onSubmitEditing={() => companyRef.current?.focus()}
              trailing={<FieldButton glyph={shown ? "eyeOff" : "eye"} label={shown ? t("auth.hide") : t("auth.show")} selected={shown} onPress={() => setShown(!shown)} />} />
            <FormRow ref={companyRef} icon="building" tone="indigo" label={t("signUp.company")} value={company} onChangeText={setCompany}
              placeholder={t("signUp.companyPlaceholder")} autoComplete="organization" textContentType="organizationName" returnKeyType="go" onSubmitEditing={() => void submit()} />
          </FormCard>
          <SignUpMeter level={level} word={t(`signUp.strength.${level}.word`)} note={t(`signUp.strength.${level}.note`)} />
        </Section>
        <Section delay={100} px={16} pt={22} gap={14}>
          <Button size="lg" label={t("signUp.create")} busy={busy ? t("signUp.creating") : false} block disabled={!ready} onPress={() => void submit()} />
          <SignUpTerms lead={t("signUp.terms1")} terms={t("signUp.terms")} and={t("signUp.and")} privacy={t("signUp.privacy")}
            onTerms={() => void Linking.openURL(`${SITE}/terms`)} onPrivacy={() => void Linking.openURL(`${SITE}/privacy-policy`)} />
        </Section>
        <Spacer />
        <Section pt={14} align="center">
          <Stack row gap={4} align="center">
            <Text size={14.5} color="muted">{t("signUp.have")}</Text>
            <TextLink label={t("signUp.signIn")} size={14.5} weight={600} color="ink" onPress={() => router.replace("/sign-in")} />
          </Stack>
        </Section>
      </AuthBody>
    </Screen>
  );
}
