// HomeAI.dc.html: the assistant layer that opens from the orb. Voice: the orb, Type instead, Mute, Close. Keyboard: the orb shrinks up, your messages and its answers (shown a word at a time), the bar and Back to voice.
// Voice: tap the microphone to talk and again to send (Groq Whisper on the server); the answer is shown and, in English, read aloud (Groq text to speech; Groq has no French voice). The answers are the real assistant's (the company conversation).
// Without the plan that includes the assistant the server says so and the layer shows that, with a link to the plans page.
import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { Redirect, router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dimensions } from "react-native";
import { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { ApiFailure } from "@/lib/api";
import { firstWords, lastReply, words, type Mood } from "@/lib/assistantChat";
import { assistantChatApi } from "@/lib/assistantChatApi";
import { listen, speak } from "@/lib/assistantVoice";
import { useVoiceCapture } from "@/lib/useVoiceCapture";
import { PLANS_URL } from "@/lib/plan";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Bubble, BubbleActions, Corner, GlassButton, KeyboardBar, KeyboardLift, Layer, LiveOrb, MessageBar, MuteButton, OrbSlot, Reveal, Rise, Thread, VoiceControls, VoiceNote } from "@/ui/AssistantLayer";
import { Button } from "@/ui/Button";
import { useFloatBottom } from "@/ui/TabBar";
import { Text } from "@/ui/Text";

type Msg = { id: string; mine: boolean; text: string; streaming?: boolean; locked?: boolean; proposals?: number };

