// Feedback.dc.html. Send feedback: a screenshot (picked from the photos) that can be marked up with the finger, the kind (Something's wrong, Idea, Question), what happened, whether to
// include the logs (the app version, the phone and the screen: never client details) and whether it is OK to email back; Send, or "Save and send later" offline. Sent: a reference.
// States: compose, sending, sent, offline (saved on the phone, sent when the connection is back; a screenshot is not kept for later).
// Not true to the board: the screenshot is chosen from the photos (the app can't capture its own previous screen without a native module), so there is no picture to start with, and what is
// drawn is sent as strokes beside the picture rather than burned into it.
import { useEffect, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Linking, Platform, View } from "react-native";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { KINDS, refLabel, type Stroke } from "@/lib/feedback";
import { feedbackWaiting, flushFeedback, sendFeedback } from "@/lib/feedbackApi";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Banner, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Glyph } from "@/ui/Icon";
import { Header } from "@/ui/Header";
import { ImportLine } from "@/ui/Imports";
import { ScrollPage, Section } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { DoneBody, DoneHead, DoneRing, FromLine, ShotPane, ShotRow, ToolButton } from "@/ui/SendFeedback";
import { SetGroup, SetRow } from "@/ui/Settings";
import { RowStatus } from "@/ui/SettingsPages";
import { Switch } from "@/ui/Switch";
import { Text } from "@/ui/Text";

type Phase = "compose" | "sending" | "sent" | "saved";

