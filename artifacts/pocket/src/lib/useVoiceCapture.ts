// One recording at a time for the assistant layer: ask for the microphone, start, and stop with the file's address. Not covered by node tests (native modules).
import { useCallback, useRef } from "react";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";

export type Started = "ok" | "denied" | "failed";

export function useVoiceCapture() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const on = useRef(false);
  const start = useCallback(async (): Promise<Started> => {
    try {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) return "denied";
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      on.current = true;
      return "ok";
    } catch (e) { if (__DEV__) console.warn("voice start", e); return "failed"; }
  }, [recorder]);
  /** Stops and returns the recording's address (null when nothing was recording). */
  const stop = useCallback(async (): Promise<string | null> => {
    if (!on.current) return null;
    on.current = false;
    try { await recorder.stop(); await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch { return null; }
    return recorder.uri ?? null;
  }, [recorder]);
  return { start, stop };
}
