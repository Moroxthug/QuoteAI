import { useEffect } from "react";
import { dehydrate, hydrate, type QueryClient, type DehydratedState } from "@tanstack/react-query";
import { idbSupported, idbGet, idbPut, idbDelete, idbClear, QUERY_CACHE_STORE } from "./db";
import { prune, shouldPersist, MAX_AGE_MS, type SavedQuery } from "./query-policy";
import { getRestoredProfile, setRestoredProfile, getCacheState, setCacheState as set, useQueryCacheState, type CacheProfile } from "./cache-state";

// Phase 116 (docs/APP-PLAN.md "Sync I: open instantly, read offline").
//
// React Query's cache is saved to IndexedDB — one record per signed-in person
// and company — and put back before the app's first render, so the app opens
// to the last known jobs, quotes and schedule and then refreshes them in the
// background. With no signal the same record is what the app shows.
//
//   restore   main.tsx calls restoreQueryCache() on /dashboard/* before the
//             first render (capped, so a slow disk never delays the frame).
//             The record is found through a small pointer in localStorage
//             (ids only) naming whose cache was last used on this device.
//   save      debounced after answers arrive, and when the app goes to the
//             background — but only once confirmOwner() has checked the
//             session's person and the active company against the pointer,
//             so one person's answers are never written under another's name.
//   wipe      sign-out deletes every record, the pointer and the outbox.
//             Switching company points at the new company's record.
//
// What is saved and how fresh each answer must be: ./query-policy.ts.
// On the device the data sits in the browser's (or, from Phase 118, the
// app's) storage, which the phone encrypts at rest.

/** Bump when a saved answer's shape could crash a newer build. */
const SCHEMA = 1;
const OWNER_KEY = "qai-cache-owner";
const SAVE_DEBOUNCE_MS = 2_000;

export type CacheOwner = { userId: string; orgId: string | null };

type SavedRecord = {
  key: string;
  schema: number;
  owner: CacheOwner;
  profile: CacheProfile | null;
  savedAt: number;
  lastSyncedAt: number | null;
  state: DehydratedState;
};

let confirmed: CacheOwner | null = null;
let profile: CacheProfile | null = null;
let client: QueryClient | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

const recordKey = (o: CacheOwner) => `${o.userId}:${o.orgId ?? "own"}`;

function readOwner(): CacheOwner | null {
  try {
    const raw = localStorage.getItem(OWNER_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as CacheOwner;
    return typeof o?.userId === "string" ? { userId: o.userId, orgId: typeof o.orgId === "string" ? o.orgId : null } : null;
  } catch {
    return null;
  }
}

function writeOwner(o: CacheOwner | null) {
  try {
    if (o) localStorage.setItem(OWNER_KEY, JSON.stringify(o));
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    /* private mode: nothing is restored next time, nothing breaks */
  }
}

/**
 * Puts the last saved answers of the person who last used the app on this
 * device into `qc`. Resolves either way; never throws.
 */
export async function restoreQueryCache(qc: QueryClient): Promise<void> {
  client = qc;
  const owner = readOwner();
  if (!owner || !idbSupported()) return;
  try {
    const rec = await idbGet<SavedRecord>(QUERY_CACHE_STORE, recordKey(owner));
    if (!rec || rec.schema !== SCHEMA || rec.owner.userId !== owner.userId) return;
    const now = Date.now();
    const queries = rec.state.queries.filter((q) => now - q.state.dataUpdatedAt <= MAX_AGE_MS && shouldPersist(q.queryKey));
    if (queries.length === 0) return;
    hydrate(qc, { mutations: [], queries });
    setRestoredProfile(rec.profile);
    set({ restoredAt: rec.savedAt, lastSyncedAt: rec.lastSyncedAt });
  } catch {
    /* a broken record is ignored and overwritten by the next save */
  }
}

async function save(): Promise<void> {
  if (!client || !confirmed || !idbSupported()) return;
  const now = Date.now();
  const dehydrated = dehydrate(client, { shouldDehydrateQuery: (q) => q.state.status === "success" && shouldPersist(q.queryKey) });
  const { kept } = prune(dehydrated.queries as unknown as SavedQuery[], now);
  const rec: SavedRecord = {
    key: recordKey(confirmed),
    schema: SCHEMA,
    owner: confirmed,
    profile,
    savedAt: now,
    lastSyncedAt: getCacheState().lastSyncedAt,
    state: { mutations: [], queries: kept as unknown as DehydratedState["queries"] },
  };
  try {
    await idbPut(QUERY_CACHE_STORE, rec);
  } catch {
    /* quota or a closed database: the next save tries again */
  }
}

function scheduleSave(delay = SAVE_DEBOUNCE_MS) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void save();
  }, delay);
}

