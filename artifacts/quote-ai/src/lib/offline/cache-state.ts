import { useSyncExternalStore } from "react";

// Phase 116: what the UI needs to know about the saved app data — whose it is
// and when it was synced — kept apart from the persistence code
// (query-cache.ts), so useAuth (every page) and the offline bar (also on the
// crew's /t page) don't pull that code into their bundles.

export type CacheProfile = { id: string; name: string; email: string; image?: string | null };

export type QueryCacheState = {
  /** When the record the app opened with was saved (null: the app opened empty). */
  restoredAt: number | null;
  /** The last time an answer came from the server (not the device) — what "synced at 9:42" means. */
  lastSyncedAt: number | null;
};

let restoredProfile: CacheProfile | null = null;
let state: QueryCacheState = { restoredAt: null, lastSyncedAt: null };
const listeners = new Set<() => void>();

/** The person the restored record belonged to — what the app shows while the session can't be checked (no signal). */
export function getRestoredProfile(): CacheProfile | null {
  return restoredProfile;
}

export function setRestoredProfile(p: CacheProfile | null): void {
  restoredProfile = p;
}

export function getCacheState(): QueryCacheState {
  return state;
}

export function setCacheState(patch: Partial<QueryCacheState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useQueryCacheState(): QueryCacheState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
