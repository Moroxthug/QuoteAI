import { Router, type Response } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  booksClosesTable,
  businessProfilesTable,
  flinksConnectionsTable,
  quickbooksConnectionsTable,
  waveConnectionsTable,
  hasFeature,
  minimumPlanFor,
  COST_CATEGORIES,
  type BusinessProfile,
} from "@workspace/db";
import { requireAuth, getUserId, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { todayFor } from "../compliance/service.js";
import { syncFlinksTransactions } from "../flinks/service.js";
import { ReconcileError, candidatesFor, costFromLine, ignoreLine, listBankLines, matchCost, matchPayment, recordPaymentFromLine, unmatchLine } from "../books/reconcile.js";
import { listClaims, mergeClaim } from "../books/claims.js";
import { isMonth, monthChecklist, serializeClose, snapshotOf } from "../books/close.js";

// ── Phase 88: /dashboard/books ───────────────────────────────────────────────
// Reconcile (bank line ↔ cost ↔ payment), materials claims ↔ receipts, and
// the month-end close. Money that belongs to the company, so owner, admin and
// office only (invoicing:full) — a foreman never sees the bank account.

const router = Router();

async function profileFor(userId: string): Promise<BusinessProfile | undefined> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return profile;
}

/** Books ride on invoicing (Pro); the bank tab additionally needs the Flinks feed (Elite) and a connection. */
async function requireBooks(userId: string, res: Response): Promise<BusinessProfile | null> {
  const profile = await profileFor(userId);
  if (!hasFeature(profile, "invoicing")) {
    res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("invoicing") });
    return null;
  }
  return profile ?? null;
}

async function requireBankFeed(userId: string, res: Response): Promise<boolean> {
  const profile = await requireBooks(userId, res);
  if (!profile && res.headersSent) return false;
  if (!hasFeature(profile, "flinks_bank_feed")) {
    res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("flinks_bank_feed") });
    return false;
  }
  return true;
}

function fail(res: Response, err: unknown, log: { error: (o: object, m: string) => void }, what: string) {
  if (err instanceof ReconcileError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "ALREADY_MATCHED" || err.code === "OVER_BALANCE" || err.message === "CLAIM_SYNCED" ? 409 : 400;
    res.status(status).json({ error: err.message === "CLAIM_SYNCED" ? "CLAIM_SYNCED" : err.code, message: err.message });
    return;
  }
  log.error({ err }, what);
  res.status(500).json({ error: "Internal server error" });
}

const actorOf = (res: Response, ip: string | undefined) => ({ id: getUserId(res), ip: ip ?? null });

// GET /api/books/overview — what the page needs to decide which tabs make sense
router.get("/books/overview", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await profileFor(userId);
    if (!hasFeature(profile, "invoicing")) {
      res.json({ enabled: false, requiredPlan: minimumPlanFor("invoicing") });
      return;
    }
    const [flinks] = await db.select().from(flinksConnectionsTable).where(eq(flinksConnectionsTable.userId, userId));
    const [qbo] = await db.select({ isEnabled: quickbooksConnectionsTable.isEnabled, companyName: quickbooksConnectionsTable.companyName, paymentsPulledAt: quickbooksConnectionsTable.paymentsPulledAt }).from(quickbooksConnectionsTable).where(eq(quickbooksConnectionsTable.userId, userId));
    const [wave] = await db.select({ isEnabled: waveConnectionsTable.isEnabled, businessName: waveConnectionsTable.businessName }).from(waveConnectionsTable).where(eq(waveConnectionsTable.userId, userId));
    const today = todayFor(profile?.province);
    res.json({
      enabled: true,
      today,
      bank: {
        onPlan: hasFeature(profile, "flinks_bank_feed"),
        requiredPlan: minimumPlanFor("flinks_bank_feed"),
        connected: !!flinks?.selectedAccount,
        account: flinks?.selectedAccount ?? null,
        lastSyncedAt: flinks?.lastSyncedAt?.toISOString() ?? null,
      },
      books: qbo?.isEnabled
        ? { provider: "quickbooks", name: qbo.companyName, paymentsPulledAt: qbo.paymentsPulledAt?.toISOString() ?? null }
        : wave?.isEnabled
          ? { provider: "wave", name: wave.businessName, paymentsPulledAt: null }
          : null,
    });
  } catch (err) {
    fail(res, err, req.log, "Error loading books overview");
  }
});

// ── Bank lines ───────────────────────────────────────────────────────────────

router.get("/books/bank", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBankFeed(userId, res))) return;
    const status = z.enum(["unmatched", "matched", "ignored", "all"]).catch("all").parse(req.query.status);
    res.json({ lines: await listBankLines(userId, { status }) });
  } catch (err) {
    fail(res, err, req.log, "Error listing bank lines");
  }
});

router.post("/books/bank/sync", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBankFeed(userId, res))) return;
    res.json(await syncFlinksTransactions(userId));
  } catch (err) {
    req.log.error({ err }, "Error syncing the bank feed");
    res.status(502).json({ error: "FLINKS_API_ERROR", message: "Couldn't reach the bank feed — try again in a moment." });
  }
});

router.get("/books/bank/:id/candidates", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBankFeed(userId, res))) return;
    res.json(await candidatesFor(userId, req.params.id as string));
  } catch (err) {
    fail(res, err, req.log, "Error loading match candidates");
  }
});

