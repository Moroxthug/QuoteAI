// HomeAI.dc.html: the assistant layer that opens from the orb. Voice: the orb, Type instead, Mute, Close. Keyboard: the orb shrinks up, your messages and its answers (shown a word at a time), the bar and Back to voice.
// NOT BUILT: listening and speaking aloud (the phone needs a speech module the app does not carry yet), so voice mode shows the orb at rest and says so. The answers are the real assistant's (the company conversation).
// Without the plan that includes the assistant the server says so and the layer shows that, with a link to the plans page.
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { ApiFailure } from "@/lib/api";
import { firstWords, lastReply, moodAt, words, type Mood } from "@/lib/assistantChat";
import { assistantChatApi } from "@/lib/assistantChatApi";
import { PLANS_URL } from "@/lib/plan";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Bubble, BubbleActions, Corner, GlassButton, KeyboardBar, Layer, LiveOrb, MessageBar, MuteButton, OrbSlot, Thread, VoiceControls, VoiceNote } from "@/ui/AssistantLayer";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";

type Msg = { id: string; mine: boolean; text: string; streaming?: boolean; locked?: boolean; proposals?: number };

export default function Assistant() {
  const { t, i18n } = useTranslation();
  const { status } = useSession();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [kb, setKb] = useState(false);
  const [muted, setMuted] = useState(false);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState<Mood | null>(null);
  const conv = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const lift = useSharedValue(0);
  useEffect(() => { lift.value = withTiming(kb ? 1 : 0, { duration: reduced ? 0 : 800 }); }, [kb, reduced, lift]);
  useEffect(() => () => timers.current.forEach(clearInterval), []);
  const orbPos = useAnimatedStyle(() => ({ transform: [{ translateY: -268 * lift.value }, { scale: 1 - 0.66 * lift.value }] }));
  const mood: Mood = useMemo(() => moodAt(0, { voice: !kb, muted, busy }), [kb, muted, busy]);
  if (status === "out") return <Redirect href="/" />;

  const close = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SmartHome", "")));
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
    const id = `b${Date.now()}`;
    push({ id, mine: false, text: "", streaming: true, ...extra });
    stream(id, full, proposals);
  };

  const send = async () => {
    const content = text.trim();
    if (!content || busy) return;
    setText("");
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

  return (
    <Layer>
      <OrbSlot style={orbPos}><LiveOrb mood={mood} /></OrbSlot>
      {!kb ? (
        <>
          <VoiceNote title={t("ai.label")} note={t("ai.noVoice")} top={insets.top + 26} />
          <VoiceControls bottom={insets.bottom + 44}>
            <GlassButton glyph="keyboard" label={t("ai.openKeyboard")} onPress={() => setKb(true)} />
            <MuteButton muted={muted} label={muted ? t("ai.unmute") : t("ai.mute")} onPress={() => setMuted((m) => !m)} />
            <GlassButton glyph="close" label={t("ai.close")} onPress={close} />
          </VoiceControls>
        </>
      ) : (
        <>
          <Corner top={insets.top + 16}><GlassButton glyph="close" label={t("ai.close")} onPress={close} size={44} /></Corner>
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
            <GlassButton glyph="wave" label={t("ai.backToVoice")} onPress={() => { setKb(false); setMuted(false); }} size={52} />
          </KeyboardBar>
        </>
      )}
    </Layer>
  );
}
