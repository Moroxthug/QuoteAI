// Whether the phone has a signal, whether it is on Wi-Fi, and whether quoteAI answers (SystemStates: "You're offline", "Can't reach quoteAI right now",
// "Showing what was synced at 9:41"). The phone's own network state comes from expo-network; the app's fetch (lib/session.ts) reports every answer and
// every request that never got one, so a phone that has a signal but can't reach the server is told apart from one with no signal.
import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";

export type Net = {
  /** The phone has a connection (true until told otherwise). */
  online: boolean;
  wifi: boolean;
  /** quoteAI answered the last request (false: a signal, but no answer). */
  reachable: boolean;
  /** When the last read came back from the server (ms). */
  syncedAt: number | null;
};

let net: Net = { online: true, wifi: true, reachable: true, syncedAt: null };
const subs = new Set<() => void>();
const set = (next: Partial<Net>) => {
  const n = { ...net, ...next };
  if (n.online === net.online && n.wifi === net.wifi && n.reachable === net.reachable && n.syncedAt === net.syncedAt) return;
  const back = (!net.online || !net.reachable) && n.online && n.reachable;
  net = n;
  onlineManager.setOnline(n.online);
  subs.forEach((f) => f());
  if (back) backListeners.forEach((f) => f());
};

const backListeners = new Set<() => void>();
/** Called each time the phone gets its connection back (or quoteAI answers again): the outbox sends what waits. */
export function onBackOnline(fn: () => void): () => void {
  backListeners.add(fn);
  return () => { backListeners.delete(fn); };
}

export const getNet = (): Net => net;
/** Every change (the photo queue waits for Wi-Fi). */
export function onNetChange(fn: () => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}
export const useNet = (): Net => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => net, () => net);

/** From the app's fetch: an answer came back. A gateway error (502 to 504) is quoteAI not answering; a read that worked moves "synced at". */
export function noteAnswer(method: string, status: number): void {
  if (status >= 502 && status <= 504) { set({ online: true, reachable: false }); return; }
  set({ online: true, reachable: true, ...(status < 300 && method.toUpperCase() === "GET" ? { syncedAt: Date.now() } : null) });
}

/** From the app's fetch: the request never got an answer. With a signal, quoteAI is unreachable; without one, the phone is offline. */
export function noteNoAnswer(): void {
  set(net.online ? { reachable: false } : {});
  void readPhone();
}

let ping: ReturnType<typeof setInterval> | null = null;
let origin = "";

async function readPhone(): Promise<void> {
  try {
    const Network = await import("expo-network");
    const s = await Network.getNetworkStateAsync();
    apply(s);
  } catch { /* no native module (an old dev client): fetch results alone decide */ }
}

function apply(s: { isConnected?: boolean; isInternetReachable?: boolean; type?: string }) {
  const online = s.isConnected !== false && s.isInternetReachable !== false;
  set({ online, wifi: s.type === "WIFI" || s.type === "ETHERNET" || (s.type === "UNKNOWN" && online) });
}

/** quoteAI is asked again every 20 s while it doesn't answer (and the person can tap Try again). */
export async function tryServer(): Promise<boolean> {
  try {
    const r = await fetch(`${origin}/api/healthz`, { headers: { accept: "application/json" } });
    return r.ok;
  } catch {
    return false;
  }
}

let started = false;
/** Once, from the root layout. */
export function startNet(apiOrigin: string): void {
  if (started) return;
  started = true;
  origin = apiOrigin;
  void (async () => {
    try {
      const Network = await import("expo-network");
      apply(await Network.getNetworkStateAsync());
      Network.addNetworkStateListener(apply);
    } catch { /* see readPhone */ }
  })();
  subs.add(() => {
    const down = net.online && !net.reachable;
    if (down && !ping) ping = setInterval(() => void tryServer(), 20_000);
    if (!down && ping) { clearInterval(ping); ping = null; }
  });
}
