// The device parts of New quote: the mic (expo-audio records, POST /api/speech/transcribe turns it into text) and the
// photo picker (expo-image-picker). Both are native modules the installed dev client may not have yet, so each is
// loaded on its own and the screen gets a plain "not available" instead of a crash.
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { AttachFile } from "./firstQuoteApi";
import { newQuoteApi } from "./newQuoteApi";

type AudioModule = typeof import("expo-audio");
let audio: AudioModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  audio = require("expo-audio") as AudioModule;
} catch {
  audio = null;
}

export type DictationState = "idle" | "listening" | "busy";
export type DictationProblem = "unavailable" | "denied" | "failed" | "offline";
export type DictationResult = { ok: true; text: string } | { ok: false; problem: DictationProblem };
export type Dictation = { state: DictationState; available: boolean; toggle: () => Promise<DictationResult | null> };

// A phone records m4a (audio/mp4); the web recorder makes webm. Both are on the server's list.
const CLIP = Platform.OS === "web" ? { name: "dictation.webm", type: "audio/webm" } : { name: "dictation.m4a", type: "audio/mp4" };

function useNative(): Dictation {
  const a = audio!;
  const recorder = a.useAudioRecorder(a.RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<DictationState>("idle");
  const live = useRef(false);
  useEffect(() => () => { if (live.current) void recorder.stop().catch(() => undefined); }, [recorder]);

  const toggle = useCallback(async (): Promise<DictationResult | null> => {
    if (state === "busy") return null;
    try {
      if (state === "idle") {
        const perm = await a.requestRecordingPermissionsAsync();
        if (!perm.granted) return { ok: false, problem: "denied" };
        await a.setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        live.current = true;
        setState("listening");
        return null;
      }
      setState("busy");
      live.current = false;
      await recorder.stop();
      await a.setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      const uri = recorder.uri;
      if (!uri) { setState("idle"); return { ok: false, problem: "failed" }; }
      const r = await newQuoteApi.transcribe({ uri, ...CLIP });
      setState("idle");
      return r.ok ? { ok: true, text: r.text } : { ok: false, problem: r.problem };
    } catch {
      live.current = false;
      setState("idle");
      return { ok: false, problem: "failed" };
    }
  }, [a, recorder, state]);

  return { state, available: true, toggle };
}

function useNone(): Dictation {
  return { state: "idle", available: false, toggle: async () => ({ ok: false, problem: "unavailable" }) };
}

/** The mic: `toggle` starts recording, then (second tap) stops it and gives the text. Without the native module it says "unavailable". */
export const useDictation: () => Dictation = audio ? useNative : useNone;

export type PhotoResult = { ok: true; files: AttachFile[] } | { ok: false; problem: "unavailable" | "denied" | "failed" };

/** Up to `limit` photos from the library (the server takes three per quote), as files for the multipart create. */
export async function pickPhotos(limit: number): Promise<PhotoResult> {
  let picker: typeof import("expo-image-picker");
  try {
    picker = await import("expo-image-picker");
  } catch {
    return { ok: false, problem: "unavailable" };
  }
  try {
    if (Platform.OS !== "web") {
      const perm = await picker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return { ok: false, problem: "denied" };
    }
    const r = await picker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 0.8 });
    if (r.canceled) return { ok: true, files: [] };
    return {
      ok: true,
      files: r.assets.slice(0, limit).map((x, i) => {
        const type = x.mimeType && x.mimeType.startsWith("image/") ? x.mimeType : "image/jpeg";
        const ext = type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1] ?? "jpg";
        return { uri: x.uri, name: x.fileName && /\.\w+$/.test(x.fileName) ? x.fileName : `photo-${i + 1}.${ext}`, type };
      }),
    };
  } catch {
    return { ok: false, problem: "unavailable" };
  }
}