function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  void save();
}

/** Watches the cache: every answer from the server marks the time and schedules a save. Idempotent. */
export function startPersisting(qc: QueryClient): void {
  client = qc;
  if (unsubscribe || typeof window === "undefined") return;
  unsubscribe = qc.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success" || !shouldPersist(event.query.queryKey)) return;
    // setQueryData (optimistic edits, Phase 115) is `manual`: saved, but not proof of a sync.
    if (!event.action.manual && navigator.onLine) set({ lastSyncedAt: Date.now() });
    scheduleSave();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveNow();
  });
  window.addEventListener("pagehide", saveNow);
}

/**
 * Called by the signed-in app once the session and the active company are
 * known. A different person than the saved record's: everything on the device
 * is dropped. A different company: the cache is reset and refetched for it.
 * From here on the cache is saved under this owner.
 */
export function confirmOwner(qc: QueryClient, owner: CacheOwner, who: CacheProfile): void {
  const previous = readOwner();
  profile = who;
  if (confirmed && confirmed.userId === owner.userId && confirmed.orgId === owner.orgId) return;
  if (previous && previous.userId !== owner.userId) {
    void wipeRecords();
    set({ restoredAt: null, lastSyncedAt: null });
    void qc.resetQueries();
  } else if (previous && owner.orgId && previous.orgId && previous.orgId !== owner.orgId) {
    set({ restoredAt: null, lastSyncedAt: null });
    void qc.resetQueries();
  }
  confirmed = owner;
  writeOwner(owner);
  scheduleSave();
}

/**
 * The signed-in person is known before anything is drawn from the cache: when
 * it is not the person whose record was restored (their session ended and
 * someone else signed in on this device), the frame waits (false) while
 * every saved answer is dropped and refetched for the right person.
 */
export function useCacheOwnerCheck(qc: QueryClient, userId: string | null): boolean {
  useQueryCacheState(); // re-render once the stale record is gone
  const restored = getRestoredProfile();
  const mismatch = !!userId && !!restored && restored.id !== userId;
  useEffect(() => {
    if (!mismatch) return;
    confirmed = null; // nothing is saved until confirmOwner names the new person
    setRestoredProfile(null);
    writeOwner(null);
    void wipeRecords();
    void qc.resetQueries();
    set({ restoredAt: null, lastSyncedAt: null });
  }, [mismatch, qc]);
  return !mismatch;
}

/** Before the reload that follows a company switch: the next launch opens that company's record. */
export function pointCacheAtOrg(orgId: string | null): void {
  const o = confirmed ?? readOwner();
  if (!o) return;
  if (orgId) saveNow();
  else if (idbSupported()) void idbDelete(QUERY_CACHE_STORE, recordKey(o)).catch(() => undefined);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  confirmed = null; // nothing more is saved under the old company
  // null (left a company, joined one): the next launch opens empty and the app confirms the company itself.
  writeOwner(orgId ? { userId: o.userId, orgId } : null);
}

async function wipeRecords(): Promise<void> {
  if (idbSupported()) await idbClear(QUERY_CACHE_STORE).catch(() => undefined);
}

/** Sign-out: every saved answer on this device is deleted. */
export async function wipeQueryCache(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  confirmed = null;
  profile = null;
  setRestoredProfile(null);
  writeOwner(null);
  client?.clear();
  set({ restoredAt: null, lastSyncedAt: null });
  await wipeRecords();
}
