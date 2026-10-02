import { Router, type Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { businessProfilesTable, db, minimumPlanFor } from "@workspace/db";
import { requireAuth, getUserId, getActorRole, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission, roleCan } from "../middlewares/requirePermission.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import {
  SuggestionError,
  activityOverview,
  approveSuggestion,
  assistantEnabled,
  dismissSuggestion,
  proposalsOverview,
  restoreSuggestion,
  savePermissions,
  settingsFor,
  undoActivity,
} from "../assistant/company.js";

// ── Pocket 128.1: the company assistant's three tabs (Proposals, Activity, Permissions) ──────────────────────────────────────────────────
// Gate: "assistant" (Business). Approving does what the card says (sends a reminder, puts an order on the list); every action is written to
// Activity, where what can be taken back is taken back. Not the job chat (routes/assistant.ts).

const router = Router();
const approveLimiter = userRateLimiter({ windowMs: 60 * 60 * 1000, max: 60, message: "Too many approvals this hour. Try again later." });

const fail = (res: Response, err: unknown, log: { error: (o: object, m: string) => void }, what: string) => {
  if (err instanceof SuggestionError) { res.status(err.status).json({ error: err.code, message: err.message }); return; }
  log.error({ err }, what);
  res.status(500).json({ error: "Internal server error" });
};

async function profileOf(userId: string) {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return profile;
}

// GET /api/assistant/overview — what is waiting, what was just decided, and what the person may do
router.get("/assistant/overview", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const role = getActorRole(res);
    const profile = await profileOf(userId);
    const canApprove = roleCan(role, "invoicing", "edit");
    if (!profile || !assistantEnabled(profile)) { res.json({ enabled: false, requiredPlan: minimumPlanFor("assistant"), canApprove, pending: [], recent: [] }); return; }
    res.json({ enabled: true, canApprove, ...(await proposalsOverview(userId, profile, getUserName(res).split(/\s+/)[0] ?? "")) });
  } catch (err) {
    fail(res, err, req.log, "Error loading assistant proposals");
  }
});

// POST /api/assistant/suggestions/:id/approve { draft? }
router.post("/assistant/suggestions/:id/approve", requireAuth, requirePermission("invoicing", "edit"), approveLimiter, async (req, res) => {
  try {
    const body = z.object({ draft: z.string().max(2000).optional() }).safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const userId = getUserId(res);
    const profile = await profileOf(userId);
    if (!profile || !assistantEnabled(profile)) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("assistant") }); return; }
    const out = await approveSuggestion({ userId, id: req.params.id as string, actorName: getUserName(res), profile, draft: body.data.draft, ip: req.ip });
    res.json(out);
  } catch (err) {
    fail(res, err, req.log, "Error approving a suggestion");
  }
});

// POST /api/assistant/suggestions/:id/dismiss
router.post("/assistant/suggestions/:id/dismiss", requireAuth, requirePermission("invoicing", "edit"), async (req, res) => {
  try {
    res.json({ suggestion: await dismissSuggestion(getUserId(res), req.params.id as string, getUserName(res)) });
  } catch (err) {
    fail(res, err, req.log, "Error dismissing a suggestion");
  }
});

// POST /api/assistant/suggestions/:id/restore — the Undo after Dismiss
router.post("/assistant/suggestions/:id/restore", requireAuth, requirePermission("invoicing", "edit"), async (req, res) => {
  try {
    res.json({ suggestion: await restoreSuggestion(getUserId(res), req.params.id as string) });
  } catch (err) {
    fail(res, err, req.log, "Error restoring a suggestion");
  }
});

// GET /api/assistant/activity — what it did (this month and the weeks before), who asked, and the voice minutes used
router.get("/assistant/activity", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await profileOf(userId);
    if (!profile || !assistantEnabled(profile)) { res.json({ enabled: false, requiredPlan: minimumPlanFor("assistant") }); return; }
    res.json({ enabled: true, canUndo: roleCan(getActorRole(res), "invoicing", "edit"), ...(await activityOverview(userId, profile.province)) });
  } catch (err) {
    fail(res, err, req.log, "Error loading assistant activity");
  }
});

// POST /api/assistant/activity/:id/undo
router.post("/assistant/activity/:id/undo", requireAuth, requirePermission("invoicing", "edit"), async (req, res) => {
  try {
    const out = await undoActivity(getUserId(res), req.params.id as string);
    if (!out.ok) { res.status(out.status).json({ error: "CANT_UNDO", message: out.message }); return; }
    res.json({ activity: out.row, toast: out.toast });
  } catch (err) {
    fail(res, err, req.log, "Error undoing an action");
  }
});

// GET /api/assistant/permissions
router.get("/assistant/permissions", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await profileOf(userId);
    res.json({ enabled: !!profile && assistantEnabled(profile), canEdit: roleCan(getActorRole(res), "team", "full"), ...(await settingsFor(userId)) });
  } catch (err) {
    fail(res, err, req.log, "Error loading assistant permissions");
  }
});

const level = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const minute = z.number().int().min(0).max(1439);
const patchBody = z.object({
  levels: z.object({ followups: level, reminders: level, receipts: level, scheduling: level, crew: level }).partial().optional(),
  spendLimitCents: z.number().int().min(0).max(500_000).optional(),
  quiet: z.object({ on: z.boolean(), from: minute, until: minute, sunday: z.boolean() }).partial().optional(),
  readBack: z.boolean().optional(),
});

// PUT /api/assistant/permissions — a partial change; answers with the whole
router.put("/assistant/permissions", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const body = patchBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const userId = getUserId(res);
    const profile = await profileOf(userId);
    if (!profile || !assistantEnabled(profile)) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("assistant") }); return; }
    res.json(await savePermissions(userId, body.data));
  } catch (err) {
    fail(res, err, req.log, "Error saving assistant permissions");
  }
});

export default router;
