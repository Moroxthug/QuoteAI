// JoinCode.dc.html: the states are empty, typing, invalid, crew and foreman.
// empty / typing: the boxes fill as the code is typed; invalid: the server said no (the row shakes);
// crew / foreman: the server found the code (team.previewCode) and says which company and role.
// Joining needs an account (team.redeemCode is signed-in only): signed out, the choices are "Create account
// and join" / "I already have an account", and the code rides along in ?code= (and in lib/joinCodeDevice).
import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ApiFailure, team, type CodePreviewDto } from "@/lib/api";
import { cleanCode, codeProblem, formatCode, isCodeComplete, kindForRole, type CodeProblem } from "@/lib/joinCode";
import { readClipboardText, savePendingJoinCode } from "@/lib/joinCodeDevice";
import { setActiveOrg } from "@/lib/session";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Card, Hairline } from "@/ui/Card";
import { CanList, CompanyTile } from "@/ui/Company";
import { Banner } from "@/ui/Feedback";
import { Glyph, Icon } from "@/ui/Icon";
import { Header } from "@/ui/Header";
import { JoinBoxes } from "@/ui/JoinBoxes";
import { JoinOrb, LookupSpinner, PasteButton } from "@/ui/JoinOrb";
import { Section, Spacer, Stack } from "@/ui/Layout";
import { AuthBody, TextLink } from "@/ui/Auth";
import { Screen } from "@/ui/Screen";
import { Tag } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";

type Phase = "typing" | "checking" | "bad" | "found";

