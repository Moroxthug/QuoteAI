// VideoPlayer.dc.html. A short video for first-time screens and Help (`?video=quotes` or `overview`): a dark stage with an illustrated walkthrough, captions that follow the chapter, a
// scrub bar of chapters, back and forward 10 seconds, play and pause, speed and captions, then the chapters and a button to try it. States: playing, paused, offline.
// The two videos are walkthroughs drawn in the app, as the board draws them (a scene and captions on a timer), so there is no file to stream: "offline" shows the board's "needs a
// connection" overlay only when the phone has no connection, and "buffering" never happens. The other four videos of Help have no player yet (Coming soon).
import { useEffect, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { board } from "@/theme/board";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Glyph } from "@/ui/Icon";
import { ScrollPage, Section } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { SectionHeader } from "@/ui/Row";
import { SetRow } from "@/ui/Settings";
import { Status } from "@/ui/Status";
import { Switch } from "@/ui/Switch";
import { BigPlay, ChapterRow, Frame, Overlay, OverlayText, Pill, PillText, Scrub, SettingsCard, SpeedLine, Stage, StageHeader, Times, Transport, VideoInfo } from "@/ui/Video";
import { chapterAt, clampPos, clock, knobX, SPEEDS, segmentFill, type Chapter } from "@/lib/videos";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";

type Id = "quotes" | "overview";
const TOTAL: Record<Id, number> = { quotes: 72, overview: 60 };
const AT: Record<Id, number[]> = { quotes: [0, 14, 38, 58], overview: [0, 15, 30, 45] };
const BAR = 350;

export default function VideoPlayer() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`vp.${k}`, o) as string;
  const { status } = useSession();
  const params = useLocalSearchParams<{ video?: string }>();
  const id: Id = params.video === "overview" ? "overview" : "quotes";
  const total = TOTAL[id];
  const info = tr(`vp.v.${id}`, { returnObjects: true }) as unknown as { head: string; title: string; topic: string; sub: string; cta: string; scene: string[]; ch: string[][] };
  const chapters: Chapter[] = info.ch.map((c, i) => ({ at: AT[id][i]!, title: c[0]!, caption: c[1]! }));
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [cc, setCc] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [tries, setTries] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const offline = status === "offline" && tries === 0;

  useEffect(() => {
    if (!playing || offline) return;
    timer.current = setInterval(() => setPos((p) => { const n = p + 0.25 * speed; if (n >= total) { setPlaying(false); return total; } return n; }), 250);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, speed, total, offline]);

  if (status === "out") return <Redirect href="/" />;

  const ci = chapterAt(chapters, pos);
  const fills = segmentFill(chapters, total, pos);
  const seek = (p: number) => setPos(clampPos(p, total));
  const toggle = () => { if (pos >= total) setPos(0); setPlaying((p) => (pos >= total ? true : !p)); };
  const close = () => (router.canGoBack() ? router.back() : router.replace("/home"));
  const goTry = () => router.push(id === "quotes" ? screenHref("NewQuote", info.cta) : screenHref("Welcome", info.cta));
  const speedText = `${speed}×`;
  const shown = playing && !offline;

  return (
    <Screen>
      <ScrollPage bottom={56}>
        <Stage>
          <StageHeader title={info.head} close={t("close")} onClose={close} />
          <Frame label={`${info.title}, ${chapters[ci]!.title}`} a={info.scene[0]!} b={info.scene[1]!} c={info.scene[2]!} d={info.scene[4]!} amount={info.scene[3]!} playing={shown}
            caption={cc && !offline ? chapters[ci]!.caption : undefined}
            overlay={offline ? (
              <Overlay solid>
                <Glyph name="cloud" size={28} tint={board.player.cloud} />
                <OverlayText>{t("offline")}</OverlayText>
                <OverlayText dim>{t("offlineSub")}</OverlayText>
                <Pill on onPress={() => setTries((n) => n + 1)} label={t("retry")}><PillText on>{t("retry")}</PillText></Pill>
              </Overlay>
            ) : !playing ? <Overlay><BigPlay label={t("play")} onPress={toggle} /></Overlay> : undefined} />
          <Scrub fills={fills} labels={chapters.map((c, i) => t("chapter", { n: i + 1, title: c.title }))} onGo={(i) => seek(chapters[i]!.at)} knob={knobX(chapters, total, pos, BAR)} now={Math.round(pos)} max={total} text={clock(pos)} label={t("position")} />
          <Times pos={clock(pos)} chapter={chapters[ci]!.title} total={clock(total)} />
          <Transport cc={t("captions")} ccOn={cc && !offline} onCc={() => setCc((c) => !c)} speed={speedText} onSpeed={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed as 1) + 1) % SPEEDS.length]!)} playing={playing && !offline} onToggle={toggle}
            onBack={() => seek(pos - 10)} onForward={() => seek(pos + 10)} labels={{ play: t("play"), pause: t("pause"), back: t("back10"), forward: t("fwd10"), speed: t("speed", { speed: speedText }) }} />
        </Stage>

        <Section pt={18} px={20}>
          <VideoInfo topic={info.topic} length={clock(total)} title={info.title} sub={info.sub} />
        </Section>
        <Section delay={40} pt={18} px={16}>
          <SettingsCard>
            <SpeedLine label={t("speedTitle")} value={speedText} />
            <Segmented options={SPEEDS.map((s) => `${s}×`)} value={SPEEDS.indexOf(speed as 1)} onChange={(i) => setSpeed(SPEEDS[i]!)} label={t("speedTitle")} />
            <SetRow first icon="speaker" tone="slate" label={t("captions")} sub={cc ? t("ccOn") : t("ccOff")} control={<Switch value={cc} onChange={setCc} label={t("captions")} />} />
          </SettingsCard>
        </Section>
        <Section delay={70} pt={20} px={16}>
          <SectionHeader title={t("chapters")} />
          <Card>
            {chapters.map((c, i) => (
              <ChapterRow key={c.title} first={i === 0} time={clock(c.at)} title={c.title} current={i === ci} onPress={() => seek(c.at)}
                status={i === ci ? <Status tone={playing ? "ok" : "mute"} shape={playing ? "live" : "pause"} plain>{playing ? t("playing") : t("paused")}</Status> : i < ci ? <Status tone="mute" shape="check" plain>{t("watched")}</Status> : undefined} />
            ))}
          </Card>
        </Section>
        <Section delay={100} pt={20} px={16}><Button size="lg" block label={info.cta} onPress={goTry} /></Section>
      </ScrollPage>
    </Screen>
  );
}
