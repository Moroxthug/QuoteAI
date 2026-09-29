import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { idbSupported, idbGetAll, idbPut, idbDelete, idbClear, OUTBOX_STORE } from "./db";
import { jobsApi, type CostCategory, type CostEntryEdit } from "../jobs-api";
import { workerApi, type CrewTaskStatus, type FieldReportKind } from "../team-api";
import type { EditBase } from "../sync/protocol";
import type { FieldConflict } from "../sync/merge";
import { tempIdFor, TEMP_ID_RE } from "../sync/temp-id";
import { rawFetch } from "../sync/raw-fetch";
import { transcribeAudio } from "../speech";
import { isForeground } from "../app-state";
import { holdsForWifi, onConnectionChange } from "./data-saver";

/** Phase 117: the replay of queued edits is its own chunk, loaded when there is one to send. */
const syncCore = () => import("../sync/replay");

// Phase 77 (docs/PILOT-LAUNCH-PLAN.md): the offline outbox.
//
// The writes a crew makes on site — clock in/out, hours, a cost, a photo —
// are appended here when the network is gone (or a request dies mid-flight)
// and replayed, in order, as soon as it is back. Every op is sent with its
// own id as `clientRef`, so a replay the server already applied returns the
// same row instead of a duplicate, and the clock ops carry `at` (when the tap
// happened). Conflicts are the server's call: last write wins on unreviewed
// entries, with an audit row (api-server/src/routes/worker-time.ts).
//
// Ops are kept in IndexedDB (photos as blobs), mirrored in memory for the UI.
// A queue stops at the first network failure (everything after it waits); a
// 4xx marks that op `failed` for the person to retry or discard, and the
// queue moves on.
//
// Phase 117 (docs/APP-PLAN.md "Sync II"): one outbox for everything. The
// `api` op is any edit in lib/sync/routes.ts, queued by the sync layer
// (lib/sync/sync-fetch.ts) with its Idempotency-Key and, for versioned edits,
// the version and values it was made against. On replay a row changed
// elsewhere is merged field by field; when both sides changed the same field
// the op becomes a `conflict` and waits for the person (keep mine / theirs)
// without holding up the rest of the queue. A queued create's stand-in id
// (`q_<op id>`) is swapped for the real one in the ops behind it.

export type OutboxOp =
  | { kind: "worker.clockIn"; token: string; projectId: string; milestoneId: string | null; lat?: number; lng?: number; at: string }
  | { kind: "worker.clockOut"; token: string; entryId?: string; entryClientRef?: string; lat?: number; lng?: number; at: string }
  | { kind: "worker.addEntry"; token: string; projectId: string; date: string; hours: number; milestoneId: string | null; note?: string }
  | { kind: "job.addCost"; jobId: string; body: CostEntryEdit & { category: CostCategory; totalCents: number } }
  | { kind: "job.addTimeEntry"; jobId: string; body: { workerId: string; date: string; hours: number; milestoneId?: string | null; note?: string; approve?: boolean } }
  | { kind: "job.uploadPhoto"; jobId: string; file: Blob; fileName: string; milestoneId?: string | null; caption?: string }
  // Phase 86: what a crew member sends from the field, and a task ticked on site.
  | { kind: "worker.report"; token: string; projectId: string; reportKind: FieldReportKind; body?: string; milestoneId?: string | null; materialsCents?: number | null; file?: Blob | null; fileName?: string }
  | { kind: "worker.task"; token: string; taskId: string; status: CrewTaskStatus }
  | { kind: "worker.addTask"; token: string; projectId: string; title: string }
  // Phase 89b: km or per diem logged on site.
  | { kind: "worker.allowance"; token: string; allowanceKind: "mileage" | "per_diem"; quantity: number; date: string; projectId: string | null; note?: string }
  // Phase 119: a receipt snapped with no signal (read by the OCR when sent), a
  // job note dictated on site, a dictation for the new-quote box.
  | { kind: "job.scanReceipt"; jobId: string | null; file: Blob; fileName: string }
  | { kind: "job.voiceNote"; jobId: string; audio: Blob }
  | { kind: "voice.dictation"; target: string; audio: Blob }
  // Phase 117: any edit the sync layer queued (lib/sync/routes.ts).
  | { kind: "api"; method: string; path: string; body: string | null; key: string; base: EditBase | null };

