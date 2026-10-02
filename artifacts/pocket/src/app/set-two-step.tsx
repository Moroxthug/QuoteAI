// Two-step verification, from Settings → Security (the Security board's "Set up two-step" and "Backup codes" rows). The board does not draw this flow, so it is built only from the settings kit: the owner
// confirms the password, adds the key to an authenticator app (or taps to open it on this phone), keeps the backup codes, and confirms the first 6-digit code. When it is on: new backup codes, or turn it off.
// better-auth's two-factor routes do the work (POST /api/auth/two-factor/*); nothing here is stored by the app.
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auth, type AuthProblem } from "@/lib/auth";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Banner, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { SetField, SetGroup, SetRow } from "@/ui/Settings";
import { InlineBanner, SetTitle } from "@/ui/SettingsPages";

type Step = "ask" | "key" | "manage";

export default function SetTwoStep() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sy.two.${k}`, o) as string;
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const devicesQ = useQuery({ queryKey: ["auth-devices"], queryFn: async () => { const r = await auth.devices(); return r.ok ? r.data : null; }, enabled: status === "in", retry: 0 });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [key, setKey] = useState<{ uri: string; secret: string; codes: string[] } | null>(null);
  const [fresh, setFresh] = useState<string[] | null>(null);
  if (status === "out") return <Redirect href="/" />;

  const on = !!devicesQ.data?.twoStep;
  const where: Step = step ?? (on ? "manage" : "ask");
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SetSecurity", t("title"))));
  const say = (p: AuthProblem) => setProblem(t(`problems.${p === "offline" ? "offline" : p === "wrong" || p === "locked" ? "wrong" : "failed"}`));
  const refresh = () => { void client.invalidateQueries({ queryKey: ["auth-devices"] }); void devicesQ.refetch(); };

  const start = async () => {
    if (!password) { setProblem(t("needPassword")); return; }
    setBusy(true); setProblem(null);
    const r = await auth.twoStepEnable(password);
    setBusy(false);
    if (!r.ok) { say(r.problem); return; }
    setKey({ uri: r.data.uri, secret: /secret=([^&]+)/.exec(r.data.uri)?.[1] ?? "", codes: r.data.codes });
    setPassword("");
    setStep("key");
  };
  const confirm = async () => {
    setBusy(true); setProblem(null);
    const r = await auth.verifyTotp(code.replace(/\s+/g, ""));
    setBusy(false);
    if (!r.ok) { say(r.problem); return; }
    setCode(""); setKey(null); setStep("manage"); refresh(); toast({ message: t("done") });
  };
  const turnOff = async () => {
    if (!password) { setProblem(t("needPassword")); return; }
    setBusy(true); setProblem(null);
    const r = await auth.twoStepDisable(password);
    setBusy(false);
    if (!r.ok) { say(r.problem); return; }
    setPassword(""); setFresh(null); setStep("ask"); refresh(); toast({ message: t("offDone") });
  };
  const newCodes = async () => {
    if (!password) { setProblem(t("needPassword")); return; }
    setBusy(true); setProblem(null);
    const r = await auth.twoStepCodes(password);
    setBusy(false);
    if (!r.ok) { say(r.problem); return; }
    setPassword(""); setFresh(r.data.codes);
  };
  const copy = async (text: string) => { await Clipboard.setStringAsync(text); toast({ message: t("copied") }); };

  const codes = key?.codes ?? fresh ?? null;

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={on ? t("on.lead") : t("off.lead")} />
        {problem ? <InlineBanner><Banner tone="bad" icon="warn" iconTone="rose" lead={problem} /></InlineBanner> : null}
        {devicesQ.isPending ? (
          <Section pt={16} px={16}><Skeleton height={160} radius={22} /></Section>
        ) : where === "ask" ? (
          <Section pt={16} px={16} gap={14}>
            <InlineBanner><Banner tone="info" icon="shield" iconTone="indigo" lead={t("off.lead")}>{t("off.body")}</Banner></InlineBanner>
            <SetGroup><SetField first icon="key" tone="violet" label={t("password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" /></SetGroup>
            <Button size="lg" block label={t("start")} onPress={() => void start()} disabled={busy} />
          </Section>
        ) : where === "key" && key ? (
          <Section pt={16} px={16} gap={14}>
            <SetGroup title={t("keyTitle")} foot={t("keyBody")}>
              <SetRow first icon="key" tone="indigo" label={t("key")} sub={key.secret} onPress={() => void copy(key.secret)} />
              <SetRow icon="shield" tone="violet" label={t("open")} onPress={() => void Linking.openURL(key.uri)} />
            </SetGroup>
            <SetGroup title={t("codesTitle")} foot={t("codesBody")}>
              {key.codes.map((c, i) => <SetRow key={c} first={i === 0} icon="list" tone="stone" label={c} onPress={() => void copy(key.codes.join("\n"))} />)}
            </SetGroup>
            <SetGroup title={t("confirmTitle")}><SetField first icon="shield" tone="indigo" label={t("code")} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" mono /></SetGroup>
            <Button size="lg" block label={t("confirm")} onPress={() => void confirm()} disabled={busy || code.replace(/\s+/g, "").length < 6} />
          </Section>
        ) : (
          <Section pt={16} px={16} gap={14}>
            <InlineBanner><Banner tone="ok" icon="check" iconTone="sage" lead={t("on.lead")}>{t("on.body")}</Banner></InlineBanner>
            <SetGroup foot={t("newCodesNote")}><SetField first icon="key" tone="violet" label={t("password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" /></SetGroup>
            {codes ? (
              <SetGroup title={t("codesTitle")} foot={t("codesBody")}>
                {codes.map((c, i) => <SetRow key={c} first={i === 0} icon="list" tone="stone" label={c} onPress={() => void copy(codes.join("\n"))} />)}
              </SetGroup>
            ) : null}
            <Button size="lg" block kind="secondary" label={t("newCodes")} onPress={() => void newCodes()} disabled={busy} />
            <Button size="lg" block kind="secondary" label={t("turnOff")} onPress={() => void turnOff()} disabled={busy} />
          </Section>
        )}
      </ScrollPage>
    </Screen>
  );
}