export default function Feedback() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`fb.${k}`, o) as string;
  const { status, user } = useSession();
  const toast = useToast();
  const params = useLocalSearchParams<{ from?: string }>();
  const version = Constants.expoConfig?.version ?? "1.0";
  const screen = params.from?.trim() || tr("fb.screens.default");
  const [phase, setPhase] = useState<Phase>("compose");
  const [kind, setKind] = useState(0);
  const [note, setNote] = useState("");
  const [logs, setLogs] = useState(true);
  const [reply, setReply] = useState(true);
  const [shot, setShot] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [pen, setPen] = useState(false);
  const [ref, setRef] = useState("");
  const [hadShot, setHadShot] = useState(false);
  const flushed = useRef(false);
  const offline = status === "offline";

  useEffect(() => {
    if (flushed.current || status !== "in") return;
    flushed.current = true;
    void flushFeedback(version);
  }, [status, version]);

  if (status === "out") return <Redirect href="/" />;

  const pickShot = async () => {
    if (shot) { setShot(null); setStrokes([]); setPen(false); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted && Platform.OS !== "web") { toast({ message: t("noPhotos") }); void Linking.openSettings().catch(() => undefined); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: false });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    setShot({ uri: a.uri, name: a.fileName ?? "screenshot.jpg", type: a.mimeType ?? "image/jpeg" });
    setStrokes([]);
  };

  const send = async () => {
    if (phase === "sending") return;
    if (!note.trim() && !shot) { toast({ message: t("needNote") }); return; }
    const body = { kind: KINDS[kind] ?? "wrong", note: note.trim(), replyOk: reply, includeLogs: logs, screen, markup: strokes.length ? strokes : undefined };
    setHadShot(!!shot);
    setPhase("sending");
    const r = offline ? { ok: false as const, status: 0 } : await sendFeedback(body, version, shot ?? undefined);
    if (r.ok) { setRef(refLabel(r.ref)); setPhase("sent"); return; }
    if (r.status === 0) {
      await feedbackWaiting.add({ ...body, at: new Date().toISOString() });
      setPhase("saved");
      return;
    }
    setPhase("compose");
    toast({ message: r.status === 429 ? t("tooMany") : t("failed") });
  };

  const reset = () => { setPhase("compose"); setNote(""); setShot(null); setStrokes([]); setPen(false); setRef(""); };
  const close = () => (router.canGoBack() ? router.back() : router.replace("/home"));
  const done = phase === "sent" || phase === "saved";
  const sending = phase === "sending";
  const placeholders = tr("fb.placeholders", { returnObjects: true }) as unknown as string[];
  const kinds = tr("fb.kinds", { returnObjects: true }) as unknown as string[];

  return (
    <Screen>
      <Header title={t("title")} backLabel={t("close")} onBack={close} />
      <ScrollPage bottom={56}>
        {done ? (
          <>
            <DoneHead ring={<DoneRing><Glyph name={phase === "saved" ? "cloud" : "check"} size={36} color={phase === "saved" ? "warn" : "ok"} weight={2.4} /></DoneRing>} title={phase === "saved" ? t("done.saved") : t("done.sent")}
              text={phase === "saved" ? t("done.textSaved") : reply ? t("done.textReply", { email: user?.email ?? "" }) : t("done.text")} />
            <DoneBody
              facts={(
                <Card>
                  <ImportLine first title={t("done.ref")} right={ref ? <Text size={14.5} weight={500}>{ref}</Text> : <RowStatus tone="warn" shape="clock">{t("done.waiting")}</RowStatus>} />
                  <ImportLine title={t("done.shot")} right={hadShot ? <RowStatus tone={phase === "saved" ? "mute" : "ok"} shape={phase === "saved" ? "off" : "check"}>{phase === "saved" ? t("done.notIncluded") : t("done.attached")}</RowStatus> : <RowStatus tone="mute" shape="off">{t("done.none")}</RowStatus>} />
                  <ImportLine title={t("done.logs")} right={<RowStatus tone={logs ? "ok" : "mute"} shape={logs ? "check" : "off"}>{logs ? t("done.attached") : t("done.notIncluded")}</RowStatus>} />
                </Card>
              )}
              actions={(
                <>
                  <Button size="lg" block label={t("done.back")} onPress={close} />
                  <Button kind="ghost" block label={t("done.another")} onPress={reset} />
                </>
              )} />
          </>
        ) : (
          <View style={{ opacity: sending ? 0.55 : 1 }} pointerEvents={sending ? "none" : "auto"}>
            {offline ? <Section pt={10} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body")}</Banner></Section> : null}
            <Section pt={14} px={16}>
              <ShotRow
                pane={<ShotPane uri={shot?.uri ?? null} strokes={strokes} drawing={pen} onStroke={(s) => setStrokes((x) => [...x, s])} label={t("shotLabel")} empty={t("noShot")} />}
                hint={pen ? t("hintOn") : shot ? t("hint") : t("hintNoShot")}
                tools={(
                  <>
                    <ToolButton icon="pen" tone="violet" label={t("markUp")} on={pen} disabled={!shot} onPress={() => setPen((p) => !p)} />
                    <ToolButton icon="sync" tone="slate" label={t("undoMark")} disabled={!strokes.length} onPress={() => setStrokes((s) => s.slice(0, -1))} />
                    <ToolButton icon="photo" tone={shot ? "slate" : "azure"} label={shot ? t("removeShot") : t("addShot")} onPress={() => void pickShot()} />
                  </>
                )} />
            </Section>
            <Section delay={60} pt={18}>
              <ChipStrip label={t("kind")}>{kinds.map((k, i) => <Chip key={k} label={k} selected={kind === i} onPress={() => setKind(i)} />)}</ChipStrip>
            </Section>
            <Section delay={90} pt={14} px={16}><TextField label={t("noteLabel")} value={note} onChangeText={setNote} placeholder={placeholders[kind]} multiline /></Section>
            <Section delay={120} pt={16} px={16}>
              <SetGroup>
                <SetRow first icon="list" tone="slate" label={t("logs.label")} sub={t("logs.sub")} control={<Switch value={logs} onChange={setLogs} label={t("logs.label")} />} />
                <SetRow icon="mail" tone="sky" label={t("reply.label")} sub={user?.email ?? ""} control={<Switch value={reply} onChange={setReply} label={t("reply.label")} />} />
              </SetGroup>
              <FromLine>{t("from", { screen, version })}</FromLine>
            </Section>
            <Section pt={18} px={16}><Button size="lg" block label={sending ? t("sending") : offline ? t("saveLater") : t("send")} busy={sending ? t("sending") : false} onPress={() => void send()} /></Section>
          </View>
        )}
      </ScrollPage>
    </Screen>
  );
}
