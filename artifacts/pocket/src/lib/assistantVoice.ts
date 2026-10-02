// The assistant layer's voice (HomeAI.dc.html): record what the person says, send it to the server (Groq Whisper, POST /api/assistant/listen), and read the answer aloud (Groq text to speech,
// POST /api/assistant/speak, English). Groq has no French voice, and a failed Groq voice should not leave the answer silent, so those are read by the phone's own voice (expo-speech). Not covered by node tests (native modules).
import { Platform } from "react-native";
import { API_ORIGIN } from "./session";
import { uploadFile } from "./jobUpload";

export type Heard = { ok: true; text: string } | { ok: false; problem: "empty" | "plan" | "offline" | "failed" };

/** What a finished recording becomes on the server: the text, or why not. */
export async function listen(uri: string, language: "en" | "fr"): Promise<Heard> {
  const web = Platform.OS === "web";
  const r = await uploadFile<{ text: string }>("/api/assistant/listen", "audio", { uri, name: web ? "voice.webm" : "voice.m4a", type: web ? "audio/webm" : "audio/mp4" }, { language });
  if (r.ok) return { ok: true, text: r.data.text };
  return { ok: false, problem: r.status === 0 ? "offline" : r.status === 403 ? "plan" : r.status === 422 ? "empty" : "failed" };
}

/** The phone's own voice: French, or English when Groq's voice is not available. Resolves when it has finished. */
async function speakOnDevice(text: string, language: "en" | "fr"): Promise<void> {
  const Speech = await import("expo-speech");
  await new Promise<void>((done) => {
    Speech.speak(text, { language: language === "fr" ? "fr-CA" : "en-CA", onDone: () => done(), onStopped: () => done(), onError: () => done() });
    setTimeout(done, 90_000);
  });
}

/** Reads `text` aloud. Resolves when it has finished. */
export async function speak(text: string, language: "en" | "fr", onStart?: () => void): Promise<void> {
  if (language !== "en") { onStart?.(); return speakOnDevice(text, language); }
  let res: Response | null = null;
  try { res = await fetch(`${API_ORIGIN}/api/assistant/speak`, { method: "POST", headers: { "content-type": "application/json", accept: "audio/wav" }, body: JSON.stringify({ text, language }) }); } catch { res = null; }
  if (!res || !res.ok) { onStart?.(); return speakOnDevice(text, language); }
  const bytes = new Uint8Array(await res.arrayBuffer());
  let uri: string;
  if (Platform.OS === "web") {
    uri = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  } else {
    const { File, Paths } = await import("expo-file-system");
    const file = new File(Paths.cache, `reply-${Date.now()}.wav`);
    file.create({ overwrite: true });
    file.write(bytes);
    uri = file.uri;
  }
  const { createAudioPlayer, setAudioModeAsync } = await import("expo-audio");
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  const player = createAudioPlayer({ uri });
  await new Promise<void>((done) => {
    const sub = player.addListener("playbackStatusUpdate", (s: { didJustFinish?: boolean }) => { if (s.didJustFinish) { sub.remove(); done(); } });
    onStart?.();
    player.play();
    setTimeout(done, 60_000);
  });
  player.remove();
}
