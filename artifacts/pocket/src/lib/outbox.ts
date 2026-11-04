// The office phone's outbox (SystemStates, "Offline and sync"). Quote edits and job notes made with no signal are kept on the phone and sent, oldest
// first, when the connection is back; job photos taken on mobile data wait for Wi-Fi unless the person taps Send now. The rules are in lib/sync.ts;
// the crew's own outbox (clock-ins, hours, reports through a crew link) is lib/crewOutbox.ts.
import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { ApiFailure } from "./api";
import { uuid } from "./crewOutbox";
import { kvGet, kvSet } from "./kv";
import { getNet, onBackOnline, onNetChange } from "./net";
import { API_ORIGIN } from "./session";
import { uploadFile, type UploadFile } from "./jobUpload";
import { afterAttempt, allPicked, coalesce, foldsInto, overlay, photosMaySend, resolve, type Attempt, type FieldGroup, type Op, type StaleOutcome } from "./sync";

const KEY = "quoteai_outbox";
const PHOTOS_KEY = "quoteai_photo_outbox";

export type Photo = { id: string; jobId: string; ref: string; file: UploadFile; size?: number; at: string };
/** What the Rejected card says once the last refused change is dealt with. */
export type Cleared = { how: "retried" | "discarded"; at: string; ref: string; from?: string } | null;
export type PhotoState = "idle" | "busy" | "done";

type State = { ops: Op[]; sending: boolean; photos: Photo[]; photoState: PhotoState; photoDone: { ref: string; count: number } | null; cleared: Cleared };
let state: State = { ops: [], sending: false, photos: [], photoState: "idle", photoDone: null, cleared: null };
const subs = new Set<() => void>();
const emit = (next: Partial<State>) => { state = { ...state, ...next }; subs.forEach((f) => f()); };

let loaded: Promise<void> | null = null;
const load = () => (loaded ??= (async () => {
  try { state = { ...state, ops: JSON.parse((await kvGet(KEY)) ?? "[]") as Op[] }; } catch { /* nothing kept */ }
  try { state = { ...state, photos: JSON.parse((await kvGet(PHOTOS_KEY)) ?? "[]") as Photo[] }; } catch { /* nothing kept */ }
  subs.forEach((f) => f());
})());
const saveOps = (ops: Op[]) => { emit({ ops }); void kvSet(KEY, ops.length ? JSON.stringify(ops) : null); };
const savePhotos = (photos: Photo[]) => { emit({ photos }); void kvSet(PHOTOS_KEY, photos.length ? JSON.stringify(photos) : null); };

let client: QueryClient | null = null;
/** What to refetch once an op has gone: the quote and the list, or the job's notes and photos. */
function refresh(path: string) {
  if (!client) return;
  const q = /^\/api\/quotes\/([^/]+)/.exec(path);
  if (q) { void client.invalidateQueries({ queryKey: ["quote", decodeURIComponent(q[1]!)] }); void client.invalidateQueries({ queryKey: ["quotes"] }); }
  const j = /^\/api\/jobs\/([^/]+)/.exec(path);
  if (j) { void client.invalidateQueries({ queryKey: ["job-notes", decodeURIComponent(j[1]!)] }); void client.invalidateQueries({ queryKey: ["job-photos", decodeURIComponent(j[1]!)] }); void client.invalidateQueries({ queryKey: ["job", decodeURIComponent(j[1]!)] }); }
}

/** The job's name from the open Job screen, for the rows ("Hart basement"). */
export const jobRef = (jobId: string): string => client?.getQueryData<{ job?: { name?: string } }>(["job", jobId])?.job?.name ?? "";

