import { useCallback, useRef, useState } from "react";

const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickMimeType(): string {
  for (const type of PREFERRED_MIME_TYPES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

interface UseVoiceInputOptions {
  onTranscribed: (text: string) => void;
  onError?: (message: string) => void;
  /** Phase 78: take the raw recording instead of transcribing it here (the on-site sheet posts it to /api/assistant/voice). */
  onRecorded?: (blob: Blob) => void | Promise<void>;
}

export function useVoiceInput({ onTranscribed, onError, onRecorded }: UseVoiceInputOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const transcribe = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      formData.append("audio", blob, `recording.${ext}`);

      const res = await fetch("/api/speech/transcribe", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        onError?.(data.error || "Transcription failed. Please try again.");
        return;
      }
      if (data.text && typeof data.text === "string" && data.text.trim()) {
        onTranscribed(data.text.trim());
      } else {
        onError?.("Didn't catch that — try speaking more clearly.");
      }
    } catch {
      onError?.("Connection error. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscribed, onError]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("Your browser doesn't support audio recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        cleanupStream();
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size > 0) {
          if (onRecorded) void onRecorded(blob);
          else void transcribe(blob);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      onError?.("Couldn't access the microphone. Check your browser permissions.");
      cleanupStream();
    }
  }, [isRecording, cleanupStream, transcribe, onError, onRecorded]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  return { isRecording, isTranscribing, startRecording, stopRecording };
}
