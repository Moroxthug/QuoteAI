// What's new: what the phone remembers (the last version whose sheet was shown).
import Constants from "expo-constants";
import { kvGet, kvSet } from "./kv";
import { shouldShow } from "./whatsNew";

const SEEN_KEY = "quoteai_whatsnew_seen";
export const appVersion = (): string => Constants.expoConfig?.version ?? "1.0";

export async function checkWhatsNew(): Promise<boolean> {
  const cur = appVersion();
  const r = shouldShow(await kvGet(SEEN_KEY), cur);
  if (r.record) await kvSet(SEEN_KEY, cur);
  return r.show;
}
export const markSeen = (): Promise<void> => kvSet(SEEN_KEY, appVersion());
