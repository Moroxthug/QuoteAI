import { Router } from "express";
import { z } from "zod";
import { db, notificationsTable } from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";

const router = Router();

// GET /api/notifications?limit=20 — newest first, plus the unread count.
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
    const [items, [{ unread }]] = await Promise.all([
      db.select().from(notificationsTable).where(eq(notificationsTable.userId, userId)).orderBy(desc(notificationsTable.createdAt)).limit(limit),
      db
        .select({ unread: sql<number>`count(*)::int` })
        .from(notificationsTable)
        .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt))),
    ]);
    res.json({ items, unread });
  } catch (err) {
    req.log.error({ err }, "Error listing notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/notifications/read — body { ids?: string[] } (all unread when omitted)
router.post("/notifications/read", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z.object({ ids: z.array(z.string().uuid()).max(500).optional() }).safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const ids = body.data.ids ?? null;
    const where = ids && ids.length > 0
      ? and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt), sql`${notificationsTable.id} = any(${ids}::uuid[])`)
      : and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt));
    await db.update(notificationsTable).set({ readAt: new Date() }).where(where);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error marking notifications read");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
