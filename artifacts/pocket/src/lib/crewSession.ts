// The crew's phone has no account: it holds the personal link token the pairing code was swapped for (and which company, for a person on two crews).
// Kept in the secure store like the sign-in token. `token~workerId` is how the server addresses another company's record of the same person.
import { useSyncExternalStore } from "react";
import { kvGet, kvSet } from "./kv";

const TOKEN_KEY = "quoteai_crew_token";
const WORKER_KEY = "quoteai_crew_worker";

type State = { loaded: boolean; token: string | null; workerId: string | null };
let state: State = { loaded: false, token: null, workerId: null };
const listeners = new Set<() => void>();
const emit = (next: State) => { state = next; listeners.forEach((l) => l()); };

let loading: Promise<void> | null = null;
/** Reads the stored link once. */
export function loadCrewSession(): Promise<void> {
  if (!loading) {
    loading = Promise.all([kvGet(TOKEN_KEY), kvGet(WORKER_KEY)]).then(([token, workerId]) => emit({ loaded: true, token, workerId }));
  }
  return loading;
}

export async function pairCrewPhone(token: string): Promise<void> {
  await Promise.all([kvSet(TOKEN_KEY, token), kvSet(WORKER_KEY, null)]);
  emit({ loaded: true, token, workerId: null });
}

export async function forgetCrewPhone(): Promise<void> {
  await Promise.all([kvSet(TOKEN_KEY, null), kvSet(WORKER_KEY, null), kvSet(MEMO_KEY, null)]);
  emit({ loaded: true, token: null, workerId: null });
}

/** Switch company: the same link, the other company's record of this person (null: the first). */
export async function chooseCrewWorker(workerId: string | null): Promise<void> {
  await kvSet(WORKER_KEY, workerId);
  emit({ ...state, workerId });
}

export const crewPath = (token: string, workerId: string | null): string => (workerId ? `${token}~${workerId}` : token);

export function useCrewSession(): State & { path: string | null } {
  const s = useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => state, () => state);
  return { ...s, path: s.token ? crewPath(s.token, s.workerId) : null };
}

const MEMO_KEY = "quoteai_crew_memo";
export type CrewMemo = { workerName: string; companyName: string; language: "en" | "fr" };
/** What the phone last knew about who it belongs to, so the "link expired" screens can name the company and the person with no signal. */
export async function rememberCrew(m: CrewMemo): Promise<void> { await kvSet(MEMO_KEY, JSON.stringify(m)); }
export async function recallCrew(): Promise<CrewMemo | null> {
  try { const raw = await kvGet(MEMO_KEY); return raw ? (JSON.parse(raw) as CrewMemo) : null; } catch { return null; }
}