async function attempt(op: Op): Promise<Attempt & { data?: unknown }> {
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}${op.path}`, {
      method: op.method,
      headers: { accept: "application/json", "content-type": "application/json", ...(op.base ? { "x-base-version": op.base } : null) },
      body: JSON.stringify(op.body),
    });
  } catch {
    return { ok: false, status: 0 };
  }
  const text = await res.text();
  let body: { code?: string; error?: string; message?: string; current?: Record<string, unknown>; updatedAt?: string } = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
  if (res.ok) return { ok: true, data: body };
  return { ok: false, status: res.status, code: body.code ?? body.error, message: body.message ?? body.error, current: body.current, updatedAt: body.updatedAt };
}

const replace = (id: string, next: Op | null) => saveOps(next ? state.ops.map((o) => (o.id === id ? next : o)) : state.ops.filter((o) => o.id !== id));

/** Sends what waits, oldest first. Stops when there is no signal or quoteAI doesn't answer; a refusal or a conflict stays for the person. */
export async function flush(): Promise<void> {
  await load();
  if (state.sending || !getNet().online) return;
  emit({ sending: true });
  try {
    for (let guard = 0; guard < 100; guard++) {
      const op = state.ops.find((o) => o.state === "waiting");
      if (!op) break;
      const next = afterAttempt(op, await attempt(op));
      if (next.kind === "offline" || next.kind === "later") break;
      if (next.kind === "sent") { replace(op.id, null); refresh(op.path); continue; }
      if (next.kind === "rejected") { replace(op.id, next.op); continue; }
      applyOutcome(op.id, next.outcome);
    }
  } finally {
    emit({ sending: false });
  }
  void flushPhotos(false);
}

function applyOutcome(id: string, o: StaleOutcome) {
  if (o.kind === "done") { replace(id, null); return; }
  replace(id, o.op);
  if (o.kind === "conflict") refresh(o.op.path);
}

let started = false;
/** Once, from the root layout: send on the way back online, and once at start for what an earlier run left. */
export function startOutbox(qc: QueryClient): void {
  client = qc;
  if (started) return;
  started = true;
  onBackOnline(() => void flush());
  let wifi = getNet().wifi;
  onNetChange(() => {
    const now = getNet().wifi && getNet().online;
    if (now && !wifi) void flushPhotos(false);
    wifi = now;
  });
  void load().then(() => flush());
}

export const useOutbox = (): State => {
  void load();
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state, () => state);
};

/** A row with this phone's waiting edits laid over it. */
export const withWaiting = <T extends Record<string, unknown>>(row: T, path: string): T => overlay(row, state.ops, path);

type Saved<T> = { value: T; queued: boolean };

/**
 * Saves an edit to a quote (PUT /api/quotes/:id) against the version the screen shows. With no signal, or behind other edits still waiting, it is kept on
 * the phone and the quote is shown with it ("queued"). When another device changed the quote meanwhile, fields that don't collide go again; a collision
 * waits in the Conflict card. A refusal while online is thrown, as before.
 */
export async function saveQuoteEdit<T extends { id: string; updatedAt: string; numeroPreventivoData?: string | null }>(quote: T, body: Record<string, unknown>, ref: string): Promise<Saved<T>> {
  await load();
  const path = `/api/quotes/${encodeURIComponent(quote.id)}`;
  const before: Record<string, unknown> = {};
  for (const k of Object.keys(body)) before[k] = (quote as unknown as Record<string, unknown>)[k];
  const op: Op = { id: uuid(), kind: "quote", method: "PUT", path, body, base: quote.updatedAt, before, ref, at: new Date().toISOString(), state: "waiting" };
  const behind = state.ops.find((o) => o.path === path && o.state !== "rejected");
  if (behind) {
    if (foldsInto(behind, op)) replace(behind.id, coalesce(behind, op));
    else saveOps([...state.ops, op]);
    void flush();
    return { value: { ...quote, ...body }, queued: true };
  }
  const a = await attempt(op);
  const next = afterAttempt(op, a);
  if (next.kind === "sent") return { value: (a as { data: T }).data, queued: false };
  if (next.kind === "offline" || next.kind === "later") { saveOps([...state.ops, op]); return { value: { ...quote, ...body }, queued: true }; }
  if (next.kind === "stale") {
    const o = next.outcome;
    if (o.kind === "done") return { value: { ...(a as { current: T }).current, updatedAt: (a as { updatedAt: string }).updatedAt }, queued: false };
    if (o.kind === "resend") {
      const again = await attempt(o.op);
      if (again.ok) return { value: again.data as T, queued: false };
      saveOps([...state.ops, o.op]);
      void flush();
      return { value: { ...quote, ...body }, queued: true };
    }
    saveOps([...state.ops, o.op]);
    return { value: { ...((a as { current: T }).current), ...o.op.body }, queued: true };
  }
  throw new ApiFailure(next.op.rejected!.status, next.op.rejected!.code, next.op.rejected!.message ?? `HTTP ${next.op.rejected!.status}`);
}

/** Adds a note to a job; with no signal it waits on the phone ("queued"). */
export async function addJobNote(jobId: string, ref: string, text: string): Promise<{ queued: boolean }> {
  await load();
  const op: Op = { id: uuid(), kind: "jobNote", method: "POST", path: `/api/jobs/${encodeURIComponent(jobId)}/notes`, body: { body: text }, ref, at: new Date().toISOString(), state: "waiting" };
  const a = await attempt(op);
  const next = afterAttempt(op, a);
  if (next.kind === "sent") return { queued: false };
  if (next.kind === "offline" || next.kind === "later") { saveOps([...state.ops, op]); return { queued: true }; }
  const r = next.kind === "rejected" ? next.op.rejected! : { status: 409, message: "STALE" };
  throw new ApiFailure(r.status, r.code, r.message ?? `HTTP ${r.status}`);
}

/** Rejected by the server: Retry sends it again as it is (on the latest version); Discard keeps what the server has. */
export async function retry(id: string): Promise<void> {
  const op = state.ops.find((o) => o.id === id);
  if (!op) return;
  const fresh: Op = { ...op, base: null, state: "waiting", rejected: undefined };
  const a = await attempt(fresh);
  const next = afterAttempt(fresh, a);
  if (next.kind === "sent") { replace(id, null); refresh(op.path); emit({ cleared: { how: "retried", at: new Date().toISOString(), ref: op.ref } }); return; }
  if (next.kind === "offline" || next.kind === "later") { replace(id, fresh); return; }
  if (next.kind === "rejected") { replace(id, next.op); return; }
  applyOutcome(id, next.outcome);
}

export function discard(id: string): void {
  const op = state.ops.find((o) => o.id === id);
  if (!op) return;
  replace(id, null);
  refresh(op.path);
  emit({ cleared: { how: "discarded", at: new Date().toISOString(), ref: op.ref } });
}

/** Conflict: one side per field group, then Save my choices. */
export function pick(id: string, group: FieldGroup, side: "mine" | "theirs"): void {
  const op = state.ops.find((o) => o.id === id);
  if (!op?.conflict) return;
  replace(id, { ...op, conflict: { ...op.conflict, picks: { ...op.conflict.picks, [group]: side } } });
}

export async function saveChoices(id: string): Promise<void> {
  const op = state.ops.find((o) => o.id === id);
  if (!op?.conflict || !allPicked(op.conflict)) return;
  applyOutcome(id, resolve(op));
  refresh(op.path);
  await flush();
}

/** A job photo: sent now on Wi-Fi; on mobile data or with no signal it waits for Wi-Fi ("queued"). */
export async function addJobPhotoFile(jobId: string, ref: string, file: UploadFile & { size?: number }): Promise<{ queued: boolean; ok: boolean }> {
  await load();
  const net = getNet();
  if (photosMaySend(net, false) && !state.photos.length) {
    const up = await uploadFile(`/api/jobs/${encodeURIComponent(jobId)}/photos`, "file", file);
    if (up.ok) { refresh(`/api/jobs/${encodeURIComponent(jobId)}`); return { queued: false, ok: true }; }
    if (up.status !== 0) return { queued: false, ok: false };
  }
  savePhotos([...state.photos, { id: uuid(), jobId, ref, file, size: file.size, at: new Date().toISOString() }]);
  return { queued: true, ok: true };
}

/** Sends the waiting photos: on Wi-Fi by itself, on mobile data when the person tapped Send now. */
export async function flushPhotos(forced: boolean): Promise<void> {
  await load();
  if (!state.photos.length || state.photoState === "busy" || !photosMaySend(getNet(), forced)) return;
  emit({ photoState: "busy" });
  let sent = 0;
  let ref = "";
  for (const p of [...state.photos]) {
    const up = await uploadFile(`/api/jobs/${encodeURIComponent(p.jobId)}/photos`, "file", p.file);
    if (!up.ok && up.status === 0) break;
    savePhotos(state.photos.filter((x) => x.id !== p.id));
    if (up.ok) { sent++; ref = p.ref; refresh(`/api/jobs/${encodeURIComponent(p.jobId)}`); }
  }
  emit({ photoState: state.photos.length ? "idle" : sent ? "done" : "idle", photoDone: sent ? { ref, count: sent } : null });
}

/** The Photos sent line goes once it has been seen. */
export function clearPhotoDone(): void {
  if (state.photoState === "done") emit({ photoState: "idle", photoDone: null });
}
export function clearCleared(): void {
  if (state.cleared) emit({ cleared: null });
}
