import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { idbSupported, idbGetAll, idbPut, idbDelete, OUTBOX_STORE } from "./db";
import { jobsApi, type CostCategory, type CostEntryEdit } from "../jobs-api";
import { workerApi, type CrewTaskStatus, type FieldReportKind } from "../team-api";

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
  | { kind: "worker.allowance"; token: string; allowanceKind: "mileage" | "per_diem"; quantity: number; date: string; projectId: string | null; note?: string };

type OutboxStatus = "pending" | "failed";

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

function newClientRef(): string {
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
  const status = (err as { status?: number }).status ?? 0;
  return status >= 500 || status === 429 || status === 408;
}

export async function enqueue(op: OutboxOp, opts: { id?: string; scope: string; label: string }): Promise<OutboxRow> {
  await ensureLoaded();
  const row: OutboxRow = { id: opts.id ?? newClientRef(), scope: opts.scope, label: opts.label, createdAt: new Date().toISOString(), attempts: 0, status: "pending", error: null, op };
  if (idbSupported()) await idbPut(OUTBOX_STORE, row);
  rows = [...rows.filter((r) => r.id !== row.id), row];
  emit();
  if (typeof navigator === "undefined" || navigator.onLine) scheduleFlush(250);
  return row;
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

export async function discard(id: string): Promise<void> {
  await ensureLoaded();
  await remove(id);
}

export async function retryFailed(scope?: string): Promise<void> {
  await ensureLoaded();
  for (const r of rows) if (r.status === "failed" && (!scope || r.scope === scope)) await update({ ...r, status: "pending", attempts: 0, error: null });
  scheduleFlush(0);
}

async function execute(row: OutboxRow): Promise<void> {
  const { op } = row;
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
  }
}

function invalidateFor(op: OutboxOp) {
  if (!queryClient) return;
  if (op.kind.startsWith("worker.")) {
    queryClient.invalidateQueries({ queryKey: ["worker", (op as { token: string }).token] });
    return;
  }
  const jobId = (op as { jobId: string }).jobId;
  queryClient.invalidateQueries({ queryKey: ["job", jobId] });
  queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] });
  queryClient.invalidateQueries({ queryKey: ["jobs"] });
  queryClient.invalidateQueries({ queryKey: ["costs-review"] });
}

/** Replays pending ops in order. Idempotent: a second call while one runs is a no-op. */
export async function flush(): Promise<void> {
  if (syncing) return;
  await ensureLoaded();
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const pending = rows.filter((r) => r.status === "pending");
  if (pending.length === 0) return;
  syncing = true;
  emit();
  try {
    for (const row of pending) {
      try {
        await execute(row);
        await remove(row.id);
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
  // Belt and braces for a queue that is stuck behind a retryable error.
  setInterval(() => {
    if (rows.some((r) => r.status === "pending") && !syncing) scheduleFlush(0);
  }, 45_000);
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
  try {
    return { queued: false, result: await live(id) };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return { queued: true, row: await enqueue(op, { id, ...opts }) };
  }
}