export default function JoinCode() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { status, user, refresh, signOut } = useSession();
  const params = useLocalSearchParams<{ code?: string }>();
  const first = cleanCode(params.code);
  const [code, setCode] = useState(first);
  const [phase, setPhase] = useState<Phase>("typing");
  const [problem, setProblem] = useState<CodeProblem | null>(null);
  const [preview, setPreview] = useState<CodePreviewDto | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [joining, setJoining] = useState(false);
  const [joinProblem, setJoinProblem] = useState<CodeProblem | null>(null);
  const latest = useRef("");
  // Typing can outrun a render (a paste, a fast keyboard): the screen reads these, not the state.
  const typed = useRef({ code: first, bad: false });

  const lookup = useCallback(async (c: string) => {
    latest.current = c;
    setPhase("checking");
    setProblem(null);
    try {
      const found = await team.previewCode(c);
      if (latest.current !== c) return;
      setPreview(found);
      setPhase("found");
    } catch (e) {
      if (latest.current !== c) return;
      const p = e instanceof ApiFailure ? codeProblem(e) : "failed";
      setProblem(p);
      if (p === "offline" || p === "failed") { setPhase("typing"); return; }
      typed.current.bad = true;
      setPhase("bad");
      setShakeKey((n) => n + 1);
    }
  }, []);

  // Opened with a code (a link, or back from signing in): look it up at once.
  useEffect(() => {
    if (isCodeComplete(first)) void lookup(first);
  }, [first, lookup]);

  function onChange(raw: string) {
    // After a refused code the next keystroke starts over (the board empties the input).
    const was = typed.current;
    const next = was.bad && raw.toUpperCase().startsWith(was.code) ? cleanCode(raw.slice(was.code.length)) : cleanCode(raw);
    typed.current = { code: next, bad: false };
    setCode(next);
    setProblem(null);
    if (isCodeComplete(next)) void lookup(next);
    else { latest.current = ""; setPhase("typing"); }
  }

  async function paste() {
    const text = await readClipboardText();
    const c = cleanCode(text);
    if (c) onChange(c);
  }

  function reset() {
    latest.current = "";
    typed.current = { code: "", bad: false };
    setCode("");
    setPreview(null);
    setProblem(null);
    setJoinProblem(null);
    setPhase("typing");
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace("/welcome"));
  const signedIn = (status === "in" || status === "offline") && !!user;

  async function toAccount(path: "/sign-up" | "/sign-in") {
    await savePendingJoinCode(code);
    router.push({ pathname: path, params: { code } });
  }

  async function join() {
    if (!preview || joining) return;
    setJoining(true);
    setJoinProblem(null);
    try {
      const r = await team.redeemCode(code);
      await setActiveOrg(r.orgId);
      client.clear();
      await savePendingJoinCode("");
      await refresh();
      // A foreman lands on their Home; the other roles on the ordinary Home. (A crew worker has no account: they pair with the six-character crew code.)
      router.replace(kindForRole(r.role) === "foreman" ? "/foreman-home" : "/home");
    } catch (e) {
      setJoining(false);
      const p = e instanceof ApiFailure ? codeProblem(e) : "failed";
      if (p === "member") { await refresh(); client.clear(); router.replace("/"); return; }
      setJoinProblem(p);
    }
  }

  if (phase === "found" && preview) {
    const kind = kindForRole(preview.role);
    const company = preview.companyName || t("joinCode.found.yourTeam");
    const banner = joinProblem;
    return (
      <Screen>
        <Header title="" onBack={reset} backLabel={t("joinCode.back")} />
        <AuthBody>
          <Section px={20} pt={18} gap={8}>
            <Text size={28} weight={600} tracking={-0.04} leading={1.15} accessibilityRole="header">{t("joinCode.found.title")}</Text>
            <Text color="muted" leading={1.45}>{t("joinCode.found.code")} <Num size={15} weight={400} color="ink">{formatCode(preview.code || code)}</Num></Text>
          </Section>
          {banner ? (
            <Section px={16} pt={16}>
              <Banner tone={banner === "offline" || banner === "failed" ? "warn" : "bad"} icon={banner === "offline" ? "cloud" : "warn"} iconTone={banner === "offline" || banner === "failed" ? "amber" : "rose"}
                lead={t(`joinCode.problem.${banner}.lead`)}>{t(`joinCode.problem.${banner}.text`)}</Banner>
            </Section>
          ) : null}
          <Section delay={60} px={16} pt={20}>
            <Card>
              <Stack px={18} pt={20} pb={18}>
              <Stack row align="center" gap={14}>
                <CompanyTile size={48} />
                <Text size={17} weight={600} tracking={-0.02} numberOfLines={2} style={{ flexShrink: 1 }}>{company}</Text>
              </Stack>
              <Stack pt={16} pb={14}><Hairline inset={0} /></Stack>
              <Stack row align="center" justify="space-between" gap={12}>
                <Text size={13.5} color="muted">{t("joinCode.found.joinAs")}</Text>
                <Tag accent={kind === "foreman"}>{t(`joinCode.role.${kind}`)}</Tag>
              </Stack>
              <Stack mt={14}><CanList items={t(`joinCode.can.${kind}`, { returnObjects: true }) as unknown as string[]} /></Stack>
              </Stack>
            </Card>
          </Section>
          {kind === "crew" && signedIn ? (
            <Section delay={100} px={16} pt={12}>
              <Card>
                <Stack row align="center" gap={12} px={16} pt={12} pb={12}>
                  <Icon name="user" tone="sage" size={26} />
                  <Stack grow gap={2}>
                    <Text size={12.5} color="muted" numberOfLines={1}>{t("joinCode.found.nameOnList")}</Text>
                    <Text size={16} numberOfLines={1}>{user?.name || user?.email || ""}</Text>
                  </Stack>
                  <Button size="sm" kind="secondary" label={t("joinCode.found.notMe")} onPress={() => void signOut()} />
                </Stack>
              </Card>
            </Section>
          ) : null}
          {kind === "foreman" ? (
            <Section delay={100} px={16} pt={12}>
              <Banner tone="info" icon="key" iconTone="azure" lead={t("joinCode.found.foremanLead")}>{t("joinCode.found.foremanText")}</Banner>
            </Section>
          ) : null}
          <Spacer />
          <Section delay={140} px={16} pt={24} align="center" gap={4}>
            {signedIn ? (
              <>
                <Button size="lg" block label={t("joinCode.found.join", { company })} busy={joining ? t("joinCode.found.joining") : false} onPress={() => void join()} />
                {kind === "crew" ? <Stack pt={12}><Text size={12.5} color="muted" align="center">{t("joinCode.found.noPassword")}</Text></Stack> : null}
              </>
            ) : (
              <>
                <Button size="lg" block label={t("joinCode.found.createJoin")} disabled={status === "loading"} onPress={() => void toAccount("/sign-up")} />
                <Stack pt={8}><TextLink label={t("joinCode.found.haveAccount")} color="muted" size={14.5} weight={400} onPress={() => void toAccount("/sign-in")} /></Stack>
              </>
            )}
          </Section>
        </AuthBody>
      </Screen>
    );
  }

  const boxesState = phase === "checking" ? "checking" : phase === "bad" ? "bad" : "typing";
  const msg = phase === "checking" ? "looking" : problem;
  return (
    <Screen>
      <Header title="" onBack={back} backLabel={t("joinCode.back")} />
      <AuthBody>
        <Section pt={22} align="center"><JoinOrb /></Section>
        <Section delay={40} px={24} pt={26} gap={8} align="center">
          <Text size={28} weight={600} tracking={-0.04} align="center" accessibilityRole="header">{t("joinCode.title")}</Text>
          <Text color="muted" leading={1.5} align="center">{t("joinCode.sub")}</Text>
        </Section>
        <Section delay={80} px={20} pt={28}>
          <JoinBoxes label={t("joinCode.codeLabel")} value={code} onChange={onChange} state={boxesState} shakeKey={shakeKey} autoFocus />
          <Stack align="center" justify="center" pt={14} h={58}>
            {msg === "looking" ? (
              <Stack row align="center" gap={8}><LookupSpinner /><Text size={13.5} color="muted">{t("joinCode.looking")}</Text></Stack>
            ) : msg ? (
              <Stack row align="center" gap={8} justify="center">
                <Glyph name="alert" size={16} color="bad" />
                <Text size={13.5} leading={1.4} color="bad" accessibilityRole="alert" style={{ flexShrink: 1 }}>
                  <Text size={13.5} leading={1.4} weight={600} color="bad">{t(`joinCode.problem.${msg}.lead`)}</Text>{` ${t(`joinCode.problem.${msg}.text`)}`}
                </Text>
              </Stack>
            ) : null}
          </Stack>
        </Section>
        <Section delay={120} align="center">
          <PasteButton label={t("joinCode.paste")} onPress={() => void paste()} />
        </Section>
        <Spacer />
        <Section delay={160} pt={24} align="center">
          <Stack row align="center" gap={4}>
            <Text size={14.5} color="muted">{t("joinCode.emailInvite")}</Text>
            <TextLink label={t("joinCode.signIn")} size={14.5} weight={600} color="ink" onPress={() => router.push("/sign-in")} />
          </Stack>
          <Stack pt={10}><TextLink label={t("crew.pair.link")} size={14.5} weight={600} color="ink" onPress={() => router.push("/crew-pair")} /></Stack>
        </Section>
      </AuthBody>
    </Screen>
  );
}