router.post("/books/bank/:id/match", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBankFeed(userId, res))) return;
    const body = z.union([z.object({ costEntryId: z.string().uuid() }), z.object({ paymentId: z.string().uuid() })]).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const actor = actorOf(res, req.ip);
    if ("costEntryId" in body.data) await matchCost(userId, req.params.id as string, body.data.costEntryId, actor);
    else await matchPayment(userId, req.params.id as string, body.data.paymentId, actor);
    res.json({ success: true });
  } catch (err) {
    fail(res, err, req.log, "Error matching bank line");
  }
});

router.post("/books/bank/:id/record-payment", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBankFeed(userId, res))) return;
    const body = z.object({ invoiceId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    res.status(201).json(await recordPaymentFromLine(userId, req.params.id as string, body.data.invoiceId, actorOf(res, req.ip)));
  } catch (err) {
    fail(res, err, req.log, "Error recording a payment from the bank line");
  }
});

router.post("/books/bank/:id/create-cost", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBankFeed(userId, res))) return;
    const body = z.object({ category: z.enum(COST_CATEGORIES), projectId: z.string().uuid().nullable().default(null) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    res.status(201).json(await costFromLine(userId, req.params.id as string, body.data, actorOf(res, req.ip)));
  } catch (err) {
    fail(res, err, req.log, "Error creating a cost from the bank line");
  }
});

router.post("/books/bank/:id/unmatch", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBankFeed(userId, res))) return;
    await unmatchLine(userId, req.params.id as string, actorOf(res, req.ip));
    res.json({ success: true });
  } catch (err) {
    fail(res, err, req.log, "Error unmatching bank line");
  }
});

router.post("/books/bank/:id/ignore", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBankFeed(userId, res))) return;
    await ignoreLine(userId, req.params.id as string, actorOf(res, req.ip));
    res.json({ success: true });
  } catch (err) {
    fail(res, err, req.log, "Error ignoring bank line");
  }
});

// ── Materials claims ─────────────────────────────────────────────────────────

router.get("/books/claims", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBooks(userId, res))) return;
    res.json({ claims: await listClaims(userId) });
  } catch (err) {
    fail(res, err, req.log, "Error listing materials claims");
  }
});

router.post("/books/claims/:id/merge", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBooks(userId, res))) return;
    const body = z.object({ receiptId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    res.json(await mergeClaim(userId, req.params.id as string, body.data.receiptId, actorOf(res, req.ip)));
  } catch (err) {
    fail(res, err, req.log, "Error merging a claim into its receipt");
  }
});

// ── Month-end close ──────────────────────────────────────────────────────────

router.get("/books/close", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireBooks(userId, res);
    if (!profile && res.headersSent) return;
    // Default: last month — the one being closed at the start of this one.
    const today = todayFor(profile?.province);
    const [y, m] = today.split("-").map(Number) as [number, number];
    const fallback = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const month = typeof req.query.month === "string" && isMonth(req.query.month) ? req.query.month : fallback;
    if (month > today.slice(0, 7)) {
      res.status(400).json({ error: "FUTURE_MONTH" });
      return;
    }
    const closes = await db.select({ month: booksClosesTable.month }).from(booksClosesTable).where(eq(booksClosesTable.userId, userId));
    res.json({ ...(await monthChecklist(userId, profile?.province ?? null, month)), closedMonths: closes.map((c) => c.month).sort().reverse() });
  } catch (err) {
    fail(res, err, req.log, "Error building the month-end checklist");
  }
});

router.post("/books/close", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireBooks(userId, res);
    if (!profile && res.headersSent) return;
    const body = z.object({ month: z.string().refine(isMonth), note: z.string().max(1000).default("") }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const today = todayFor(profile?.province);
    // The month has to be over before it can be closed.
    if (body.data.month >= today.slice(0, 7)) {
      res.status(400).json({ error: "MONTH_NOT_OVER" });
      return;
    }
    const list = await monthChecklist(userId, profile?.province ?? null, body.data.month);
    const snapshot = snapshotOf(list.items);
    const [row] = await db
      .insert(booksClosesTable)
      .values({ userId, month: body.data.month, closedByName: getUserName(res), note: body.data.note, snapshot })
      .onConflictDoUpdate({ target: [booksClosesTable.userId, booksClosesTable.month], set: { closedAt: new Date(), closedByName: getUserName(res), note: body.data.note, snapshot } })
      .returning();
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "books_close", entityId: body.data.month, action: "closed", diff: { open: list.open, note: body.data.note }, ip: req.ip ?? null });
    res.json({ close: serializeClose(row!) });
  } catch (err) {
    fail(res, err, req.log, "Error closing the month");
  }
});

router.post("/books/close/reopen", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireBooks(userId, res)) && res.headersSent) return;
    const body = z.object({ month: z.string().refine(isMonth) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const rows = await db.delete(booksClosesTable).where(and(eq(booksClosesTable.userId, userId), eq(booksClosesTable.month, body.data.month))).returning();
    if (rows.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "books_close", entityId: body.data.month, action: "reopened", diff: null, ip: req.ip ?? null });
    res.json({ success: true });
  } catch (err) {
    fail(res, err, req.log, "Error reopening the month");
  }
});

export default router;
