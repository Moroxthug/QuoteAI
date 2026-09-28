import { Router, type IRouter } from "express";
import { db, changeLogTable } from "@workspace/db";
import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";

// Phase 117 (docs/APP-PLAN.md "Sync II"): live updates.
//
// GET /api/changes?after=<cursor>&wait=<seconds> — a long poll on the
// company's change feed (change_log, written by the qai_log_change trigger).
// With no cursor it answers at once with the current one. With a cursor it
// answers as soon as something newer exists, or with an empty list after
// `wait` seconds (default 25, at most 50 — the function's limit is 60), so
// an open app hears "job X changed" within about a second and refetches just
// that. Ids only, never content: what the person may see is still decided by
// the routes they refetch. A cursor older than the feed keeps (2 days) gets
// `reset: true` — refetch everything on screen.

const router: IRouter = Router();

const POLL_MS = 1_000;
const DEFAULT_WAIT_S = 25;
const MAX_WAIT_S = 50;
const PAGE = 200;
const RETENTION_DAYS = 2;

type ChangeDto = { entity: string; id: string | null; parentId: string | null; op: string };

/**
 * Where a new listener starts: the newest id in the whole feed (not just this
 * company's), so an idle company's cursor never falls behind the 2-day prune.
 */
async function latestId(): Promise<number> {
  const [row] = await db.select({ id: sql<string | null>`max(${changeLogTable.id})` }).from(changeLogTable);
  return Number(row?.id ?? 0);
}

async function oldestId(): Promise<number> {
  const [row] = await db.select({ id: sql<string | null>`min(${changeLogTable.id})` }).from(changeLogTable);
  return Number(row?.id ?? 0);
}

/** The newest op per row wins; a list of 200 inserts into one job still says "job X changed" once per row. */
function coalesce(rows: Array<{ entity: string; entityId: string | null; parentId: string | null; op: string }>): ChangeDto[] {
  const byKey = new Map<string, ChangeDto>();
  for (const r of rows) {
    const key = `${r.entity}:${r.entityId ?? ""}`;
    byKey.delete(key);
    byKey.set(key, { entity: r.entity, id: r.entityId, parentId: r.parentId, op: r.op });
  }
  return [...byKey.values()];
}

router.get("/changes", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const orgId = getUserId(res);
  try {
    const afterRaw = typeof req.query.after === "string" ? req.query.after : "";
    if (!/^\d{1,18}$/.test(afterRaw)) {
      res.json({ cursor: String(await latestId()), changes: [] });
      return;
    }
    const after = Number(afterRaw);
    const oldest = await oldestId();
    if (after > 0 && oldest > after + 1) {
      res.json({ cursor: String(await latestId()), changes: [], reset: true });
      return;
    }
    const waitRaw = Number(req.query.wait);
    const waitS = Number.isFinite(waitRaw) ? Math.max(0, Math.min(MAX_WAIT_S, waitRaw)) : DEFAULT_WAIT_S;
    const deadline = Date.now() + waitS * 1000;
    let closed = false;
    req.on("close", () => {
      closed = true;
    });
    for (;;) {
      const rows = await db
        .select({ id: changeLogTable.id, entity: changeLogTable.entity, entityId: changeLogTable.entityId, parentId: changeLogTable.parentId, op: changeLogTable.op })
        .from(changeLogTable)
        .where(and(eq(changeLogTable.orgId, orgId), gt(changeLogTable.id, after)))
        .orderBy(asc(changeLogTable.id))
        .limit(PAGE);
      if (rows.length > 0) {
        res.json({ cursor: String(rows[rows.length - 1]!.id), changes: coalesce(rows), more: rows.length === PAGE });
        return;
      }
      if (closed) return;
      if (Date.now() + POLL_MS > deadline) {
        res.json({ cursor: String(after), changes: [] });
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (closed) return;
    }
  } catch (err) {
    req.log.error({ err }, "Error reading the change feed");
    // No feed (or no table yet): the app falls back to refreshing on focus.
    if (!res.headersSent) res.status(503).json({ error: "Change feed unavailable" });
  }
});

/** Called by the daily cron. */
export async function pruneChangeLog(olderThanDays = RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60_000);
  const rows = await db.delete(changeLogTable).where(lt(changeLogTable.at, cutoff)).returning({ id: changeLogTable.id });
  return rows.length;
}

export default router;
