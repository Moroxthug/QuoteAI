/**
 * Phase 150 — the assistant, as the canvas's Home opens it (docs/pocket-design/Main.dc.html):
 * the black orb button grows into a full-screen night layer, the screen behind scales back;
 * the large live orb listens, thinks and speaks; three controls — keyboard, the microphone
 * (mute), close; in keyboard mode the orb rises, the conversation shows, and a glass input
 * sends. It is the company-wide assistant (/api/assistant, the same conversation as before).
 *
 * Voice: the microphone is open while the layer is (unless muted); a pause after speech ends
 * the sentence, which is transcribed (/api/speech/transcribe) and sent. Replies are read aloud
 * in the chosen voice when "Speak replies aloud" is on (Settings → Assistant). Anything the
 * assistant wants to change comes back as a proposal: with "Ask before sending" on it waits for
 * Confirm; off, it is applied.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/jobs-api";
import { assistantApi, type ProposalDto } from "@/lib/assistant-api";
import { transcribeAudio } from "@/lib/speech";
import { haptic } from "@/lib/haptics";
import { CloseIcon, KeyboardIcon, MicIcon, MicOffIcon, ArrowUpIcon, WaveIcon } from "./icons";

type Mood = "listen" | "think" | "speak" | "mute" | "idle";
type Msg = { id: string; mine: boolean; text: string; streaming?: boolean; proposal?: ProposalDto };
type Voice = "ember" | "tide" | "stone";

const PALETTE: Record<Voice, { base: string; c: [string, string, string] }> = {
  ember: { base: "#1c0c08", c: ["#ff6a3d", "#7ab8ff", "#ffb347"] },
  tide: { base: "#08172a", c: ["#3d8bff", "#6ef0d2", "#b7a6ff"] },
  stone: { base: "#1a1a1c", c: ["#c9c4ba", "#8e8a84", "#f4efe6"] },
};
const SPEECH_RMS = 0.035;
const SILENCE_MS = 1200;

export function AssistantOverlay({ open, onClose, from }: { open: boolean; onClose: () => void; from: { x: number; y: number } }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<"open" | "closing" | "closed">("closed");
  const [mode, setMode] = useState<"voice" | "kb">("voice");
  const [muted, setMuted] = useState(false);
  const [mood, setMood] = useState<Mood>("listen");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const orbEl = useRef<HTMLDivElement>(null);
  const inputEl = useRef<HTMLInputElement>(null);
  const audio = useRef<{ stream: MediaStream; ctx: AudioContext; an: AnalyserNode; rec: MediaRecorder; chunks: Blob[]; heard: boolean; quietSince: number } | null>(null);
  const raf = useRef<number | null>(null);
  const moodRef = useRef<Mood>("listen");
  const level = useRef(0);
  const busy = useRef(false);
  const { data: prefsData } = useQuery({ queryKey: ["member-prefs"], queryFn: () => apiRequest<{ preferences: { voice: Voice; speak: boolean; confirmSend: boolean } }>("/api/me/preferences"), staleTime: 60_000, enabled: open });
  const prefs = prefsData?.preferences ?? { voice: "ember" as Voice, speak: true, confirmSend: true };
  const { data: conv } = useQuery({ queryKey: ["assistant", "conversation", null], queryFn: () => assistantApi.conversation(null), enabled: open, staleTime: 30_000 });

  const setMoodBoth = (m: Mood) => { moodRef.current = m; setMood(m); };

  // Open / close, with the screen behind scaling back.
  useEffect(() => {
    if (open && phase === "closed") {
      setPhase("open"); setMode("voice"); setMuted(false); setMsgs([]); setMoodBoth("listen");
      document.documentElement.classList.add("pk-ai-open");
    }
  }, [open, phase]);
  const close = useCallback(() => {
    if (phase !== "open") return;
    stopListening(); window.speechSynthesis?.cancel();
    document.documentElement.classList.remove("pk-ai-open");
    setPhase("closing");
    window.setTimeout(() => { setPhase("closed"); onClose(); }, 640);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, onClose]);
  useEffect(() => () => { document.documentElement.classList.remove("pk-ai-open"); stopListening(); window.speechSynthesis?.cancel(); }, []);

  // The orb's amplitude: the microphone's level while listening, the canvas's speaking rhythm while speaking.
  useEffect(() => {
    if (phase !== "open") return;
    const t0 = performance.now();
    let amp = 0;
    const loop = (now: number) => {
      const s = (now - t0) / 1000, m = moodRef.current;
      let target = 0.08 + 0.04 * Math.sin(s * 1.4);
      const a = audio.current;
      if (a && m === "listen") {
        const buf = new Float32Array(a.an.fftSize);
        a.an.getFloatTimeDomainData(buf);
        const rms = Math.sqrt(buf.reduce((x, v) => x + v * v, 0) / buf.length);
        level.current = rms;
        target = 0.12 + Math.min(0.88, rms * 6);
        if (rms > SPEECH_RMS) { a.heard = true; a.quietSince = now; }
        else if (a.heard && now - a.quietSince > SILENCE_MS && !busy.current) void finishUtterance();
      } else if (m === "speak") target = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(s * 8.6)), 2) * (0.55 + 0.45 * Math.sin(s * 1.9));
      else if (m === "think") target = 0.1 + 0.05 * Math.sin(s * 6);
      amp += (target - amp) * 0.22;
      orbEl.current?.style.setProperty("--amp", amp.toFixed(3));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Listen while the layer is open in voice mode and not muted.
  useEffect(() => {
    if (phase === "open" && mode === "voice" && !muted && moodRef.current !== "think" && moodRef.current !== "speak") void startListening();
    if (mode === "kb" || muted) stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, muted]);

  async function startListening() {
    if (audio.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const rec = new MediaRecorder(stream);
      const state = { stream, ctx, an, rec, chunks: [] as Blob[], heard: false, quietSince: performance.now() };
      rec.ondataavailable = (e) => { if (e.data.size) state.chunks.push(e.data); };
      rec.start(250);
      audio.current = state;
      setMoodBoth("listen");
    } catch {
      setMuted(true);
      setMoodBoth("mute");
      toast({ title: t("pocket.ai.micBlocked"), variant: "destructive" });
    }
  }
  function stopListening(): Blob | null {
    const a = audio.current;
    if (!a) return null;
    audio.current = null;
    try { if (a.rec.state !== "inactive") a.rec.stop(); } catch { /* */ }
    a.stream.getTracks().forEach((tr) => tr.stop());
    void a.ctx.close().catch(() => {});
    return a.chunks.length ? new Blob(a.chunks, { type: a.rec.mimeType || "audio/webm" }) : null;
  }
  async function finishUtterance() {
    busy.current = true;
    const a = audio.current;
    if (a && a.rec.state === "recording") await new Promise<void>((r) => { a.rec.onstop = () => r(); a.rec.stop(); });
    const blob = stopListening();
    if (!blob) { busy.current = false; return; }
    setMoodBoth("think");
    try {
      const text = (await transcribeAudio(blob)).trim();
      if (text) await ask(text);
      else resumeListening();
    } catch {
      toast({ title: t("pocket.ai.notHeard"), variant: "destructive" });
      resumeListening();
    } finally {
      busy.current = false;
    }
  }
  function resumeListening() {
    if (mode === "voice" && !muted) { setMoodBoth("listen"); void startListening(); } else setMoodBoth(muted ? "mute" : "idle");
  }

  function speak(text: string, done: () => void) {
    const synth = window.speechSynthesis;
    if (!prefs.speak || !synth || !text) { done(); return; }
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#`>]/g, ""));
    u.lang = lang === "fr" ? "fr-CA" : "en-CA";
    const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
    const idx = prefs.voice === "tide" ? 1 : prefs.voice === "stone" ? 2 : 0;
    if (voices.length) u.voice = voices[Math.min(idx, voices.length - 1)]!;
    u.pitch = prefs.voice === "stone" ? 0.85 : prefs.voice === "tide" ? 1 : 1.08;
    u.onend = done; u.onerror = done;
    setMoodBoth("speak");
    synth.cancel();
    synth.speak(u);
  }

  async function ask(text: string) {
    if (!conv) return;
    setMsgs((m) => [...m, { id: `u${Date.now()}`, mine: true, text }]);
    setMoodBoth("think");
    try {
      const turn = await assistantApi.send(conv.conversation.id, text, lang);
      void queryClient.invalidateQueries({ queryKey: ["assistant"] });
      const reply = turn.messages.filter((m) => m.role === "assistant" && m.content.trim()).map((m) => m.content).join("\n\n");
      const pending = turn.proposals.filter((p) => p.status === "pending");
      const auto = !prefs.confirmSend;
      for (const p of auto ? pending : []) await assistantApi.confirm(p.id).catch(() => undefined);
      const id = `b${Date.now()}`;
      const words = reply.split(" ");
      setMsgs((m) => [...m, { id, mine: false, text: "", streaming: true }, ...(auto ? [] : pending.map((p) => ({ id: p.id, mine: false, text: p.summary, proposal: p })))]);
      if (!auto && pending.length && mode === "voice") setMode("kb");
      let i = 0;
      const timer = window.setInterval(() => {
        i++;
        setMsgs((m) => m.map((x) => (x.id === id ? { ...x, text: words.slice(0, i).join(" "), streaming: i < words.length } : x)));
        if (i >= words.length) window.clearInterval(timer);
      }, 55);
      speak(reply, () => resumeListening());
    } catch (err) {
      setMsgs((m) => [...m, { id: `e${Date.now()}`, mine: false, text: (err as Error).message || t("pocket.ai.error") }]);
      resumeListening();
    }
  }

  const resolve = async (p: ProposalDto, yes: boolean) => {
    try {
      const r = yes ? await assistantApi.confirm(p.id) : await assistantApi.dismiss(p.id);
      setMsgs((m) => m.map((x) => (x.id === p.id ? { ...x, proposal: r.proposal } : x)));
      if (yes) { haptic("success"); void queryClient.invalidateQueries(); }
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
  };

  const sendTyped = () => {
    const v = draft.trim();
    if (!v || moodRef.current === "think") return;
    setDraft("");
    void ask(v);
  };

  if (phase === "closed") return null;
  const pal = PALETTE[prefs.voice] ?? PALETTE.ember;
  const vw = typeof window !== "undefined" ? window.innerWidth : 390, vh = typeof window !== "undefined" ? window.innerHeight : 844;
  const orbMood = muted ? "mute" : mood;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("pocket.ai.title")} className={`pk-ai ${phase === "closing" ? "pk-ai-out" : "pk-ai-in"}`}
      style={{ ["--fx" as string]: `${from.x}px`, ["--fy" as string]: `${from.y}px`, ["--ox" as string]: `${from.x - vw / 2}px`, ["--oy" as string]: `${from.y - vh * 0.46}px`, ["--ob" as string]: pal.base, ["--o1" as string]: pal.c[0], ["--o2" as string]: pal.c[1], ["--o3" as string]: pal.c[2] }}
      onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
      <div aria-hidden="true" className="pk-ai-amb" />
      <div className={`pk-orb-pos${mode === "kb" && phase !== "closing" ? " kb" : ""}`} aria-hidden="true">
        <div className={`pk-orb-enter ${phase === "closing" ? "leave" : "enter"}`}>
          <div ref={orbEl} className={`pk-orb-live ${orbMood}`}>
            <div className="pk-orb-glow" />
            <div className="pk-orb"><span className="pk-blob pk-b1" /><span className="pk-blob pk-b2" /><span className="pk-blob pk-b3" /><span className="pk-blob pk-b4" /><span className="pk-blob pk-b5" /><span className="pk-orb-shine" /></div>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{orbMood === "listen" ? t("pocket.ai.listening") : orbMood === "think" ? t("pocket.ai.thinking") : orbMood === "speak" ? t("pocket.ai.speaking") : ""}</p>

      {mode === "voice" && (
        <div className="pk-ctl" style={{ position: "absolute", left: 0, right: 0, bottom: "calc(44px + env(safe-area-inset-bottom, 0px))", display: "flex", alignItems: "center", justifyContent: "center", gap: 28 }}>
          <button type="button" className="pk-press pk-glass" onClick={() => { setMode("kb"); window.setTimeout(() => inputEl.current?.focus(), 450); }} aria-label={t("pocket.ai.type")} style={{ width: 56, height: 56, borderRadius: "50%", border: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", cursor: "pointer" }}><KeyboardIcon /></button>
          <button type="button" className="pk-press" onClick={() => { haptic("selection"); setMuted((m) => !m); }} aria-label={muted ? t("pocket.ai.unmute") : t("pocket.ai.mute")} aria-pressed={muted}
            style={{ width: 76, height: 76, borderRadius: "50%", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...(muted ? { background: "rgba(255,90,70,.18)", color: "#ff8a70", boxShadow: "inset 0 0 0 1px rgba(255,120,100,.35)" } : { background: "#ffffff", color: "#111113", boxShadow: "0 10px 30px -6px rgba(255,106,61,.45)" }) }}>
            {muted ? <MicOffIcon /> : <MicIcon size={26} />}
          </button>
          <button type="button" className="pk-press pk-glass" onClick={close} aria-label={t("pocket.ai.close")} style={{ width: 56, height: 56, borderRadius: "50%", border: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", cursor: "pointer" }}><CloseIcon /></button>
        </div>
      )}

      {mode === "kb" && (
        <>
          <button type="button" className="pk-press pk-glass pk-ctl" onClick={close} aria-label={t("pocket.ai.close")} style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top, 0px))", right: 16, width: 44, height: 44, borderRadius: "50%", border: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", cursor: "pointer" }}><CloseIcon size={18} /></button>
          <div className="pk-noscroll" style={{ position: "absolute", left: 0, right: 0, top: 190, bottom: "calc(104px + env(safe-area-inset-bottom, 0px))", padding: "0 20px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 14, overflowY: "auto" }}>
            {msgs.map((m) => m.mine ? (
              <div key={m.id} className="pk-msg-in" style={{ alignSelf: "flex-end", maxWidth: "78%", padding: "10px 14px", borderRadius: "20px 20px 6px 20px", background: "rgba(255,255,255,.1)", fontSize: 14.5, lineHeight: 1.45 }}>{m.text}</div>
            ) : m.proposal ? (
              <div key={m.id} className="pk-msg-in" style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 15, lineHeight: 1.55, color: "rgba(255,255,255,.9)" }}>{m.proposal.summary}</span>
                {m.proposal.status === "pending" ? (
                  <span style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="pk-press" onClick={() => void resolve(m.proposal!, true)} style={{ height: 40, padding: "0 16px", borderRadius: 20, border: 0, background: "#ffffff", color: "#111113", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>{t("pocket.ai.confirm")}</button>
                    <button type="button" className="pk-press pk-glass" onClick={() => void resolve(m.proposal!, false)} style={{ height: 40, padding: "0 16px", borderRadius: 20, border: 0, color: "#ffffff", fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>{t("pocket.ai.dismiss")}</button>
                  </span>
                ) : <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)" }}>{m.proposal.status === "confirmed" ? t("pocket.ai.done") : m.proposal.status === "dismissed" ? t("pocket.ai.dismissed") : m.proposal.error ?? ""}</span>}
              </div>
            ) : (
              <div key={m.id} className="pk-msg-in" style={{ alignSelf: "flex-start", maxWidth: "88%", fontSize: 15, lineHeight: 1.55, color: "rgba(255,255,255,.9)", whiteSpace: "pre-line" }}>{m.text}{m.streaming && <span className="pk-caret" />}</div>
            ))}
          </div>
          <div className="pk-kb-in" style={{ position: "absolute", left: 12, right: 12, bottom: "calc(28px + env(safe-area-inset-bottom, 0px))", display: "flex", alignItems: "center", gap: 8 }}>
            <form className="pk-glass" onSubmit={(e) => { e.preventDefault(); sendTyped(); }} style={{ flexGrow: 1, height: 52, borderRadius: 26, display: "flex", alignItems: "center", padding: "0 6px 0 18px", gap: 6 }}>
              <label htmlFor="pk-ai-input" className="sr-only">{t("pocket.ai.message")}</label>
              <input id="pk-ai-input" ref={inputEl} className="pk-ai-input" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("pocket.ai.placeholder")} style={{ flexGrow: 1, minWidth: 0, height: 40, border: 0, background: "transparent", color: "#ffffff", fontFamily: "inherit", fontSize: 15, outline: "none", letterSpacing: "-0.01em" }} />
              <button type="submit" className="pk-press" aria-label={t("pocket.ai.send")} style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "50%", border: 0, background: "#e4572e", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ArrowUpIcon size={17} stroke={2.3} /></button>
            </form>
            <button type="button" className="pk-press pk-glass" onClick={() => { setMode("voice"); setMuted(false); }} aria-label={t("pocket.ai.backToVoice")} style={{ width: 52, height: 52, flexShrink: 0, borderRadius: "50%", border: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", cursor: "pointer" }}><WaveIcon /></button>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
