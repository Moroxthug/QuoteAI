import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { db, authUsersTable, userProfilesTable } from "@workspace/db";
import { roleCan } from "@workspace/permissions";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId, getActorRole } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { loadPerson, personActivity, personCompanies, personStats, roleInCompany, teamLeaderboard } from "../people/service.js";

// ── Phase 91: every person's own page ────────────────────────────────────────
// /api/me is the signed-in person: their details and photo (shared across the
// companies they work in), and their history and numbers in the company they
// are acting as. /api/team/people/:userId is the same view of a teammate, for
// anyone who can see the team — never for someone outside the company.

const router = Router();
const storage = new ObjectStorageService();
const AVATAR_MIMES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1 } }).single("avatar");

const monthsOf = (q: unknown) => {
  const n = Number.parseInt(String(q ?? "6"), 10);
  return Number.isFinite(n) ? n : 6;
};

// GET /api/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const orgId = getUserId(res);
    const person = await loadPerson(actorId);
    if (!person) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ person, companies: await personCompanies(actorId), current: { orgId, role: getActorRole(res) } });
  } catch (err) {
    req.log.error({ err }, "Error loading own profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

const MeBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  jobTitle: z.string().trim().max(80).nullable().optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  /** First-login setup: marks the profile as done. */
  complete: z.boolean().optional(),
});

// PUT /api/me
router.put("/me", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const body = MeBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const d = body.data;
    if (d.name !== undefined) await db.update(authUsersTable).set({ name: d.name }).where(eq(authUsersTable.id, actorId));
    const patch: Partial<typeof userProfilesTable.$inferInsert> = {};
    if (d.phone !== undefined) patch.phone = d.phone || null;
    if (d.jobTitle !== undefined) patch.jobTitle = d.jobTitle || null;
    if (d.bio !== undefined) patch.bio = d.bio || null;
    if (d.complete) patch.completedAt = new Date();
    if (Object.keys(patch).length) {
      await db.insert(userProfilesTable).values({ userId: actorId, ...patch }).onConflictDoUpdate({ target: userProfilesTable.userId, set: patch });
    }
    res.json({ person: await loadPerson(actorId) });
  } catch (err) {
    req.log.error({ err }, "Error updating own profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/me/avatar — multipart field "avatar": PNG, JPEG or WebP, 3 MB.
router.post("/me/avatar", requireAuth, (req, res, next) => avatarUpload(req, res, (err: unknown) => {
  if (err) {
    res.status(400).json({ error: "FILE_TOO_LARGE", message: "The photo must be 3 MB or less." });
    return;
  }
  next();
}), async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const file = req.file;
    const ext = file ? AVATAR_MIMES[file.mimetype] : undefined;
    if (!file || !ext) {
      res.status(400).json({ error: "INVALID_FILE", message: "Send a PNG, JPEG or WebP photo in the 'avatar' field." });
      return;
    }
    // A new name each time so browsers and the CDN never show the old photo.
    const subPath = `avatars/${actorId}/${randomBytes(8).toString("hex")}.${ext}`;
    const publicSubPath = await storage.uploadPublicObjectBuffer({ subPath, buffer: file.buffer, contentType: file.mimetype });
    const image = `/api/storage/public-objects/${publicSubPath}`;
    await db.update(authUsersTable).set({ image }).where(eq(authUsersTable.id, actorId));
    res.json({ image });
  } catch (err) {
    req.log.error({ err }, "Error uploading avatar");
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

// DELETE /api/me/avatar
router.delete("/me/avatar", requireAuth, async (req, res) => {
  try {
    await db.update(authUsersTable).set({ image: null }).where(eq(authUsersTable.id, getActorUserId(res)));
    res.json({ image: null });
  } catch (err) {
    req.log.error({ err }, "Error removing avatar");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/me/stats?months=6 · /api/me/activity — in the company being acted as.
router.get("/me/stats", requireAuth, async (req, res) => {
  try {
    res.json(await personStats(getUserId(res), getActorUserId(res), { months: monthsOf(req.query.months) }));
  } catch (err) {
    req.log.error({ err }, "Error computing own stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me/activity", requireAuth, async (req, res) => {
  try {
    res.json({ items: await personActivity(getUserId(res), getActorUserId(res)) });
  } catch (err) {
    req.log.error({ err }, "Error loading own activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/team/people/:userId?months=6 — a teammate's page, inside the acting company only.
router.get("/team/people/:userId", requireAuth, requirePermission("team", "view"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const target = req.params.userId as string;
    const role = await roleInCompany(target, orgId);
    if (!role) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const person = await loadPerson(target);
    if (!person) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Money figures follow the viewer's own reach: someone who cannot see invoices sees counts, not amounts.
    const stats = await personStats(orgId, target, { months: monthsOf(req.query.months) });
    const seesMoney = roleCan(getActorRole(res), "invoicing", "view") && roleCan(getActorRole(res), "analytics", "view");
    res.json({
      person,
      role,
      stats: seesMoney ? stats : { ...stats, quotes: { ...stats.quotes, valueCents: 0, wonValueCents: 0 }, invoices: { ...stats.invoices, invoicedCents: 0, paidCents: 0 }, series: stats.series.map((m) => ({ ...m, quoteValueCents: 0, invoicedCents: 0 })) },
      seesMoney,
      activity: await personActivity(orgId, target, 40),
    });
  } catch (err) {
    req.log.error({ err }, "Error loading teammate profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/team/leaderboard?days=90 — Phase 95: sent, won, win rate and
// invoiced per person, for the people who run the team (owner, admin).
router.get("/team/leaderboard", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const n = Number.parseInt(String(req.query.days ?? "90"), 10);
    res.json(await teamLeaderboard(getUserId(res), { days: Number.isFinite(n) ? n : 90 }));
  } catch (err) {
    req.log.error({ err }, "Error computing team leaderboard");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
