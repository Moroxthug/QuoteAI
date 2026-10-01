// LiveLocation.dc.html. Sharing where the worker is, only while they are on the clock: Ask (what it is, who sees it, "Allow while on the clock" / "Not now"), On (sharing since,
// stops at clock out, "Stop sharing") and Off ("Share again"). The phone sends its position every minute while the clock runs and this app is open; clock-out ends it.
// Clock-in and clock-out still check where you are once, whatever you choose here.
import { useEffect, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { crewApi } from "@/lib/crewApi";
import { time, type Locale } from "@/lib/format";
import { currentFix, getSharing, setSharing } from "@/lib/location";
import { useCrew } from "@/lib/useCrew";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { Section, ScrollPage, Spacer, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Status } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";

type Mode = "ask" | "on" | "off";

export default function LiveLocation() {
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`crew.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const crew = useCrew();
  const toast = useToast();
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"denied" | "unavailable" | "failed" | null>(null);
  const view = crew.view;

  useEffect(() => { void getSharing().then((v) => setMode(v ?? "ask")); }, []);

  if (!crew.loading && crew.unpaired) return <Redirect href="/crew-pair" />;
  if (crew.problem) return <Redirect href={{ pathname: "/crew-expired", params: { state: crew.problem } } as never} />;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/crew-now"));
  if (crew.loading || !view || !mode) return <Screen><Header title="" backLabel={c("back")} onBack={back} /><Section pt={30} px={20} gap={14}><Skeleton height={200} radius={22} /></Section></Screen>;

  const job = view.jobs.find((j) => j.id === view.activeEntry?.projectId)?.name ?? view.todayJobs[0]?.name ?? "";
  const since = view.activeEntry?.clockInAt ? time(new Date(view.activeEntry.clockInAt), locale) : null;
  const blocks = view.todayJobs.flatMap((j) => j.blocks).filter((b) => !b.allDay);
  const ends = blocks.length ? time(new Date(Math.max(...blocks.map((b) => +new Date(b.endsAt)))), locale) : null;

  const allow = async () => {
    setBusy(true);
    setProblem(null);
    const f = await currentFix();
    if (!f.ok) { setBusy(false); setProblem(f.problem); return; }
    await setSharing("on");
    setMode("on");
    if (view.activeEntry) void crewApi.location(crew.path!, f.fix.lat, f.fix.lng).catch(() => undefined);
    setBusy(false);
  };
  const stop = async () => {
    await setSharing("off");
    setMode("off");
    try { await crewApi.stopLocation(crew.path!); } catch { toast({ message: c("clock.failed") }); }
  };

  const title = mode === "on" ? c("location.on") : mode === "off" ? c("location.off") : c("location.ask");
  const lede = mode === "on" ? c("location.onLede", { job: job || c("clock.noJob") }) : mode === "off" ? c("location.offLede") : c("location.askLede");

  return (
    <Screen>
      <Header title={c("location.title")} backLabel={c("back")} onBack={back} />
      <ScrollPage bottom={30}>
        <Section px={24} pt={24} gap={12} align="center">
          <Stack align="center"><Status tone={mode === "on" ? "ok" : "mute"} shape={mode === "on" ? "live" : "off"}>{mode === "on" ? c("location.sharing") : c("location.notSharing")}</Status></Stack>
          <Icon name="pin" tone={mode === "on" ? "sage" : "rose"} size={44} />
          <Text size={28} weight={600} tracking={-0.04} leading={1.15} align="center" accessibilityRole="header">{title}</Text>
          <Text size={14.5} color="muted" leading={1.5} align="center">{lede}</Text>
        </Section>
        {mode === "on" ? (
          <Section px={16} pt={20}>
            <Card padded>
              <Stack row justify="space-between" gap={12}>
                <Stack gap={2}><Text size={12.5} color="muted">{c("location.since")}</Text><Num size={19} weight={600} tracking={-0.03}>{since ?? "–"}</Num></Stack>
                <Stack gap={2} align="flex-end"><Text size={12.5} color="muted">{c("location.stopsAt")}</Text><Num size={19} weight={600} tracking={-0.03}>{ends ? `~${ends}` : "–"}</Num></Stack>
              </Stack>
              <Stack pt={14}><Text size={13.5} color="muted">{c("location.seeSub", { names: c("location.the"), job })}</Text></Stack>
            </Card>
          </Section>
        ) : null}
        {problem ? <Section px={16} pt={14}><Banner tone="warn" icon="warn" iconTone="amber" lead={c(`location.${problem}`)} /></Section> : null}
        <Spacer />
        <Section px={16} pt={28} gap={10}>
          {mode === "on" ? <Button kind="secondary" size="lg" block label={c("location.stop")} onPress={() => void stop()} />
            : <Button size="lg" block label={busy ? c("location.turning") : mode === "off" ? c("location.shareAgain") : c("location.allow")} busy={busy ? c("location.turning") : false} onPress={() => void allow()} />}
          {mode === "ask" ? <Button kind="link" size="lg" block label={c("location.notNow")} onPress={back} /> : <Button kind="secondary" size="lg" block label={c("location.back")} onPress={back} />}
          <Stack pt={6}><Text size={12.5} color="faint" align="center">{c("location.note")}</Text></Stack>
        </Section>
      </ScrollPage>
    </Screen>
  );
}
