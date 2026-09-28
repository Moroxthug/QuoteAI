import type { QueryClient } from "@tanstack/react-query";
import type { EditBase } from "./protocol";

// Phase 117 (docs/APP-PLAN.md "Sync II"): the rows as the server last sent
// them, by id.
//
// An edit's base (the version it was made against, and the values of the
// fields it changes) has to be the server's, not the screen's: by the time a
// request is sent the optimistic patch (lib/optimistic.ts) has already put the
// new values in the cache. So every answer that arrives from the server — a
// fetch, or the saved cache put back at launch — is walked once, and each
// object with a string `id` and `updatedAt` is remembered here. Edits made by
// hand (`setQueryData`, optimistic patches, queued echoes) are not answers
// and are skipped. Ids are UUIDs, unique across tables, so one map serves all.

type Seen = { version: string; values: Record<string, unknown> };

const MAX_ROWS = 5_000;
const MAX_DEPTH = 5;
const rows = new Map<string, Seen>();

function remember(obj: Record<string, unknown>) {
  const id = obj.id;
  const version = obj.updatedAt;
  if (typeof id !== "string" || typeof version !== "string") return;
  const had = rows.get(id);
  if (had && Date.parse(had.version) > Date.parse(version)) return; // an older copy (a list fetched before the detail)
  // The same version seen in two shapes (list row and detail): keep every field either showed.
  const values = had && had.version === version ? { ...had.values, ...obj } : obj;
  rows.delete(id);
  rows.set(id, { version, values });
  if (rows.size > MAX_ROWS) rows.delete(rows.keys().next().value!);
}

export function recordServerData(data: unknown, depth = 0): void {
  if (!data || typeof data !== "object" || depth > MAX_DEPTH) return;
  if (Array.isArray(data)) {
    for (const item of data) recordServerData(item, depth + 1);
    return;
  }
  const obj = data as Record<string, unknown>;
  remember(obj);
  for (const v of Object.values(obj)) if (v && typeof v === "object") recordServerData(v, depth + 1);
}

/** The base for an edit of row `id` touching `fields` — null when the phone never had the row from the server. */
export function baseFor(id: string, fields: string[]): EditBase | null {
  const seen = rows.get(id);
  if (!seen) return null;
  const values: Record<string, unknown> = {};
  for (const f of fields) if (f in seen.values) values[f] = seen.values[f];
  return { version: seen.version, values };
}

/** The whole row as last seen (for the answer a queued edit gets). */
export function lastSeen(id: string): Record<string, unknown> | null {
  return rows.get(id)?.values ?? null;
}

let watching = false;
/** Walks every server answer the QueryClient receives. Idempotent. */
export function watchServerData(qc: QueryClient): void {
  if (watching) return;
  watching = true;
  for (const q of qc.getQueryCache().getAll()) if (q.state.data !== undefined) recordServerData(q.state.data);
  qc.getQueryCache().subscribe((event) => {
    if (event.type === "added") {
      if (event.query.state.data !== undefined) recordServerData(event.query.state.data);
      return;
    }
    if (event.type !== "updated") return;
    const action = event.action as { type: string; manual?: boolean; data?: unknown };
    if (action.type === "success" && !action.manual) recordServerData(event.query.state.data);
  });
}
