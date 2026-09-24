import { Router } from "express";
import { db, quotesTable } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireApiKey, publicApiLimiter } from "../../middlewares/apiKeyAuth.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { getUserId } from "../../middlewares/authMiddleware.js";
import { serializeQuote } from "../quotes.js";
import { createManualQuote, ManualQuoteBodySchema, manualQuoteBodyError } from "../../quotes/manualCreate.js";

const router = Router();

// GET /api/v1/public/quotes
router.get("/quotes", requireApiKey, publicApiLimiter, requirePermission("quotes", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const quotes = await db.select().from(quotesTable).where(and(eq(quotesTable.userId, userId), isNull(quotesTable.archivedAt))).orderBy(desc(quotesTable.createdAt)).limit(limit);
    res.json({ items: quotes.map((q) => serializeQuote(q)) });
  } catch (err) {
    req.log.error({ err }, "Public API: error listing quotes");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/public/quotes/:id
router.get("/quotes/:id", requireApiKey, publicApiLimiter, requirePermission("quotes", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [quote] = await db.select().from(quotesTable).where(and(eq(quotesTable.id, req.params.id as string), eq(quotesTable.userId, userId)));
    if (!quote) { res.status(404).json({ error: "Not found" }); return; }
    res.json(serializeQuote(quote));
  } catch (err) {
    req.log.error({ err }, "Public API: error fetching quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/v1/public/quotes — structured creation (same path as the in-app "manual quote" builder, no AI parsing)
router.post("/quotes", requireApiKey, publicApiLimiter, requirePermission("quotes", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = ManualQuoteBodySchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: manualQuoteBodyError(body.error), details: body.error });
      return;
    }
    const result = await createManualQuote(userId, body.data);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, details: result.details });
      return;
    }
    res.status(201).json(serializeQuote(result.quote));
  } catch (err) {
    req.log.error({ err }, "Public API: error creating quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
