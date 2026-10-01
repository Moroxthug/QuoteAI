// ForgotPassword.dc.html: the steps are request, requestOffline, sent, newPassword, linkExpired, done.
// `newPassword` and `linkExpired` arrive from the emailed link (quoteai://forgot-password?token=…,
// or ?error=INVALID_TOKEN when the link is bad, used or expired); the rest follow the server's answers.
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { auth } from "@/lib/auth";
import { looksLikeEmail, mismatch, passwordRules, RESEND_SECONDS, rulesMet, startStep, type Step } from "@/lib/forgot";
import { useSession } from "@/lib/useSession";
import { AuthBody, FieldButton, TextLink } from "@/ui/Auth";
import { Button } from "@/ui/Button";
import { Banner } from "@/ui/Feedback";
import { FormCard, FormRow } from "@/ui/FormCard";
import { GlowOrb } from "@/ui/GlowOrb";
import { Icon } from "@/ui/Icon";
import { Header, PageTitle } from "@/ui/Header";
import { Section, Spacer, Stack } from "@/ui/Layout";
import { Card } from "@/ui/Card";
import { MenuRow } from "@/ui/Row";
import { PasswordRules } from "@/ui/PasswordRules";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const MARK = "\u0001";
type Problem = "offline" | "failed" | null;

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { refresh } = useSession();
  const params = useLocalSearchParams<{ token?: string; error?: string; email?: string }>();
  const start = startStep(params);
  const [step, setStep] = useState<Step>(start.step);
  const [expired, setExpired] = useState(start.expired);
  const [email, setEmail] = useState(params.email ?? "");
  const [problem, setProblem] = useState<Problem>(null);
  const [sending, setSending] = useState(false);
  const [sec, setSec] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [shown, setShown] = useState(false);
  const [saving, setSaving] = useState(false);

  // The link may arrive while the screen is already open (the app was in the background).
  useEffect(() => {
    if (params.token || params.error) {
      const s = startStep(params);
      setStep(s.step);
      setExpired(s.expired);
    }
  }, [params.token, params.error]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== "sent" || sec <= 0) return;
    const timer = setTimeout(() => setSec((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, sec]);

  const toSignIn = () => (router.canGoBack() ? router.back() : router.replace("/sign-in"));
  const toRequest = () => { setStep("request"); setExpired(false); setResent(false); setProblem(null); };

  async function send(again: boolean) {
    if (sending || !looksLikeEmail(email)) return;
    setSending(true);
    setProblem(null);
    const r = await auth.requestReset(email.trim());
    setSending(false);
    if (!r.ok) { setProblem(r.problem === "offline" ? "offline" : "failed"); return; }
    setSec(RESEND_SECONDS);
    setResent(again);
    setStep("sent");
  }

  async function save() {
    const token = params.token;
    if (saving || !token || !rulesMet(passwordRules(p1, p2))) return;
    setSaving(true);
    setProblem(null);
    const r = await auth.resetPassword(token, p1);
    setSaving(false);
    if (r.ok) { setStep("done"); return; }
    if (r.problem === "offline") setProblem("offline");
    else if (r.problem === "wrong" || r.problem === "expired") setExpired(true); // the link is used up or out of time
    else setProblem("failed");
  }

  // Every session was ended by the reset, so Continue lets the gate decide (Sign in; Home if it somehow stands).
  async function done() {
    await refresh();
    router.replace("/");
  }

  const rules = passwordRules(p1, p2);
  const bad = mismatch(p1, p2);
  const sentSub = t("forgot.sent.sub", { email: MARK }).split(MARK); // the address is set in ink 500, as on the board
  const onBack = step === "sent" ? toRequest : step === "done" ? undefined : toSignIn;
  const warnKey = problem === "offline" ? "forgot.request.offline" : "forgot.request.failed";
  const warn = problem ? { lead: t(`${warnKey}.lead`), text: t(`${warnKey}.text`) } : null;

  return (
    <Screen>
      <Header title="" backLabel={t("forgot.back")} onBack={onBack} />
      <AuthBody>
        {step === "request" ? (
          <>
            <Section px={20} pt={22}>
              <Text size={32} weight={600} tracking={-0.045} leading={1.1} accessibilityRole="header">{t("forgot.request.title")}</Text>
              <Stack pt={8}><Text color="muted" leading={1.45}>{t("forgot.request.sub")}</Text></Stack>
            </Section>
            {warn ? (
              <Section px={16} pt={18}>
                <Banner tone="warn" icon={problem === "offline" ? "cloud" : "warn"} iconTone="amber" lead={warn.lead}>{warn.text}</Banner>
              </Section>
            ) : null}
            <Section delay={60} px={16} pt={18}>
              <FormCard>
                <FormRow first icon="mail" tone="sky" label={t("forgot.request.email")} value={email} onChangeText={(v) => { setEmail(v); setProblem(null); }}
                  placeholder={t("auth.emailPlaceholder")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
                  returnKeyType="send" onSubmitEditing={() => void send(false)} />
              </FormCard>
            </Section>
            <Section delay={100} px={16} pt={20} gap={6} align="center">
              <Button size="lg" label={t("forgot.request.send")} busy={sending ? t("forgot.request.sending") : false} disabled={!looksLikeEmail(email)} block onPress={() => void send(false)} />
              <TextLink label={t("forgot.request.backToSignIn")} size={14.5} weight={400} color="muted" onPress={toSignIn} />
            </Section>
          </>
        ) : null}

        {step === "sent" ? (
          <>
            <Section pt={30} align="center"><GlowOrb glow="blue" icon="mail" tone="sky" /></Section>
            <Section delay={40} px={24} pt={26} gap={8} align="center">
              <Text size={28} weight={600} tracking={-0.04} align="center" accessibilityRole="header">{t("forgot.sent.title")}</Text>
              <Stack w={300}>
                <Text color="muted" leading={1.5} align="center">
                  {sentSub[0]}<Text weight={500} color="ink">{email.trim()}</Text>{sentSub[1]}
                </Text>
              </Stack>
            </Section>
            {resent ? (
              <Section px={16} pt={20}>
                <Banner tone="ok" icon="check" iconTone="sage" lead={t("forgot.sent.resent.lead")}>{t("forgot.sent.resent.text")}</Banner>
              </Section>
            ) : null}
            {warn ? (
              <Section px={16} pt={20}>
                <Banner tone="warn" icon={problem === "offline" ? "cloud" : "warn"} iconTone="amber" lead={warn.lead}>{warn.text}</Banner>
              </Section>
            ) : null}
            <Section delay={80} pt={18} align="center">
              {sec > 0 ? (
                <Stack pt={12} pb={12}>
                  <Text color="muted">{t("forgot.sent.wait", { sec })}</Text>
                </Stack>
              ) : (
                <TextLink label={t("forgot.sent.again")} size={14.5} weight={600} color="ink" onPress={() => void send(true)} />
              )}
              <Stack pt={10}><TextLink label={t("forgot.sent.other")} size={14.5} weight={400} color="muted" onPress={toRequest} /></Stack>
            </Section>
            <Spacer />
            <Section delay={120} px={16} pt={14} gap={14}>
              <Stack align="center"><Text size={13.5} color="muted">{t("forgot.sent.spam")}</Text></Stack>
              <Button size="lg" label={t("forgot.sent.openMail")} block onPress={() => { void Linking.openURL("mailto:").catch(() => undefined); }} />
            </Section>
          </>
        ) : null}

        {step === "newPassword" ? (
          <>
            <Section px={20} pt={22}>
              <PageTitle>{t("forgot.newPassword.title")}</PageTitle>
              {params.email ? <Stack pt={8}><Text color="muted" leading={1.45}>{t("forgot.newPassword.sub", { email: params.email })}</Text></Stack> : null}
            </Section>
            {expired ? (
              <Section px={16} pt={18}>
                <Banner tone="warn" icon="clock" iconTone="amber" lead={t("forgot.newPassword.expired.lead")} link={t("forgot.newPassword.expired.link")} onLink={toRequest} />
              </Section>
            ) : null}
            {warn && !expired ? (
              <Section px={16} pt={18}>
                <Banner tone="warn" icon={problem === "offline" ? "cloud" : "warn"} iconTone="amber" lead={warn.lead}>{warn.text}</Banner>
              </Section>
            ) : null}
            <Section delay={60} px={16} pt={18}>
              <FormCard>
                <FormRow first icon="key" tone="violet" label={t("forgot.newPassword.password")} value={p1} onChangeText={(v) => { setP1(v); setProblem(null); }}
                  placeholder={t("forgot.newPassword.passwordPlaceholder")} secureTextEntry={!shown} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword"
                  trailing={<FieldButton glyph={shown ? "eyeOff" : "eye"} label={shown ? t("forgot.newPassword.hide") : t("forgot.newPassword.show")} selected={shown} onPress={() => setShown(!shown)} />} />
                <FormRow icon="lock" tone="indigo" label={bad ? t("forgot.newPassword.confirmMismatch") : t("forgot.newPassword.confirm")} invalid={bad} value={p2} onChangeText={(v) => { setP2(v); setProblem(null); }}
                  placeholder={t("forgot.newPassword.confirmPlaceholder")} secureTextEntry={!shown} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword"
                  returnKeyType="go" onSubmitEditing={() => void save()} />
              </FormCard>
            </Section>
            <Section delay={100} px={16} pt={16}>
              <PasswordRules rules={[
                { on: rules.length, label: t("forgot.newPassword.rules.length"), state: rules.length ? t("forgot.newPassword.rules.done") : t("forgot.newPassword.rules.todo") },
                { on: rules.mix, label: t("forgot.newPassword.rules.mix"), state: rules.mix ? t("forgot.newPassword.rules.done") : t("forgot.newPassword.rules.todo") },
                { on: rules.match, label: t("forgot.newPassword.rules.match"), state: rules.match ? t("forgot.newPassword.rules.done") : t("forgot.newPassword.rules.todo") },
              ]} />
            </Section>
            <Spacer />
            <Section delay={140} px={16} pt={20} gap={14}>
              <Stack align="center"><Text size={13.5} color="muted" align="center">{t("forgot.newPassword.signedOut")}</Text></Stack>
              <Button size="lg" label={t("forgot.newPassword.save")} busy={saving ? t("forgot.newPassword.saving") : false} disabled={!rulesMet(rules) || expired || !params.token} block onPress={() => void save()} />
            </Section>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <Section pt={30} align="center"><GlowOrb glow="green" icon="check" tone="sage" /></Section>
            <Section delay={40} px={24} pt={26} gap={8} align="center">
              <Text size={28} weight={600} tracking={-0.04} align="center" accessibilityRole="header">{t("forgot.done.title")}</Text>
              <Stack w={300}><Text color="muted" leading={1.5} align="center">{t("forgot.done.sub")}</Text></Stack>
            </Section>
            <Section delay={80} px={16} pt={28}>
              <Card>
                <MenuRow icon={<Icon name="shield" tone="indigo" size={26} />} title={t("forgot.done.security.title")} sub={t("forgot.done.security.sub")}
                  onPress={() => router.push({ pathname: "/coming-soon", params: { title: t("forgot.done.security.screen") } })} />
              </Card>
            </Section>
            <Spacer />
            <Section delay={120} px={16} pt={20}>
              <Button size="lg" label={t("forgot.done.continue")} block onPress={() => void done()} />
            </Section>
          </>
        ) : null}
      </AuthBody>
    </Screen>
  );
}
