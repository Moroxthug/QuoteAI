// CrewExpired.dc.html. The crew's link doesn't open: expired, replaced by a newer one, invalid, or no signal. Each says why in a sentence, offers the way out (Try again when
// it is only the signal; "Ask {boss} for a new link" otherwise, which sends the company a note with the worker's name) and "or join with a code": the six characters the
// admin makes under Team, which pair this phone again. Nothing is lost: hours, photos and reports are saved with the company.
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ApiFailure } from "@/lib/api";
import type { LinkProblem } from "@/lib/crew";
import { crewApi } from "@/lib/crewApi";
import { pairCrewPhone, recallCrew, useCrewSession, type CrewMemo } from "@/lib/crewSession";
import { cleanPairing } from "@/lib/crewPair";
import { useCrew } from "@/lib/useCrew";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { CrewHeader } from "@/ui/Crew";
import { Banner } from "@/ui/Feedback";
import { CodeField } from "@/ui/Field";
import { Icon, type IconName, type Tone } from "@/ui/Icon";
import { Section, ScrollPage, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { initialsOf } from "@/lib/invites";
import { tintFor } from "@/lib/clients";

const HERO: Record<LinkProblem, { icon: IconName; tone: Tone }> = { expired: { icon: "lock", tone: "slate" }, replaced: { icon: "sync", tone: "violet" }, invalid: { icon: "warn", tone: "amber" }, offline: { icon: "cloud", tone: "amber" } };

export default function CrewExpired() {
  const { t } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`crew.${k}`, o) as string;
  const params = useLocalSearchParams<{ state?: string }>();
  const sess = useCrewSession();
  const crew = useCrew();
  const [memo, setMemo] = useState<CrewMemo | null>(null);
  const [asked, setAsked] = useState(false);
  const [asking, setAsking] = useState(false);
  const [trying, setTrying] = useState(false);
  const [code, setCode] = useState("");
  const [bad, setBad] = useState<"bad" | "expired" | null>(null);
  const [joining, setJoining] = useState(false);
  useEffect(() => { void recallCrew().then(setMemo); }, []);

  const state: LinkProblem = (["expired", "replaced", "invalid", "offline"] as const).includes(params.state as LinkProblem) ? (params.state as LinkProblem) : crew.problem ?? "expired";
  const company = memo?.companyName || c("expired.yourCompany");
  const who = c("expired.theOffice");
  const hero = HERO[state];

  // The link came back (signal returned, or it was only a hiccup): back to today.
  useEffect(() => { if (crew.view && !crew.problem) router.replace("/crew-now"); }, [crew.view, crew.problem]);

  const tryAgain = async () => {
    setTrying(true);
    await crew.refetch();
    setTrying(false);
  };
  const ask = async () => {
    if (!sess.token || asking) return;
    setAsking(true);
    try { await crewApi.requestLink(sess.token); setAsked(true); } catch { /* the button stays; try again */ } finally { setAsking(false); }
  };
  const join = async (typed: string) => {
    const cleaned = cleanPairing(typed);
    if (cleaned.length < 6 || joining) return;
    setJoining(true);
    setBad(null);
    try {
      const r = await crewApi.pair(cleaned);
      await pairCrewPhone(r.token);
      router.replace("/crew-now");
    } catch (e) {
      setJoining(false);
      setBad(e instanceof ApiFailure && e.status === 410 ? "expired" : "bad");
    }
  };

  return (
    <Screen>
      <ScrollPage bottom={40}>
        <CrewHeader company={company} initials={initialsOf(company)} switchLabel={c("switchCompany")} worker={initialsOf(memo?.workerName ?? "?")} tint={tintFor(memo?.workerName ?? "?")} workerLabel={memo?.workerName ?? ""} />
        <Section px={24} pt={36} gap={12} align="center">
          <Icon name={hero.icon} tone={hero.tone} size={56} />
          <Text size={28} weight={600} tracking={-0.04} leading={1.15} align="center" accessibilityRole="header">{c(`expired.${state}.title`)}</Text>
          <Text size={14.5} color="muted" leading={1.5} align="center">{c(`expired.${state}.sub`, { who, company })}</Text>
        </Section>
        <Section px={16} pt={26} gap={12}>
          {state === "offline" ? (
            <Button size="lg" block label={trying ? c("expired.trying") : c("expired.tryAgain")} busy={trying ? c("expired.trying") : false} onPress={() => void tryAgain()} />
          ) : asked ? (
            <Banner tone="ok" icon="send" iconTone="azure" lead={c("expired.asked", { who })}>{c("expired.askedSub")}</Banner>
          ) : (
            <Stack gap={6}>
              <Button size="lg" block label={asking ? c("expired.asking") : c("expired.ask", { who })} busy={asking ? c("expired.asking") : false} onPress={() => void ask()} />
              <Text size={12.5} color="muted" align="center">{c("expired.askSub")}</Text>
            </Stack>
          )}
        </Section>
        {state !== "offline" ? (
          <Section px={16} pt={26} gap={12}>
            <Text size={13.5} color="muted" align="center">{c("expired.or")}</Text>
            <Card padded>
              <Stack gap={12}>
                <CodeField label={c("expired.codeHint", { who })} value={code} onChange={(v) => { setCode(cleanPairing(v)); setBad(null); }} length={6} letters error={bad === "bad" ? c("expired.codeBad", { who }) : bad === "expired" ? c("expired.codeExpired", { who }) : undefined} />
                <Button label={joining ? c("expired.joining") : c("expired.join")} block disabled={code.length < 6} busy={joining ? c("expired.joining") : false} onPress={() => void join(code)} />
              </Stack>
            </Card>
          </Section>
        ) : null}
        <Section px={32} pt={22}><Text size={12.5} color="faint" align="center" leading={1.45}>{c("expired.saved")}</Text></Section>
      </ScrollPage>
    </Screen>
  );
}
