// Describing the job out loud (the board's mic). Recording needs expo-audio / expo-av, which is a
// native module the current dev client does not have, so capture is not built yet: this stub says
// so, and the screen shows a short note instead. When the module is added, record here and send the
// clip to POST /api/speech/transcribe (multipart "audio"; see api-server/src/routes/speech.ts),
// then resolve { ok: true, text }.
export type VoiceResult = { ok: true; text: string } | { ok: false; problem: "unavailable" | "denied" | "failed" };

export const voiceAvailable = false;

export async function captureJob(): Promise<VoiceResult> {
  return { ok: false, problem: "unavailable" };
}