type OutboxStatus = "pending" | "failed" | "conflict";

/** Both sides changed the same field(s): the person picks, per field. */
export type OutboxConflict = { fields: FieldConflict[]; patch: Record<string, unknown>; current: Record<string, unknown>; version: string };

export type OutboxRow = {
  /** Also the clientRef sent to the server. */
  id: string;
  /** Groups rows per page: the worker token or the job id. */
  scope: string;
  /** Short human label for the sync panel ("Clock in · Basement finish"). */
  label: string;
  createdAt: string;
  attempts: number;
  status: OutboxStatus;
  error: string | null;
  op: OutboxOp;
  conflict?: OutboxConflict;
  /** Phase 122: a photo held for Wi-Fi that the person chose to send over the phone's data anyway. */
  sendNow?: boolean;
};

export type OutboxSnapshot = { rows: OutboxRow[]; syncing: boolean; supported: boolean; lastSyncedAt: string | null };

const MAX_ATTEMPTS = 8;

let rows: OutboxRow[] = [];
let syncing = false;
let lastSyncedAt: string | null = null;
let loaded: Promise<void> | null = null;
let snapshot: OutboxSnapshot = { rows, syncing, supported: idbSupported(), lastSyncedAt };
const listeners = new Set<() => void>();
let queryClient: QueryClient | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  snapshot = { rows, syncing, supported: idbSupported(), lastSyncedAt };
  for (const l of listeners) l();
}

/** The App registers its QueryClient so a synced op refreshes what the page shows. */
export function setOutboxQueryClient(qc: QueryClient): void {
  queryClient = qc;
}

async function ensureLoaded(): Promise<void> {
  if (!idbSupported()) return;
  if (!loaded) {
    loaded = idbGetAll<OutboxRow>(OUTBOX_STORE)
      .then((all) => {
        rows = all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        emit();
      })
      .catch(() => {
        rows = [];
      });
  }
  await loaded;
}

export function newClientRef(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}

/** A fetch that never reached the server, or the service worker's offline stand-in. */
function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TypeError) return true;
  const e = err as { code?: string; status?: number; name?: string };
  return e.code === "OFFLINE" || e.status === 0 || e.name === "AbortError";
}

function isRetryable(err: unknown): boolean {
  const { status = 0, code } = err as { status?: number; code?: string };
  // 409 IDEMPOTENCY_IN_PROGRESS: the same op is still running on the server (an earlier attempt).
  return status >= 500 || status === 429 || status === 408 || code === "IDEMPOTENCY_IN_PROGRESS";
}

export async function enqueue(op: OutboxOp, opts: { id?: string; scope: string; label: string; conflict?: OutboxConflict }): Promise<OutboxRow> {
  await ensureLoaded();
  const row: OutboxRow = { id: opts.id ?? newClientRef(), scope: opts.scope, label: opts.label, createdAt: new Date().toISOString(), attempts: 0, status: opts.conflict ? "conflict" : "pending", error: null, op, conflict: opts.conflict };
  if (idbSupported()) await idbPut(OUTBOX_STORE, row);
  rows = [...rows.filter((r) => r.id !== row.id), row];
  emit();
  if (!opts.conflict && (typeof navigator === "undefined" || navigator.onLine)) scheduleFlush(250);
  return row;
}

/** Phase 117: the queue as it stands (the sync layer keeps new edits behind older ones of the same job). */
export async function queuedRows(): Promise<OutboxRow[]> {
  await ensureLoaded();
  return rows;
}

async function update(row: OutboxRow) {
  if (idbSupported()) await idbPut(OUTBOX_STORE, row);
  rows = rows.map((r) => (r.id === row.id ? row : r));
  emit();
}

async function remove(id: string) {
  if (idbSupported()) await idbDelete(OUTBOX_STORE, id);
  rows = rows.filter((r) => r.id !== id);
  emit();
}

