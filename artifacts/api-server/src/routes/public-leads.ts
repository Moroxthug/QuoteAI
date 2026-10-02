import { Router } from "express";
import { db, leadsTable, leadEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { companyNameForUser, pickLang, resubscribedPage, unsubscribeDonePage, unsubscribeMessagePage } from "../lib/unsubscribePage.js";
import { ipRateLimiter } from "../lib/rateLimit.js";

const router = Router();
const unsubscribeLimiter = ipRateLimiter({ windowMs: 60_000, max: 30, message: "Too many requests" });

// CASL requires a working unsubscribe link that takes effect without delay.
// No auth — the token itself (a random uuid, never the lead id) is the
// credential, exactly like an invoice/contract share link.
router.get("/public/leads/unsubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) {
    res.status(400).send(unsubscribeMessagePage(pickLang(req), "missing"));
    return;
  }

  try {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.unsubscribeToken, token));
    if (!lead) {
      res.status(404).send(unsubscribeMessagePage(pickLang(req), "invalid"));
      return;
    }

    if (!lead.unsubscribedAt) {
      await db
        .update(leadsTable)
        .set({ status: "unsubscribed", unsubscribedAt: new Date(), nextFollowUpAt: null })
        .where(eq(leadsTable.id, lead.id));
      await db.insert(leadEventsTable).values({ leadId: lead.id, userId: lead.userId, type: "unsubscribed", payload: {} });
    }

    res.status(200).send(unsubscribeDonePage({ lang: pickLang(req, lead.preferredLanguage), kind: "followups", company: await companyNameForUser(lead.userId), resubscribe: { action: `resubscribe?token=${encodeURIComponent(token)}` } }));
  } catch (err) {
    logger.error({ err }, "Lead unsubscribe failed");
    res.status(500).send(unsubscribeMessagePage(pickLang(req), "error"));
  }
});

// Changed your mind: the same token turns the follow-ups back on. A person has to press the button (a form POST), so a mail scanner opening the link cannot undo it.
router.post("/public/leads/resubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) { res.status(400).send(unsubscribeMessagePage(pickLang(req), "missing")); return; }
  try {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.unsubscribeToken, token));
    if (!lead) { res.status(404).send(unsubscribeMessagePage(pickLang(req), "invalid")); return; }
    if (lead.unsubscribedAt) {
      await db.update(leadsTable).set({ status: lead.status === "unsubscribed" ? "new" : lead.status, unsubscribedAt: null }).where(eq(leadsTable.id, lead.id));
      await db.insert(leadEventsTable).values({ leadId: lead.id, userId: lead.userId, type: "note_added", payload: { note: "Resubscribed to follow-ups" } });
    }
    res.status(200).send(resubscribedPage({ lang: pickLang(req, lead.preferredLanguage), company: await companyNameForUser(lead.userId) }));
  } catch (err) {
    logger.error({ err }, "Lead resubscribe failed");
    res.status(500).send(unsubscribeMessagePage(pickLang(req), "error"));
  }
});

export default router;
