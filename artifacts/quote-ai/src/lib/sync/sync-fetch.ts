import { rawFetch } from "./raw-fetch";
import { matchRoute, changeOf, type RouteMatch } from "./routes";
import { tempIdFor, TEMP_ID_RE } from "./temp-id";
import { sendEdit, type EditBase } from "./protocol";
import { baseFor, lastSeen, recordServerData } from "./versions";
import { noteOwnWrite } from "./live";
import { enqueue, queuedRows, newClientRef, type OutboxConflict, type OutboxOp } from "../offline/outbox";
import { getActiveLang, lookup } from "@/i18n/registry";

// Phase 117 (docs/APP-PLAN.md "Sync II"): the one place every write from the
// app goes through.
//
// The app's API modules all call `fetch`; lib/sync/install.ts wraps it once
// (App.tsx) and hands this module every same-origin POST/PUT/PATCH/DELETE under /api:
//   1. every one gets an Idempotency-Key (api-server/src/lib/idempotency.ts);
//   2. the edits named in lib/sync/routes.ts also get, when versioned, the
//      version they were made against (lib/sync/versions.ts) and are merged
//      field by field if the row changed elsewhere (lib/sync/protocol.ts);
//   3. with no signal — or when the request dies on the way, or when older
//      edits of the same job are still queued — such an edit goes into the
//      outbox and the caller gets the route's answer as it will be
//      (`echo`, status 202, `X-Queued: 1`), so optimistic screens simply stay;
//   4. when both sides changed the same field, the edit waits in the outbox
//      as a conflict (the sync bar asks keep mine / keep theirs) and the
//      caller gets the row as the server has it, with the rest of the edit.
// Requests with a non-JSON body (uploads) and everything else pass through
// with just the key. GETs are untouched.

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function json(status: number, body: unknown, queued: boolean): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (queued) headers["X-Queued"] = "1";
  return new Response(JSON.stringify(body), { status, headers });
}

function parseObject(body: string | null): Record<string, unknown> {
  if (!body) return {};
  try {
    const v = JSON.parse(body) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function labelFor(match: RouteMatch, body: Record<string, unknown>, known: Record<string, unknown>): string {
  const lang = getActiveLang();
  const what = lookup(lang, match.route.label);
  // The edit's own words first ("Task added · Tape the seams"), else the row's name as the phone knows it.
  const title = [body.title, body.name, body.body, known.title, known.name, known.number].find((v): v is string => typeof v === "string" && v.trim() !== "");
  return title ? `${what} · ${title.trim().slice(0, 60)}` : what;
}

async function mustQueue(match: RouteMatch, path: string, body: string | null, scope: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const queued = await queuedRows();
  if (queued.length === 0) return false;
  // Keep order: an edit of a job waits behind that job's older queued edits…
  if (queued.some((r) => r.status === "pending" && r.scope === scope)) return true;
  // …and an edit of a row that is itself still queued for creation waits for it.
  const refs = `${path} ${body ?? ""}`.match(TEMP_ID_RE) ?? [];
  return refs.some((ref) => queued.some((r) => tempIdFor(r.id) === ref));
}

/**
 * Edits of one row go one after another: the second waits for the first's
 * answer, so it is made against the version the first produced (a tick and
 * its Undo must not collide with each other).
 */
const inFlight = new Map<string, Promise<unknown>>();

function oneAtATime<T>(id: string | null, run: () => Promise<T>): Promise<T> {
  if (!id) return run();
  const before = inFlight.get(id) ?? Promise.resolve();
  const mine = before.catch(() => undefined).then(run);
  const tail = mine.catch(() => undefined);
  inFlight.set(id, tail);
  void tail.then(() => {
    if (inFlight.get(id) === tail) inFlight.delete(id);
  });
  return mine;
}

async function throughSync(match: RouteMatch, method: string, path: string, body: string | null, key: string, extraHeaders: Headers): Promise<Response> {
  return oneAtATime(match.id, () => sendOne(match, method, path, body, key, extraHeaders));
}

async function sendOne(match: RouteMatch, method: string, path: string, body: string | null, key: string, extraHeaders: Headers): Promise<Response> {
  const payload = parseObject(body);
  const scope = match.jobId ?? match.id ?? match.route.entity;
  const isTemp = !!match.id && match.id.startsWith("q_");
  const base: EditBase | null = match.route.versioned && match.id && !isTemp ? baseFor(match.id, Object.keys(payload)) : null;
  const known = (match.id && lastSeen(match.id)) || { id: match.id };
  const echo = (row: Record<string, unknown>, edit: Record<string, unknown>, rowId: string) => match.route.echo({ body: edit, row, tempId: tempIdFor(rowId), params: match.params });
  const op: OutboxOp = { kind: "api", method, path, body, key, base };
  const label = labelFor(match, payload, known);

  const queue = async (conflict?: OutboxConflict) => {
    await enqueue(op, { id: key, scope, label, conflict });
    return conflict ? json(202, echo(conflict.current, conflict.patch, key), true) : json(202, echo(known, payload, key), true);
  };

  if (await mustQueue(match, path, body, scope)) return queue();

  const transport = (p: string, init: RequestInit) => {
    const headers = new Headers(extraHeaders);
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    return rawFetch(p, { ...init, headers });
  };
  try {
    const outcome = await sendEdit({ method, path, body, key, base }, transport, newClientRef);
    if (outcome.kind === "sent") {
      if (outcome.response.ok) {
        noteOwnWrite(changeOf(match));
        // The answer is the row's new version: the next edit of it is made against that.
        await outcome.response.clone().json().then(recordServerData, () => undefined);
      }
      return outcome.response;
    }
    if (outcome.kind === "noop") return json(200, echo(outcome.current, {}, key), false);
    return queue({ fields: outcome.fields, patch: outcome.patch, current: outcome.current, version: outcome.version });
  } catch (err) {
    // The request never got an answer (no signal, dropped mid-way): queue it
    // with the same key — if it did reach the server, the replay is answered, not redone.
    if (err instanceof TypeError) return queue();
    throw err;
  }
}

/** The write path for every request lib/sync/install.ts hands over (POST/PUT/PATCH/DELETE). */
export function syncFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window === "undefined" || input instanceof Request) return rawFetch(input, init);
  const method = (init?.method ?? "GET").toUpperCase();
  if (!MUTATING.has(method)) return rawFetch(input, init);
  const url = new URL(String(input), window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/auth/")) return rawFetch(input, init);

  const headers = new Headers(init?.headers);
  const key = headers.get("idempotency-key") ?? newClientRef();
  headers.set("Idempotency-Key", key);
  const match = matchRoute(method, url.pathname);
  const body = init?.body;
  if (!match || (body != null && typeof body !== "string")) return rawFetch(input, { ...init, headers });
  headers.delete("idempotency-key");
  headers.delete("content-type");
  return throughSync(match, method, url.pathname + url.search, body ?? null, key, headers);
}