/** Phase 116: on sign-out, nothing queued by this person is left for the next one on this device. */
export async function clearOutbox(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  rows = [];
  loaded = Promise.resolve();
  emit();
  if (idbSupported()) await idbClear(OUTBOX_STORE).catch(() => undefined);
}

/** Phase 122: a photo waiting for Wi-Fi goes now, over the phone's data. */
export async function sendNow(id: string): Promise<void> {
  await ensureLoaded();
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  await update({ ...row, sendNow: true });
  scheduleFlush(0);
}

export async function discard(id: string): Promise<void> {
  await ensureLoaded();
  await remove(id);
}

/**
 * Phase 117: the person chose, for each field both sides changed, whose value
 * stays. Theirs everywhere (and nothing else left to send) drops the op;
 * otherwise it is sent again on the version the server last reported.
 */
export async function resolveConflict(id: string, choice: Record<string, "mine" | "theirs">): Promise<void> {
  await ensureLoaded();
  const row = rows.find((r) => r.id === id);
  if (!row || row.status !== "conflict" || !row.conflict || row.op.kind !== "api") return;
  const { resolvePatch } = await syncCore();
  const patch = resolvePatch(row.conflict.patch, row.conflict.fields, choice);
  if (Object.keys(patch).length === 0) {
    await remove(id);
    invalidateFor(row.op);
    return;
  }
  const op = { ...row.op, body: JSON.stringify(patch), key: newClientRef(), base: { version: row.conflict.version, values: row.conflict.current } };
  await update({ ...row, op, status: "pending", attempts: 0, error: null, conflict: undefined });
  scheduleFlush(0);
}

export async function retryFailed(scope?: string): Promise<void> {
  await ensureLoaded();
  for (const r of rows) if (r.status === "failed" && (!scope || r.scope === scope)) await update({ ...r, status: "pending", attempts: 0, error: null });
  scheduleFlush(0);
}

/** Sends a queued edit. Resolves true when done, false when it became a conflict. */
async function executeApi(row: OutboxRow, op: Extract<OutboxOp, { kind: "api" }>): Promise<boolean> {
  const { sendEdit, matchRoute, recordServerData, rowIn } = await syncCore();
  const outcome = await sendEdit({ method: op.method, path: op.path, body: op.body, key: op.key, base: op.base }, (path, init) => rawFetch(path, init), newClientRef);
  const match = matchRoute(op.method, op.path.split("?")[0]!);
  if (outcome.kind === "noop") {
    if (match?.id) await rebaseBehind(row, match.id, outcome.current);
    return true;
  }
  if (outcome.kind === "conflict") {
    await update({ ...row, status: "conflict", error: null, conflict: { fields: outcome.fields, patch: outcome.patch, current: outcome.current, version: outcome.version } });
    return false;
  }
  const res = outcome.response;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(String(body.message || body.error || `Request failed (${res.status})`)) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = typeof body.code === "string" ? body.code : typeof body.error === "string" ? body.error : undefined;
    throw err;
  }
  recordServerData(body);
  const realId = match?.route.createdId?.(body) ?? null;
  if (realId) await swapTempId(tempIdFor(row.id), realId);
  const saved = match?.id ? rowIn(body, match.id) : null;
  if (saved && match?.id) await rebaseBehind(row, match.id, saved);
  return true;
}

/** Later queued edits of the same row are now made against this answer (lib/sync/protocol.ts rebase). */
async function rebaseBehind(done: OutboxRow, id: string, current: Record<string, unknown>) {
  const { matchRoute, rebase } = await syncCore();
  for (const r of rows) {
    if (r.id === done.id || r.status === "conflict" || r.op.kind !== "api" || !r.op.base) continue;
    if (matchRoute(r.op.method, r.op.path.split("?")[0]!)?.id !== id) continue;
    const base = rebase(r.op.body, current);
    if (base) await update({ ...r, op: { ...r.op, base } });
  }
}

