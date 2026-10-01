// With no signal the crew's phone keeps what the worker did and sends it later (the boards' "Saved on phone" and "Pending sync"). Each op carries the moment
// it really happened (`at`) and a `clientRef`, so a second delivery of the same op returns the row the first made. Ops go out oldest first.
import { useSyncExternalStore } from "react";
import { ApiFailure } from "./api";
import { crewApi } from "./crewApi";
import { kvGet, kvSet } from "./kv";
import type { UploadFile } from "./jobUpload";

const KEY = "quoteai_crew_outbox";

export type OpKind = "clockIn" | "clockOut" | "hours" | "allowance" | "report";
export type Op = { id: string; kind: OpKind; at: string; body: Record<string, unknown>; photo?: UploadFile | null; label: string };

export function uuid(): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

let ops: Op[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loaded = true;
  try { ops = JSON.parse((await kvGet(KEY)) ?? "[]") as Op[]; } catch { ops = []; }
  emit();
}
const save = () => kvSet(KEY, ops.length ? JSON.stringify(ops) : null);

export async function queued(): Promise<Op[]> { await load(); return ops; }

export async function enqueue(op: Omit<Op, "id" | "at"> & { id?: string; at?: string }): Promise<Op> {
  await load();
  const full: Op = { id: op.id ?? uuid(), at: op.at ?? new Date().toISOString(), ...op };
  ops = [...ops, full];
  await save();
  emit();
  return full;
}

/** How many things wait on this phone. */
export function useOutboxCount(): number {
  void load();
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => ops.length, () => 0);
}

export function useOutbox(): Op[] {
  void load();
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => ops, () => ops);
}

async function send(path: string, op: Op): Promise<void> {
  const b = op.body as never;
  switch (op.kind) {
    case "clockIn": await crewApi.clockIn(path, { ...(b as object), at: op.at, clientRef: op.id } as never); return;
    case "clockOut": await crewApi.clockOut(path, { ...(b as object), at: op.at, entryClientRef: (op.body as { openRef?: string }).openRef } as never); return;
    case "hours": await crewApi.hours(path, { ...(b as object), clientRef: op.id } as never); return;
    case "allowance": await crewApi.allowance(path, { ...(b as object), clientRef: op.id } as never); return;
    case "report": await crewApi.report(path, { ...(b as object), clientRef: op.id } as never, op.photo ?? null); return;
  }
}

/** Sends what waits, oldest first. Stops at the first op that finds no signal; drops one the server refuses for good (a link that no longer works, bad data). */
export async function flushOutbox(path: string): Promise<{ sent: number; left: number }> {
  await load();
  let sent = 0;
  while (ops.length) {
    const op = ops[0]!;
    try {
      await send(path, op);
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 0) break;
      if (e instanceof ApiFailure && (e.status === 429 || e.status >= 500)) break;
    }
    ops = ops.slice(1);
    sent++;
    await save();
    emit();
  }
  return { sent, left: ops.length };
}

/** Runs an action now; with no signal keeps it for later. "queued" means it is saved on the phone. */
export async function runOrQueue<T>(run: () => Promise<T>, op: Omit<Op, "id" | "at"> & { id?: string; at?: string }): Promise<{ done: true; value: T } | { done: false }> {
  try {
    return { done: true, value: await run() };
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 0) { await enqueue(op); return { done: false }; }
    throw e;
  }
}
