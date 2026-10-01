// Copy a code to the clipboard (a pairing code, access codes). expo-clipboard on the phone, the browser's clipboard on web; false when it can't.
import { Platform } from "react-native";

export async function copyText(text: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") { await globalThis.navigator?.clipboard?.writeText?.(text); return true; }
    const Clipboard = await import("expo-clipboard");
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}
