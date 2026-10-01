// Pairing a crew phone (not on a board: CrewExpired's "join with a code" is its sibling). The worker types the six characters the admin made for them under Team; the screen
// says who the code is for and which company ("Hello Amara, you're joining Rossi Renovations") and "Join" keeps this phone paired: no email, no password. A code works once
// and lasts a week; one that doesn't say why (wrong, expired, no signal).
import { useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ApiFailure } from "@/lib/api";
import { crewApi, type PairingPreview } from "@/lib/crewApi";
import { cleanPairing, formatPairing, PAIR_LENGTH } from "@/lib/crewPair";
import { pairCrewPhone } from "@/lib/crewSession";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { CodeField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { Section, ScrollPage, Spacer, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

export default function CrewPair() {
  const { t } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`crew.${k}`, o) as string;
  const [code, setCode] = useState("");
  const [found, setFound] = useState<PairingPreview | null>(null);
  const [problem, setProblem] = useState<"bad" | "expired" | "offline" | null>(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);

  const look = async (v: string) => {
    setChecking(true);
    try { setFound(await crewApi.preview(v)); setProblem(null); }
    catch (e) { setFound(null); setProblem(e instanceof ApiFailure && e.status === 0 ? "offline" : e instanceof ApiFailure && e.status === 410 ? "expired" : "bad"); }
    finally { setChecking(false); }
  };

  const change = (raw: string) => {
    const v = cleanPairing(raw);
    setCode(v);
    setFound(null);
    setProblem(null);
    if (v.length === PAIR_LENGTH) void look(v);
  };

  const join = async () => {
    setJoining(true);
    try {
      const r = await crewApi.pair(code);
      await pairCrewPhone(r.token);
      router.replace("/crew-now");
    } catch (e) {
      setJoining(false);
      setFound(null);
      setProblem(e instanceof ApiFailure && e.status === 410 ? "expired" : "bad");
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace("/welcome"));
  const first = found?.workerName.trim().split(/\s+/)[0] ?? "";
  const error = problem === "bad" ? c("expired.codeBad", { who: c("expired.theOffice") }) : problem === "expired" ? c("expired.codeExpired", { who: c("expired.theOffice") }) : problem === "offline" ? c("offline") : undefined;

  return (
    <Screen>
      <Header title="" backLabel={c("pair.back")} onBack={back} />
      <ScrollPage bottom={40}>
        <Section px={24} pt={20} gap={10} align="center">
          <Icon name="key" tone="violet" size={56} />
          <Text size={28} weight={600} tracking={-0.04} leading={1.15} align="center" accessibilityRole="header">{found ? c("pair.found", { name: first }) : c("pair.title")}</Text>
          <Text size={14.5} color="muted" leading={1.5} align="center">{found ? c("pair.foundSub", { company: found.companyName || c("expired.yourCompany") }) : c("pair.sub")}</Text>
        </Section>
        <Section px={16} pt={26}>
          {found ? (
            <Card padded>
              <Stack gap={14}>
                <Text size={13.5} color="muted" align="center">{formatPairing(code)}</Text>
                <Button size="lg" block label={joining ? c("expired.joining") : c("pair.joinAs", { company: found.companyName || c("expired.yourCompany") })} busy={joining ? c("expired.joining") : false} onPress={() => void join()} />
                <Text size={12.5} color="muted" align="center">{c("pair.noAccount")}</Text>
                <Button kind="link" label={c("pair.other")} onPress={() => { setCode(""); setFound(null); }} block />
              </Stack>
            </Card>
          ) : (
            <Card padded>
              <CodeField label={c("expired.codeHint", { who: c("expired.theOffice") })} value={code} onChange={change} length={PAIR_LENGTH} letters error={error} disabled={checking} autoFocus />
            </Card>
          )}
        </Section>
        <Spacer />
      </ScrollPage>
    </Screen>
  );
}
