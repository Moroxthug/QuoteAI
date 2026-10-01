// TwoStep.dc.html: the states are default, wrong, locked, backup, verified. They all come from the
// server's answers to the code (or backup code) typed after a sign-in that said `twoStep`.
// The board's text-message / email methods and its "Trust this phone" switch are not built: the
// server's second step is the authenticator app's code or a backup code, and "trust this device"
// is a cookie the app's session layer does not keep (see the phase 124 report).
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { auth } from "@/lib/auth";
import { backupComplete, cleanCode, CODE_LENGTH, formatBackup, MAX_TRIES, outcomeOf, triesAfterWrong, type Outcome } from "@/lib/twoStep";
import { useSession } from "@/lib/useSession";
import { AuthBody, TextLink } from "@/ui/Auth";
import { Button, Spinner } from "@/ui/Button";
import { RadioDot } from "@/ui/Check";
import { Banner } from "@/ui/Feedback";
import { FormCard, FormRow } from "@/ui/FormCard";
import { GlowOrb } from "@/ui/GlowOrb";
import { Glyph, Icon } from "@/ui/Icon";
import { Header } from "@/ui/Header";
import { Section, Spacer, Stack } from "@/ui/Layout";
import { ListRow } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";
import { TwoStepCode, type CodeState } from "@/ui/TwoStepCode";

type Mode = "app" | "backup";
const isBackupMode = (m: Mode) => m === "backup";
type Status = "typing" | "checking" | "wrong" | "ok" | "locked";

