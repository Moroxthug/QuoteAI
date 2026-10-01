// Two small things the join-code screen needs from the phone.
// 1. The code waiting while the person signs in or creates an account (it also rides in the ?code= route
//    param; this copy survives a sign-in that doesn't pass the param on, and an email-code round trip).
// 2. The clipboard. Reading it on a phone needs expo-clipboard, a native module (a dev-client rebuild), so only
//    the web reads it today; on a phone this answers null and the screen puts the cursor in the boxes so a
//    long-press paste works. Swap this one function when the module is added.
import { Platform } from "react-native";
import { cleanCode, isCodeComplete } from "./joinCode";
import { kvGet, kvSet } from "./kv";

const KEY = "quoteai.pendingJoinCode";

export async function savePendingJoinCode(code: string): Promise<void> {
  await kvSet(KEY, isCodeComplete(code) ? cleanCode(code) : null);
}

/** The code waiting for a sign-in to finish, or null. Reading it clears it. */
export async function takePendingJoinCode(): Promise<string | null> {
  const code = await kvGet(KEY);
  if (code === null) return null;
  await kvSet(KEY, null);
  return isCodeComplete(code) ? code : null;
}

export async function peekPendingJoinCode(): Promise<string | null> {
  const code = await kvGet(KEY);
  return code && isCodeComplete(code) ? code : null;
}

export async function readClipboardText(): Promise<string | null> {
  if (Platform.OS !== "web") return null;
  try {
    return (await globalThis.navigator?.clipboard?.readText?.()) ?? null;
  } catch {
    return null;
  }
}
