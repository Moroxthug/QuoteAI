import { mergeEdit, type FieldConflict } from "./merge";

// Phase 117 (docs/APP-PLAN.md "Sync II"): sending one edit, the same way from
// the screen (lib/sync/sync-fetch.ts) and from the outbox replay.
//
// Every attempt carries the Idempotency-Key, so a request that reached the
// server before the connection dropped is answered, not redone. A versioned
// edit also carries X-Base-Version; on 409 STALE the patch is merged with the
// row as it is now (lib/sync/merge.ts): with no collision it is sent again on
// the new version (a new key: it is a different request now), with a
// collision the caller gets the fields to ask about. When everything in the
// patch is already so, nothing is sent.

export type EditBase = { version: string; values: Record<string, unknown> };
export type EditRequest = { method: string; path: string; body: string | null; key: string; base: EditBase | null };
export type Transport = (path: string, init: RequestInit) => Promise<Response>;

export type EditOutcome =
  | { kind: "sent"; response: Response; key: string }
  | { kind: "noop"; current: Record<string, unknown>; version: string }
  | { kind: "conflict"; fields: FieldConflict[]; patch: Record<string, unknown>; current: Record<string, unknown>; version: string };

const MAX_MERGES = 3;

/** The row with this id in a route's answer (`{ task: {…} }`, a bare quote, …), when the answer carries its version. */
export function rowIn(answer: unknown, id: string, depth = 0): Record<string, unknown> | null {
  if (!answer || typeof answer !== "object" || depth > 3) return null;
  if (Array.isArray(answer)) return null;
  const obj = answer as Record<string, unknown>;
  if (obj.id === id && typeof obj.updatedAt === "string") return obj;
  for (const v of Object.values(obj)) {
    const hit = rowIn(v, id, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/**
 * The base for an edit queued behind one that just went through on the same
 * row: the answer's version and values. Without this the second of two
 * queued edits (a tick, then its Undo) would collide with the first — with
 * this device's own change.
 */
export function rebase(body: string | null, row: Record<string, unknown>): EditBase | null {
  if (typeof row.updatedAt !== "string") return null;
  const fields = Object.keys(parseObject(body) ?? {});
  return { version: row.updatedAt, values: Object.fromEntries(fields.filter((f) => f in row).map((f) => [f, row[f]])) };
}

function parseObject(body: string | null): Record<string, unknown> | null {
  if (body == null) return null;
  try {
    const v = JSON.parse(body) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function sendEdit(req: EditRequest, transport: Transport, newKey: () => string): Promise<EditOutcome> {
  let { body, base, key } = req;
  for (let merges = 0; ; merges++) {
    const headers = new Headers();
    headers.set("Idempotency-Key", key);
    if (body != null) headers.set("Content-Type", "application/json");
    if (base) headers.set("X-Base-Version", base.version);
    const response = await transport(req.path, { method: req.method, headers, body: body ?? undefined, credentials: "include" });
    const patch = parseObject(body);
    if (response.status !== 409 || !base || !patch || merges >= MAX_MERGES) return { kind: "sent", response, key };
    const info = (await response.clone().json().catch(() => null)) as { code?: string; current?: Record<string, unknown>; updatedAt?: string } | null;
    if (info?.code !== "STALE" || !info.current || !info.updatedAt) return { kind: "sent", response, key };
    const merged = mergeEdit(base.values, patch, info.current);
    if (merged.conflicts.length > 0) return { kind: "conflict", fields: merged.conflicts, patch: merged.patch, current: info.current, version: info.updatedAt };
    if (Object.keys(merged.patch).length === 0) return { kind: "noop", current: info.current, version: info.updatedAt };
    body = JSON.stringify(merged.patch);
    base = { version: info.updatedAt, values: info.current };
    key = newKey();
  }
}
