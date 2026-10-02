import { Router } from "express";
import { db, quotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { companyNameForUser, pickLang, unsubscribeDonePage, resubscribedPage, unsubscribeMessagePage } from "../lib/unsubscribePage.js";
import { ipRateLimiter } from "../lib/rateLimit.js";

const router = Router();
const unsubscribeLimiter = ipRateLimiter({ windowMs: 60_000, max: 30, message: "Too many requests" });

// Working unsubscribe link for Phase 21 quote follow-up reminders, same
// pattern as public-leads.ts. No auth — the token itself (a random uuid,
// never the quote id) is the credential.
router.get("/public/quotes/unsubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) {
    res.status(400).send(unsubscribeMessagePage(pickLang(req), "missing"));
    return;
  }

  try {
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.unsubscribeToken, token));
    if (!quote) {
      res.status(404).send(unsubscribeMessagePage(pickLang(req), "invalid"));
      return;
    }

    if (!quote.unsubscribedAt) {
      await db
        .update(quotesTable)
        .set({ unsubscribedAt: new Date(), nextFollowUpAt: null })
        .where(eq(quotesTable.id, quote.id));
    }

    res.status(200).send(unsubscribeDonePage({ lang: pickLang(req), kind: "reminders", company: quote.companySnapshot?.companyName ?? "", resubscribe: { action: `resubscribe?token=${encodeURIComponent(token)}` } }));
  } catch (err) {
    logger.error({ err }, "Quote follow-up unsubscribe failed");
    res.status(500).send(unsubscribeMessagePage(pickLang(req), "error"));
  }
});

// Changed your mind: the reminders on this quote can start again (the next one is scheduled by the usual daily run).
router.post("/public/quotes/resubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) { res.status(400).send(unsubscribeMessagePage(pickLang(req), "missing")); return; }
  try {
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.unsubscribeToken, token));
    if (!quote) { res.status(404).send(unsubscribeMessagePage(pickLang(req), "invalid")); return; }
    if (quote.unsubscribedAt) await db.update(quotesTable).set({ unsubscribedAt: null }).where(eq(quotesTable.id, quote.id));
    res.status(200).send(resubscribedPage({ lang: pickLang(req), company: quote.companySnapshot?.companyName ?? "" }));
  } catch (err) {
    logger.error({ err }, "Quote follow-up resubscribe failed");
    res.status(500).send(unsubscribeMessagePage(pickLang(req), "error"));
  }
});

export default router;
