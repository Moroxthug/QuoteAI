// Speech to text through the API (Whisper, api-server routes/speech.ts). Used
// right after a recording, and by the outbox for one made with no signal
// (Phase 119: record offline, written out when the phone is back online).

export class TranscribeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const formData = new FormData();
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  formData.append("audio", blob, `recording.${ext}`);
  const res = await fetch("/api/speech/transcribe", { method: "POST", credentials: "include", body: formData });
  const data = (await res.json().catch(() => ({}))) as { text?: unknown; error?: string };
  if (!res.ok) throw new TranscribeError(data.error || "Transcription failed. Please try again.", res.status);
  return typeof data.text === "string" ? data.text.trim() : "";
}
