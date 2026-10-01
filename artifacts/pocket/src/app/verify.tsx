// Verify.dc.html: the states are empty, typing, wrong, locked, verified (plus "checking" between
// the sixth digit and the answer). The phone confirms the address with a 6-digit code, not a link:
// the first code is sent when this screen opens (the API sends no email for the app on sign-up),
// and the server signs the person in when the code is right.
import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { auth } from "@/lib/auth";
import { getToken } from "@/lib/session";
import { useSession } from "@/lib/useSession";
import { ALLOWED_ATTEMPTS, RESEND_SECONDS, triesLeft } from "@/lib/verifyCode";
import { AuthBody } from "@/ui/Auth";
import { Button } from "@/ui/Button";
import { Banner, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { Section } from "@/ui/Layout";
import { Spacer } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { VerifyCode, type VerifyCodeState } from "@/ui/VerifyCode";
import { VerifyOrb } from "@/ui/VerifyOrb";
import { VerifyLink, VerifyMessage, VerifyOk, VerifyWait } from "@/ui/VerifyParts";

type Line = "offline" | "failed" | "expired" | null;

export default function Verify() {
  const { t } = useTranslation();
  const toast = useToast();
  const { refresh } = useSession();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = (params.email ?? "").trim();

  const [code, setCode] = useState("");
  const [state, setState] = useState<VerifyCodeState>("typing");
  const [wrongCount, setWrongCount] = useState(0);
  const [shake, setShake] = useState(0);
  const [sec, setSec] = useState(RESEND_SECONDS);
  const [line, setLine] = useState<Line>(null);
  const [signedIn, setSignedIn] = useState(true);
  const sentFirst = useRef(false);
  const left = useRef(false);

  const toApp = useCallback((ok: boolean) => {
    if (left.current) return;
    left.current = true;
    if (ok) router.replace("/");
    else router.replace({ pathname: "/sign-in", params: { email } });
  }, [email]);

  // The first code, when the screen opens.
  useEffect(() => {
    if (!email) { router.replace("/sign-up"); return; }
    if (sentFirst.current) return;
    sentFirst.current = true;
    void auth.sendCode(email);
  }, [email]);

  useEffect(() => {
    if (sec <= 0) return;
    const id = setTimeout(() => setSec((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [sec]);

  async function check(otp: string) {
    setState("checking");
    setLine(null);
    const r = await auth.verifyEmail(email, otp);
    if (r.ok) {
      setState("ok");
      await refresh();
      const ok = !!(await getToken());
      setSignedIn(ok);
      setTimeout(() => toApp(ok), 1400);
      return;
    }
    switch (r.problem) {
      case "locked":
        setState("locked"); setCode(""); setSec(0); return;
      case "offline":
        setState("typing"); setCode(""); setLine("offline"); return;
      case "expired":
        setState("typing"); setCode(""); setLine("expired"); return;
      case "failed":
        setState("typing"); setCode(""); setLine("failed"); return;
      default: {
        const n = wrongCount + 1;
        setWrongCount(n);
        if (n >= ALLOWED_ATTEMPTS) { setState("locked"); setCode(""); setSec(0); return; }
        setState("wrong");
        setShake((k) => k + 1);
      }
    }
  }

  function onChange(v: string) {
    if (state === "checking" || state === "ok" || state === "locked") return;
    setCode(v);
    setLine(null);
    if (v.length === 6) void check(v);
    else setState("typing");
  }

  async function resend() {
    setSec(RESEND_SECONDS);
    setCode("");
    setLine(null);
    const r = await auth.sendCode(email);
    if (!r.ok && r.problem === "offline") { setLine("offline"); setSec(0); return; }
    setWrongCount(0);
    setState("typing");
    toast({ message: t("verify.resent") });
  }

  const verified = state === "ok";
  const locked = state === "locked";
  const back = () => (router.canGoBack() ? router.back() : router.replace("/sign-in"));

  const sub = t(verified ? "verify.subVerified" : "verify.sub", { email, interpolation: { escapeValue: false } });
  const at = verified ? -1 : sub.indexOf(email);

  return (
    <Screen>
      <Header title="" onBack={back} backLabel={t("auth.back")} />
      <AuthBody>
        <Section pt={30} align="center">
          <VerifyOrb icon={verified ? "check" : locked ? "lock" : "mail"} tone={verified ? "sage" : locked ? "clay" : "sky"} />
        </Section>
        <Section delay={40} px={24} pt={26} align="center" gap={8}>
          <Text size={28} weight={600} tracking={-0.04} align="center" accessibilityRole="header">{t(verified ? "verify.titleVerified" : "verify.title")}</Text>
          <Text color="muted" leading={1.5} align="center" style={{ maxWidth: 300 }}>
            {at >= 0 ? sub.slice(0, at) : sub}
            {at >= 0 ? <Text weight={500}>{email}</Text> : null}
            {at >= 0 ? sub.slice(at + email.length) : null}
          </Text>
        </Section>
        <Section delay={80} px={20} pt={30}>
          <VerifyCode label={t("verify.codeLabel")} value={code} onChange={onChange} state={state} shakeKey={shake} />
          <VerifyMessage>
            {state === "checking" ? (
              <Text size={13.5} color="muted" accessibilityLiveRegion="polite">{t("verify.checking")}</Text>
            ) : state === "wrong" ? (
              <Text size={13.5} leading={1.4} color="bad" accessibilityRole="alert"><Text size={13.5} weight={600} color="bad">{t("verify.wrongLead")}</Text>{` ${t("verify.wrongTries", { count: triesLeft(wrongCount) })}`}</Text>
            ) : verified ? (
              <VerifyOk label={t("verify.verified")} />
            ) : line ? (
              <Text size={13.5} leading={1.4} color="warn" align="center" accessibilityRole="alert">{t(`verify.${line}`)}</Text>
            ) : null}
          </VerifyMessage>
          {locked ? (
            <Banner tone="bad" icon="lock" iconTone="clay" lead={t("verify.lockedLead")}>{t("verify.lockedText")}</Banner>
          ) : null}
        </Section>
        {!verified ? (
          <Section delay={120} pt={6} align="center">
            {sec > 0 ? <VerifyWait label={t("verify.wait", { sec })} /> : <VerifyLink strong color="ink" label={t("verify.resend")} onPress={() => void resend()} />}
            <VerifyLink role="link" label={t("verify.different")} onPress={() => router.replace("/welcome")} />
          </Section>
        ) : null}
        <Spacer />
        {verified ? (
          <Section px={20} pb={14}>
            <Button size="lg" label={t("verify.continue")} block onPress={() => toApp(signedIn)} />
          </Section>
        ) : null}
      </AuthBody>
    </Screen>
  );
}
