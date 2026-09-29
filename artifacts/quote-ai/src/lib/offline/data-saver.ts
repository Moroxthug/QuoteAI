import { useSyncExternalStore } from "react";
import type { OutboxOp } from "./outbox";

// Phase 122 — "Upload photos on Wi-Fi only" (More → This app). A crew that
// shoots twenty photos a day on a phone plan can keep them on the phone until
// it is on Wi-Fi: the photo is saved in the outbox at once (the job shows it
// as waiting), everything else still goes over the phone's data, and the
// photos go the moment Wi-Fi is back — or now, from the sync panel.
//
// What the connection is: the app asks the phone (@capacitor/network, fed in
// by lib/native/shell.ts); a browser that says (Chrome on Android,
// navigator.connection.type) is believed; anything that can't tell — a
// laptop, Safari — is never held, so a photo can't wait forever on a guess.

export type ConnectionKind = "wifi" | "cellular" | "unknown";

const KEY = "quoteai.photosOnWifiOnly";
const listeners = new Set<() => void>();
let nativeKind: ConnectionKind | null = null;

type NetInfo = { type?: string; addEventListener?: (t: "change", l: () => void) => void; removeEventListener?: (t: "change", l: () => void) => void };
const netInfo = (): NetInfo | undefined => (typeof navigator === "undefined" ? undefined : (navigator as Navigator & { connection?: NetInfo }).connection);

function notify(): void {
  for (const l of listeners) l();
}

function photosOnWifiOnly(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setPhotosOnWifiOnly(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: stays off */
  }
  notify();
}

/** A connection type as a phone or a browser names it. */
export function kindOf(type: string | undefined | null): ConnectionKind {
  if (type === "wifi" || type === "ethernet") return "wifi";
  if (type === "cellular" || type === "wimax") return "cellular";
  return "unknown";
}

/** The phone app's shell reports what the phone is on. */
export function setNativeConnection(type: string | undefined | null): void {
  const next = kindOf(type);
  if (next === nativeKind) return;
  nativeKind = next;
  notify();
}

function connectionKind(): ConnectionKind {
  return nativeKind ?? kindOf(netInfo()?.type);
}

/** The queued writes that carry a photo (receipts and voice notes are small and needed now). */
export function carriesPhoto(op: OutboxOp): boolean {
  return op.kind === "job.uploadPhoto" || (op.kind === "worker.report" && !!op.file);
}

/** The rule, without the device: held only when asked, on a phone plan, not sent anyway, and a photo. */
export function waitsForWifi(op: OutboxOp, s: { wifiOnly: boolean; connection: ConnectionKind; sendNow?: boolean }): boolean {
  return s.wifiOnly && !s.sendNow && s.connection === "cellular" && carriesPhoto(op);
}

export function holdsForWifi(row: { op: OutboxOp; sendNow?: boolean }): boolean {
  return waitsForWifi(row.op, { wifiOnly: photosOnWifiOnly(), connection: connectionKind(), sendNow: row.sendNow });
}

/** Re-renders when the setting or the connection changes (what is held can change without the queue changing). */
export function useDataSaver(): { wifiOnly: boolean; connection: ConnectionKind } {
  const key = useSyncExternalStore(onConnectionChange, () => `${photosOnWifiOnly() ? 1 : 0}:${connectionKind()}`, () => "0:unknown");
  const [on, connection] = key.split(":");
  return { wifiOnly: on === "1", connection: connection as ConnectionKind };
}

/** The connection or the setting changed. Returns the unsubscribe. */
export function onConnectionChange(listener: () => void): () => void {
  listeners.add(listener);
  const info = netInfo();
  info?.addEventListener?.("change", listener);
  return () => {
    listeners.delete(listener);
    info?.removeEventListener?.("change", listener);
  };
}
