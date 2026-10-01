// Small things the phone remembers (secure store on the phone, localStorage on web).
// SecureStore keys allow only letters, digits, ".", "-" and "_".
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const clean = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

export async function kvGet(key: string): Promise<string | null> {
  try {
    return Platform.OS === "web" ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(clean(key));
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } else if (value === null) await SecureStore.deleteItemAsync(clean(key));
    else await SecureStore.setItemAsync(clean(key), value);
  } catch {
    /* the in-memory value still serves this run */
  }
}
