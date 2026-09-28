import { createHash } from "node:crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, idempotencyKeysTable } from "@workspace/db";
import { and, eq, lt } from "drizzle-orm";
import { logger } from "./logger";

// Phase 117 (docs/APP-PLAN.md "Sync II"): idempotency keys on every mutating
// route.
//
// A POST/PUT/PATCH/DELETE under /api that carries `Idempotency-Key` is done
// at most once. The first request claims the key; when it answers with JSON
// and a status below 500 the answer is stored (before it is sent), and a replay (the phone's
// outbox resending after the connection dropped mid-request) gets the same
// answer back with `Idempotent-Replayed: true` instead of a second quote, a
// second note, a second payment. A 5xx, a non-JSON answer or a request that
// died releases the key, so the retry runs for real. The same key with a
// different body is refused (422). A key still running answers 409
// `IDEMPOTENCY_IN_PROGRESS` with Retry-After; a claim left behind by a
// function that was killed is taken over after STALE_CLAIM_MS.
//
// Keys are random UUIDs made on the device, so the key alone is the scope
// (plus method and path): nobody else can know it. Requests without the
// header behave exactly as before. If the table can't be reached the request
// runs as if there were no key — the feature fails open, never closed.

const KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;
const STALE_CLAIM_MS = 2 * 60_000;
/** Answers bigger than this are not kept (the key is released; a retry runs again). */
const MAX_STORED_CHARS = 256 * 1024;

export type IdempotencyRecord = { fingerprint: string | null; responseStatus: number | null; responseBody: unknown; createdAt: Date };
export type IdempotencyId = { key: string; method: string; path: string };

export type IdempotencyStore = {
  /** True when this request now owns the key. */
  claim(id: IdempotencyId, fingerprint: string | null): Promise<boolean>;
  get(id: IdempotencyId): Promise<IdempotencyRecord | null>;
  complete(id: IdempotencyId, status: number, body: unknown): Promise<void>;
  release(id: IdempotencyId): Promise<void>;
};

const match = (id: IdempotencyId) => and(eq(idempotencyKeysTable.key, id.key), eq(idempotencyKeysTable.method, id.method), eq(idempotencyKeysTable.path, id.path));

const dbIdempotencyStore: IdempotencyStore = {
  async claim(id, fingerprint) {
    const rows = await db.insert(idempotencyKeysTable).values({ ...id, fingerprint }).onConflictDoNothing().returning({ key: idempotencyKeysTable.key });
    return rows.length > 0;
  },
  async get(id) {
    const [row] = await db
      .select({ fingerprint: idempotencyKeysTable.fingerprint, responseStatus: idempotencyKeysTable.responseStatus, responseBody: idempotencyKeysTable.responseBody, createdAt: idempotencyKeysTable.createdAt })
      .from(idempotencyKeysTable)
      .where(match(id));
    return row ?? null;
  },
  async complete(id, status, body) {
    await db.update(idempotencyKeysTable).set({ responseStatus: status, responseBody: body as object }).where(match(id));
  },
  async release(id) {
    await db.delete(idempotencyKeysTable).where(match(id));
  },
};

/** Called by the daily cron: keys are only useful while an outbox might still resend. */
export async function pruneIdempotencyKeys(olderThanDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60_000);
  const rows = await db.delete(idempotencyKeysTable).where(lt(idempotencyKeysTable.createdAt, cutoff)).returning({ key: idempotencyKeysTable.key });
  return rows.length;
}

function fingerprintOf(req: Request): string | null {
  const type = req.headers["content-type"] ?? "";
  if (!type.includes("application/json")) return null; // multipart is parsed later, by the route
  return createHash("sha256").update(JSON.stringify(req.body ?? null)).digest("hex");
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function idempotency(store: IdempotencyStore = dbIdempotencyStore, now: () => number = Date.now): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers["idempotency-key"];
    const key = Array.isArray(header) ? header[0] : header;
    if (!key || !MUTATING.has(req.method)) {
      next();
      return;
    }
    if (!KEY_RE.test(key)) {
      res.status(400).json({ error: "Invalid Idempotency-Key" });
      return;
    }
    const id: IdempotencyId = { key, method: req.method, path: (req.originalUrl || req.url).split("?")[0]! };
    const fingerprint = fingerprintOf(req);

    let claimed: boolean;
    try {
      claimed = await store.claim(id, fingerprint);
      if (!claimed) {
        const existing = await store.get(id);
        if (!existing) {
          claimed = await store.claim(id, fingerprint); // released between our two reads
        } else if (existing.responseStatus === null && now() - existing.createdAt.getTime() > STALE_CLAIM_MS) {
          await store.release(id); // the request that claimed it never finished
          claimed = await store.claim(id, fingerprint);
        } else {
          if (existing.fingerprint && fingerprint && existing.fingerprint !== fingerprint) {
            res.status(422).json({ error: "This Idempotency-Key was used for a different request", code: "IDEMPOTENCY_MISMATCH" });
            return;
          }
          if (existing.responseStatus === null) {
            res.setHeader("Retry-After", "2");
            res.status(409).json({ error: "The same change is still being saved", code: "IDEMPOTENCY_IN_PROGRESS" });
            return;
          }
          res.setHeader("Idempotent-Replayed", "true");
          res.status(existing.responseStatus).json(existing.responseBody);
          return;
        }
      }
    } catch (err) {
      logger.warn({ err }, "idempotency store unavailable; running the request without it");
      next();
      return;
    }
    if (!claimed) {
      res.setHeader("Retry-After", "2");
      res.status(409).json({ error: "The same change is still being saved", code: "IDEMPOTENCY_IN_PROGRESS" });
      return;
    }

    // The answer is stored *before* it is sent: on Vercel the function can be
    // frozen the moment the response is out, and a record left "running"
    // would turn the outbox's retry into a second write once the claim
    // goes stale.
    let stored = false;
    const json = res.json.bind(res);
    res.json = ((body: unknown) => {
      const status = res.statusCode;
      let keep = status < 500;
      if (keep) {
        try {
          keep = JSON.stringify(body ?? null).length <= MAX_STORED_CHARS;
        } catch {
          keep = false;
        }
      }
      if (!keep) return json(body);
      stored = true;
      store
        .complete(id, status, body ?? null)
        .catch((err) => {
          stored = false;
          logger.warn({ err }, "idempotency store write failed");
        })
        .finally(() => json(body));
      return res;
    }) as Response["json"];
    // Anything that ended without a stored answer (a 5xx, a file, a crash) frees the key for the retry.
    res.on("close", () => {
      if (!stored) store.release(id).catch((err) => logger.warn({ err }, "idempotency release failed"));
    });
    next();
  };
}