export default function TwoStep() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { refresh } = useSession();
  const [mode, setMode] = useState<Mode>("app");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState("");
  const [status, setStatus] = useState<Status>("typing");
  const [tries, setTries] = useState(MAX_TRIES);
  const [problem, setProblem] = useState<Extract<Outcome, "offline" | "ended" | "failed"> | null>(null);
  const [sheet, setSheet] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/sign-in"));
  const toHome = () => router.replace("/");
  const ok = status === "ok";
  const locked = status === "locked";

  // The board's "Taking you to your home screen": Continue is there at once, and it goes by itself.
  useEffect(() => {
    if (!ok) return;
    const timer = setTimeout(toHome, 1400);
    return () => clearTimeout(timer);
  }, [ok]);

  // The wrong code stays in the red boxes for a moment (the shake), then the field is ready for the next try.
  useEffect(() => {
    if (status !== "wrong" || isBackupMode(mode)) return;
    const timer = setTimeout(() => setCode(""), 1200);
    return () => clearTimeout(timer);
  }, [status, mode]);

  async function verify(kind: Mode, value: string) {
    setStatus("checking");
    setProblem(null);
    const r = kind === "app" ? await auth.verifyTotp(value) : await auth.verifyBackupCode(value);
    const outcome = outcomeOf(r);
    if (outcome === "ok") {
      await refresh();
      setStatus("ok");
    } else if (outcome === "wrong") {
      const left = triesAfterWrong(tries);
      setTries(left);
      if (left === 0 && kind === "app") { setCode(""); setStatus("locked"); } else setStatus("wrong");
    } else if (outcome === "locked") {
      setCode("");
      setStatus("locked");
    } else {
      setStatus("typing");
      setProblem(outcome === "ended" || outcome === "offline" ? outcome : "failed");
    }
  }

  function onCode(next: string) {
    const c = cleanCode(next);
    setCode(c);
    setProblem(null);
    if (c.length === CODE_LENGTH) void verify("app", c);
    else if (status === "wrong") setStatus("typing");
  }


  function pick(next: Mode) {
    setMode(next);
    setSheet(false);
    setCode("");
    setBackup("");
    setProblem(null);
    if (status !== "ok") setStatus(next === "app" && locked ? "locked" : "typing");
  }

  const isBackup = mode === "backup";
  const codeState: CodeState = status === "checking" || (status === "wrong" && !code) ? "typing" : status;
  const sub = ok ? t("twoStep.subDone") : isBackup ? t("twoStep.subBackup") : t("twoStep.subApp");
  const busy = status === "checking";
  const ended = problem === "ended";
  const lockedHere = locked && !isBackup;

  return (
    <Screen>
      <Header title="" backLabel={t("auth.back")} onBack={back} />
      <AuthBody>
        <Section pt={22} align="center">
          <GlowOrb glow="violet" icon={ok ? "check" : lockedHere ? "lock" : isBackup ? "key" : "shield"} tone={ok ? "sage" : lockedHere ? "clay" : "violet"} />
        </Section>
        <Section delay={40} px={24} pt={26} gap={8} align="center">
          <Text size={28} weight={600} tracking={-0.04} align="center" accessibilityRole="header">{ok ? t("twoStep.titleDone") : t("twoStep.title")}</Text>
          <Stack w={300}><Text color="muted" leading={1.5} align="center">{sub}</Text></Stack>
        </Section>
        {isBackup ? (
          <Section px={16} pt={28}>
            <FormCard error={status === "wrong"}>
              <FormRow first icon="key" tone="violet" label={t("twoStep.backupLabel")} value={backup} numeric invalid={status === "wrong"}
                onChangeText={(v) => { setBackup(formatBackup(v)); if (status === "wrong") setStatus("typing"); setProblem(null); }}
                placeholder={t("twoStep.backupPlaceholder")} autoCapitalize="none" autoCorrect={false} autoComplete="off" disabled={busy || ok}
                onSubmitEditing={() => { if (backupComplete(backup)) void verify("backup", backup); }} returnKeyType="go" />
            </FormCard>
          </Section>
        ) : (
          <Section delay={80} px={20} pt={28}>
            <TwoStepCode label={t("twoStep.codeLabel")} value={code} onChange={onCode} state={codeState} disabled={busy || ok || ended} autoFocus />
          </Section>
        )}
        <Section pt={14} px={20}>
          <Stack h={44} row gap={8} align="center" justify="center">
            {busy ? (
              <>
                <Spinner color={colors.ink} />
                <Text size={13.5} color="muted">{t("twoStep.checking")}</Text>
              </>
            ) : null}
            {status === "wrong" ? (
              <>
                <Glyph name="alert" size={16} color="bad" />
                <Text size={13.5} leading={1.4} color="bad" accessibilityRole="alert" style={{ flexShrink: 1 }}>
                  <Text size={13.5} weight={600} color="bad">{t("twoStep.wrong.lead")}</Text>
                  {isBackup ? "" : ` ${t("twoStep.wrong.tries", { count: tries })}`}
                </Text>
              </>
            ) : null}
            {ok ? (
              <>
                <Glyph name="check" size={16} color="ok" weight={2.4} />
                <Text size={13.5} weight={600} color="ok" accessibilityLiveRegion="polite">{t("twoStep.done")}</Text>
              </>
            ) : null}
          </Stack>
        </Section>
        {lockedHere ? (
          <Section px={16}>
            <Banner tone="bad" icon="lock" iconTone="clay" lead={t("twoStep.locked.lead")}>{t("twoStep.locked.text")}</Banner>
          </Section>
        ) : null}
        {problem === "offline" || problem === "failed" ? (
          <Section px={16}>
            <Banner tone="warn" icon={problem === "offline" ? "cloud" : "warn"} iconTone="amber"
              lead={t(`signIn.banner.${problem}.lead`)}>{t(`signIn.banner.${problem}.text`)}</Banner>
          </Section>
        ) : null}
        {ended ? (
          <Section px={16}>
            <Banner tone="warn" icon="clock" iconTone="amber" lead={t("twoStep.ended.lead")} link={t("twoStep.ended.link")}
              onLink={() => router.replace("/sign-in")}>{t("twoStep.ended.text")}</Banner>
          </Section>
        ) : null}
        <Section delay={120} pt={6} align="center">
          {!ok ? <TextLink label={t("twoStep.other")} size={14.5} weight={400} color="muted" onPress={() => setSheet(true)} /> : null}
        </Section>
        <Spacer />
        <Section delay={160} px={16} pt={14}>
          {ok ? <Button size="lg" label={t("twoStep.continue")} block onPress={toHome} /> : null}
          {isBackup && !ok ? (
            <Button size="lg" label={t("twoStep.useBackup")} block disabled={!backupComplete(backup) || busy || ended}
              busy={busy ? t("twoStep.checking") : false} onPress={() => void verify("backup", backup)} />
          ) : null}
        </Section>
      </AuthBody>
      <Sheet open={sheet} onClose={() => setSheet(false)} label={t("twoStep.sheet.title")} closeLabel={t("twoStep.sheet.close")}>
        <Section px={20} pt={4} pb={10}>
          <Text size={19} weight={600} accessibilityRole="header">{t("twoStep.sheet.title")}</Text>
        </Section>
        <Stack px={12}>
          <ListRow title={t("twoStep.sheet.app.name")} meta={t("twoStep.sheet.app.sub")} onPress={() => pick("app")}
            accessibilityLabel={`${t("twoStep.sheet.app.name")}. ${t("twoStep.sheet.app.sub")}`}
            leading={<Icon name="phone" tone="teal" size={26} />} trailing={<RadioDot on={!isBackup} />} />
          <ListRow title={t("twoStep.sheet.backup.name")} meta={t("twoStep.sheet.backup.sub")} onPress={() => pick("backup")}
            accessibilityLabel={`${t("twoStep.sheet.backup.name")}. ${t("twoStep.sheet.backup.sub")}`}
            leading={<Icon name="key" tone="violet" size={26} />} trailing={<RadioDot on={isBackup} />} />
        </Stack>
        <Spacer h={16} />
      </Sheet>
    </Screen>
  );
}
