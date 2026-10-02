// The assistant layer's voice (HomeAI.dc.html): record what the person says, send it to the server (Groq Whisper, POST /api/assistant/listen), and read the answer aloud (Groq text to speech,
// POST /api/assistant/speak, English only: Groq has no French voice, so a French answer is only shown). Not covered by node tests (native modules).
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

/** Reads `text` aloud. Resolves when it has finished (or at once when there is no voice for the language or the server cannot make one). */
export async function speak(text: string, language: "en" | "fr", onStart?: () => void): Promise<void> {
  if (language !== "en") return;
  let res: Response;
  try { res = await fetch(`${API_ORIGIN}/api/assistant/speak`, { method: "POST", headers: { "content-type": "application/json", accept: "audio/wav" }, body: JSON.stringify({ text, language }) }); } catch { return; }
  if (!res.ok) return;
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