/** A queued create went through: the ops queued behind it now name the real row. */
async function swapTempId(tempId: string, realId: string) {
  for (const r of rows) {
    if (r.op.kind !== "api") continue;
    const op = r.op;
    if (!op.path.includes(tempId) && !(op.body ?? "").includes(tempId)) continue;
    await update({ ...r, op: { ...op, path: op.path.split(tempId).join(realId), body: op.body == null ? null : op.body.split(tempId).join(realId) } });
  }
}

/** An op that names a row still waiting to be created (its create is queued ahead of it, or stuck). */
function waitsOnCreate(row: OutboxRow): boolean {
  if (row.op.kind !== "api") return false;
  const text = `${row.op.path} ${row.op.body ?? ""}`;
  const refs = text.match(TEMP_ID_RE) ?? [];
  return refs.some((ref) => rows.some((r) => r.id !== row.id && tempIdFor(r.id) === ref));
}

async function execute(row: OutboxRow): Promise<boolean> {
  const { op } = row;
  if (op.kind === "api") return executeApi(row, op);
  await executeLegacy(row, op);
  return true;
}

async function executeLegacy(row: OutboxRow, op: Exclude<OutboxOp, { kind: "api" }>): Promise<void> {
  switch (op.kind) {
    case "worker.clockIn":
      await workerApi.clockIn(op.token, { projectId: op.projectId, milestoneId: op.milestoneId, lat: op.lat, lng: op.lng, at: op.at, clientRef: row.id });
      return;
    case "worker.clockOut":
      await workerApi.clockOut(op.token, { entryId: op.entryId, entryClientRef: op.entryClientRef, lat: op.lat, lng: op.lng, at: op.at });
      return;
    case "worker.addEntry":
      await workerApi.add(op.token, { projectId: op.projectId, date: op.date, hours: op.hours, milestoneId: op.milestoneId, note: op.note, clientRef: row.id });
      return;
    case "worker.report":
      await workerApi.report(op.token, { projectId: op.projectId, kind: op.reportKind, body: op.body, milestoneId: op.milestoneId, materialsCents: op.materialsCents, file: op.file, fileName: op.fileName, clientRef: row.id });
      return;
    case "worker.task":
      await workerApi.setTask(op.token, op.taskId, op.status);
      return;
    case "worker.addTask":
      await workerApi.addTask(op.token, op.projectId, { title: op.title, clientRef: row.id });
      return;
    case "worker.allowance":
      await workerApi.addAllowance(op.token, { kind: op.allowanceKind, quantity: op.quantity, date: op.date, projectId: op.projectId, note: op.note, clientRef: row.id });
      return;
    case "job.addCost":
      await jobsApi.addCost(op.jobId, { ...op.body, clientRef: row.id });
      return;
    case "job.addTimeEntry":
      await jobsApi.addTimeEntry(op.jobId, { ...op.body, clientRef: row.id });
      return;
    case "job.uploadPhoto":
      await jobsApi.uploadPhoto(op.jobId, op.file, { fileName: op.fileName, milestoneId: op.milestoneId, caption: op.caption, clientRef: row.id });
      return;
    case "job.scanReceipt":
      await jobsApi.scanReceipt(new File([op.file], op.fileName, { type: op.file.type }), op.jobId ?? undefined, { idempotencyKey: row.id });
      return;
    case "job.voiceNote": {
      const text = await transcribeAudio(op.audio);
      if (text) await jobsApi.addNote(op.jobId, { body: text }, { idempotencyKey: row.id });
      return;
    }
    case "voice.dictation": {
      const { deliverDictation } = await import("./dictation");
      deliverDictation(op.target, await transcribeAudio(op.audio));
      return;
    }
  }
}