export default function Assistant() {
  const { t, i18n } = useTranslation();
  const { status } = useSession();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [kb, setKb] = useState(false);
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState("");
  const voice = useVoiceCapture();
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState<Mood | null>(null);
  const conv = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const lift = useSharedValue(0);
  // HomeAI's open and close: a circle grows from the orb in the tab bar (62 across, 16 from the right, 26 above the foot) and the live orb flies from the button to the middle; closing runs it backwards.
  const { width, height } = Dimensions.get("window");
  const floatBottom = useFloatBottom();
  const cx = width - 16 - 31;
  const cy = height - floatBottom - 31;
  const progress = useSharedValue(reduced ? 1 : 0);
  const [closing, setClosing] = useState(false);
  useEffect(() => { if (!reduced) progress.value = withTiming(1, { duration: 800, easing: Easing.bezier(0.7, 0, 0.2, 1) }); }, [reduced, progress]);
  useEffect(() => { lift.value = withTiming(kb ? 1 : 0, { duration: reduced ? 0 : 800 }); }, [kb, reduced, lift]);
  useEffect(() => () => timers.current.forEach(clearInterval), []);
  const orbPos = useAnimatedStyle(() => {
    const fly = 1 - progress.value;
    return { transform: [{ translateX: (cx - width / 2) * fly }, { translateY: (cy - 0.46 * height) * fly - 268 * lift.value }, { scale: (0.14 + 0.86 * progress.value) * (1 - 0.66 * lift.value) }] };
  });
  const mood: Mood = busy ?? (listening ? "listen" : "idle");
  if (status === "out") return <Redirect href="/" />;

  const leave = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SmartHome", "")));
  const close = () => {
    if (closing) return;
    setClosing(true);
    if (listening) { setListening(false); void voice.stop(); }
    if (reduced) { leave(); return; }
    progress.value = withTiming(0, { duration: 650, easing: Easing.bezier(0.7, 0, 0.2, 1) }, (done) => { if (done) runOnJS(leave)(); });
  };
  const push = (m: Msg) => setMsgs((c) => [...c, m]);
  const patch = (id: string, p: Partial<Msg>) => setMsgs((c) => c.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const stream = (id: string, full: string, proposals: number) => {
    const all = words(full);
    let n = 0;
    setBusy("speak");
    const timer = setInterval(() => {
      n++;
      patch(id, { text: firstWords(full, n), streaming: n < all.length });
      if (n >= all.length) { clearInterval(timer); setBusy(null); if (proposals) patch(id, { proposals }); }
    }, 55);
    timers.current.push(timer);
  };
  const answer = (full: string, proposals = 0, extra?: Partial<Msg>) => {
    if (!kb) {
      setCaption(full);
      setBusy("speak");
      void speak(full, i18n.language === "fr" ? "fr" : "en").finally(() => setBusy(null));
      return;
    }
    const id = `b${Date.now()}`;
    push({ id, mine: false, text: "", streaming: true, ...extra });
    stream(id, full, proposals);
  };

  const send = async (said?: string) => {
    const content = (said ?? text).trim();
    if (!content || busy) return;
    if (said === undefined) setText("");
    push({ id: `u${Date.now()}`, mine: true, text: content });
    setBusy("think");
    try {
      if (!conv.current) conv.current = (await assistantChatApi.conversation()).conversation.id;
      const r = await assistantChatApi.send(conv.current, content, i18n.language === "fr" ? "fr" : "en");
      const reply = lastReply(r.messages);
      answer(reply || t("ai.failed"), r.proposals.filter((p) => p.status === "pending").length);
    } catch (e) {
      setBusy(null);
      if (e instanceof ApiFailure && e.status === 403) answer(t("ai.locked"), 0, { locked: true });
      else answer(e instanceof ApiFailure && e.status === 0 ? t("ai.offline") : t("ai.failed"));
    }
  };

  const talk = async () => {
    if (busy) return;
    if (!listening) {
      const r = await voice.start();
      if (r !== "ok") { setCaption(t(r === "denied" ? "ai.micDenied" : "ai.micFailed")); return; }
      setCaption("");
      setListening(true);
      return;
    }
    setListening(false);
    setBusy("think");
    const uri = await voice.stop();
    if (!uri) { setBusy(null); setCaption(t("ai.micFailed")); return; }
    const heard = await listen(uri, i18n.language === "fr" ? "fr" : "en");
    if (!heard.ok) { setBusy(null); setCaption(t(heard.problem === "empty" ? "ai.empty" : heard.problem === "offline" ? "ai.offline" : heard.problem === "plan" ? "ai.locked" : "ai.failed")); return; }
    setBusy(null);
    setCaption(heard.text);
    await send(heard.text);
  };

  return (
    <>
    <Stack.Screen options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }} />
    <Reveal progress={progress} cx={cx} cy={cy} width={width} height={height}>
    <Layer>
      <OrbSlot style={orbPos}><LiveOrb mood={mood} /></OrbSlot>
      {!kb ? (
        <>
          <Rise>
          <VoiceNote title={t("ai.label")} note={caption || t(listening ? "ai.listening" : "ai.tapToTalk")} top={insets.top + 26} />
          <VoiceControls bottom={insets.bottom + 44}>
            <GlassButton glyph="keyboard" label={t("ai.openKeyboard")} onPress={() => { if (listening) { setListening(false); void voice.stop(); } setKb(true); }} />
            <MuteButton muted={!listening} label={listening ? t("ai.stopSend") : t("ai.talk")} onPress={() => void talk()} />
            <GlassButton glyph="close" label={t("ai.close")} onPress={close} />
          </VoiceControls>
          </Rise>
        </>
      ) : (
        <>
          <Corner top={insets.top + 16}><GlassButton glyph="close" label={t("ai.close")} onPress={close} size={44} /></Corner>
          <KeyboardLift>
          <Thread top={insets.top + 190} bottom={insets.bottom + 104}>
            {msgs.map((m) => (
              <View key={m.id}>
                <Bubble mine={m.mine} streaming={m.streaming}>{m.text}</Bubble>
                {m.locked && !m.streaming ? <BubbleActions><Button size="sm" kind="secondary" label={t("ai.seePlan")} onPress={() => void Linking.openURL(PLANS_URL)} /></BubbleActions> : null}
                {m.proposals ? <BubbleActions><Text size={13.5} color="muted">{t("ai.proposals", { count: m.proposals })}</Text><Button size="sm" kind="secondary" label={t("ai.review")} onPress={() => router.push(screenHref("AssistantProposals", ""))} /></BubbleActions> : null}
              </View>
            ))}
          </Thread>
          <KeyboardBar bottom={insets.bottom + 28}>
            <MessageBar value={text} onChange={setText} onSend={() => void send()} placeholder={t("ai.placeholder")} sendLabel={t("ai.send")} fieldLabel={t("ai.field")} disabled={!!busy} />
            <GlassButton glyph="wave" label={t("ai.backToVoice")} onPress={() => { setKb(false); setCaption(""); }} size={52} />
          </KeyboardBar>
          </KeyboardLift>
        </>
      )}
    </Layer>
    </Reveal>
    </>
  );
}
