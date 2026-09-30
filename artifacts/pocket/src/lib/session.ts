// The app talks to the existing API (artifacts/api-server) with better-auth's bearer token,
// kept in the phone's secure store. EXPO_PUBLIC_API_ORIGIN picks the server; in development
// the Android emulator reaches this computer at 10.0.2.2.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

const KEY = "quoteai_session-token";

export const API_ORIGIN =
  process.env.EXPO_PUBLIC_API_ORIGIN ?? (__DEV__ ? (Platform.OS === "android" ? "http://10.0.2.2:5088" : "http://localhost:5088") : "https://quoteai.ca");

let cached: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  cached = Platform.OS === "web" ? globalThis.localStorage?.getItem(KEY) ?? null : await SecureStore.getItemAsync(KEY);
  return cached;
}

export async function setToken(token: string | null): Promise<void> {
  cached = token;
  if (Platform.OS === "web") {
    if (token) globalThis.localStorage?.setItem(KEY, token);
    else globalThis.localStorage?.removeItem(KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}

setBaseUrl(API_ORIGIN);
setAuthTokenGetter(getToken);