function invalidateFor(op: OutboxOp) {
  if (!queryClient) return;
  if (op.kind === "api") {
    const qc = queryClient;
    void syncCore().then(({ matchRoute, changeOf, affectsAny }) => {
      const match = matchRoute(op.method, op.path.split("?")[0]!);
      if (match) void qc.invalidateQueries({ predicate: affectsAny([changeOf(match)]) });
    });
    return;
  }
  if (op.kind === "voice.dictation") return;
  if (op.kind.startsWith("worker.")) {
    queryClient.invalidateQueries({ queryKey: ["worker", (op as { token: string }).token] });
    return;
  }
  const jobId = (op as { jobId: string }).jobId;
  queryClient.invalidateQueries({ queryKey: ["job", jobId] });
  queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] });
  queryClient.invalidateQueries({ queryKey: ["jobs"] });
  queryClient.invalidateQueries({ queryKey: ["costs-review"] });
  if (op.kind === "job.voiceNote") queryClient.invalidateQueries({ queryKey: ["job-notes", jobId] });
}

/** Replays pending ops in order. Idempotent: a second call while one runs is a no-op. */
export async function flush(): Promise<void> {
  if (syncing) return;
  await ensureLoaded();
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  // Phase 122: photos held for Wi-Fi stay put (nothing waits on them).
  const pending = rows.filter((r) => r.status === "pending" && !holdsForWifi(r));
  if (pending.length === 0) return;
  syncing = true;
  emit();
  try {
    for (const queued of pending) {
      // Earlier ops in this pass may have rewritten this one (a create's real id).
      const row = rows.find((r) => r.id === queued.id);
      if (!row || row.status !== "pending" || waitsOnCreate(row)) continue;
      try {
        if (await execute(row)) await remove(row.id);
        lastSyncedAt = new Date().toISOString();
        invalidateFor(row.op);
      } catch (err) {
        const message = (err as Error).message || "Request failed";
        if (isNetworkError(err)) {
          // Still offline (or flapping): stop here, keep the order, try again later.
          await update({ ...row, error: null });
          scheduleFlush(15_000);
          break;
        }
        if (isRetryable(err) && row.attempts + 1 < MAX_ATTEMPTS) {
          await update({ ...row, attempts: row.attempts + 1, error: message });
          scheduleFlush(Math.min(60_000, 2_000 * 2 ** row.attempts));
          break;
        }
        // The server refused it (validation, conflict, locked): needs a human.
        await update({ ...row, status: "failed", attempts: row.attempts + 1, error: message });
        invalidateFor(row.op);
      }
    }
  } finally {
    syncing = false;
    emit();
  }
}

function scheduleFlush(delayMs: number) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, delayMs);
}

let started = false;
/** Wires the reconnect/foreground triggers. Idempotent; called from main.tsx. */
export function startOutbox(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => scheduleFlush(500));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleFlush(0);
  });
  void ensureLoaded().then(() => scheduleFlush(1_000));
  // Belt and braces for a queue that is stuck behind a retryable error —
  // only while the app is in front (Phase 122: coming back flushes anyway).
  setInterval(() => {
    if (isForeground() && rows.some((r) => r.status === "pending" && !holdsForWifi(r)) && !syncing) scheduleFlush(0);
  }, 45_000);
  // Phase 122: photos held for Wi-Fi go the moment the phone joins one.
  onConnectionChange(() => scheduleFlush(250));
}

export function useOutbox(scope?: string): OutboxSnapshot {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void ensureLoaded();
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
  if (!scope) return snap;
  return { ...snap, rows: snap.rows.filter((r) => r.scope === scope) };
}

/**
 * Runs a write now, or queues it. Offline → queued immediately. Online but the
 * request never reached the server → queued with the same id, so the server
 * sees one op either way. Any other error is the caller's (validation etc.).
 */
export async function runOrQueue<T>(op: OutboxOp, opts: { scope: string; label: string }, live: (clientRef: string) => Promise<T>): Promise<{ queued: true; row: OutboxRow } | { queued: false; result: T }> {
  const id = newClientRef();
  if (typeof navigator !== "undefined" && !navigator.onLine) return { queued: true, row: await enqueue(op, { id, ...opts }) };
  // Phase 122: "Upload photos on Wi-Fi only" and the phone is on its data plan.
  if (holdsForWifi({ op })) return { queued: true, row: await enqueue(op, { id, ...opts }) };
  try {
    return { queued: false, result: await live(id) };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return { queued: true, row: await enqueue(op, { id, ...opts }) };
  }
}
