import { Router } from "express";
import { db, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { companyNameForUser, pickLang, resubscribedPage, unsubscribeDonePage, unsubscribeMessagePage } from "../lib/unsubscribePage.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { verifyUnsubscribeToken } from "../lifecycle/token.js";

// Phase 134: the unsubscribe link in every lifecycle email. The token is signed (lifecycle/token.ts), so nothing is looked up to check it;
// the user id inside it is the only thing it can act on, and the only action is switching lifecycle emails off or on.
const router = Router();
const limiter = ipRateLimiter({ windowMs: 60_000, max: 30, message: "Too many requests" });

async function setOptOut(userId: string, optedOut: boolean): Promise<boolean> {
  const rows = await db
    .update(businessProfilesTable)
    .set({ marketingEmailsOptOut: optedOut, marketingOptOutAt: optedOut ? new Date() : null })
    .where(eq(businessProfilesTable.userId, userId))
    .returning({ userId: businessProfilesTable.userId });
  return rows.length > 0;
}

async function profileLang(req: Parameters<typeof pickLang>[0], userId: string) {
  const [p] = await db.select({ docLanguage: businessProfilesTable.docLanguage }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return pickLang(req, p?.docLanguage ?? null);
}

// GET: opens from the link in the email. CASL: it takes effect without delay, so the page opts the person out right away and offers Resubscribe (a form POST).
router.get("/public/lifecycle/unsubscribe", limiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) { res.status(400).send(unsubscribeMessagePage(pickLang(req), "missing")); return; }
  const userId = verifyUnsubscribeToken(token);
  if (!userId) { res.status(404).send(unsubscribeMessagePage(pickLang(req), "invalid")); return; }
  try {
    if (!(await setOptOut(userId, true))) { res.status(404).send(unsubscribeMessagePage(pickLang(req), "invalid")); return; }
    res.status(200).send(unsubscribeDonePage({ lang: await profileLang(req, userId), kind: "lifecycle", company: await companyNameForUser(userId), resubscribe: { action: `unsubscribe?token=${encodeURIComponent(token)}&resubscribe=1` } }));
  } catch (err) {
    logger.error({ err }, "Lifecycle unsubscribe failed");
    res.status(500).send(unsubscribeMessagePage(pickLang(req), "error"));
  }
});

// POST: (a) the mail client's one-click unsubscribe (RFC 8058, List-Unsubscribe-Post) and (b) the Resubscribe button (`resubscribe=1` in the query).
// A person has to press the button for (b), so a mail scanner opening the GET link cannot undo it.
router.post("/public/lifecycle/unsubscribe", limiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) { res.status(400).send(unsubscribeMessagePage(pickLang(req), "missing")); return; }
  const userId = verifyUnsubscribeToken(token);
  if (!userId) { res.status(404).send(unsubscribeMessagePage(pickLang(req), "invalid")); return; }
  try {
    const resubscribe = String(req.query.resubscribe ?? "") === "1";
    if (!(await setOptOut(userId, !resubscribe))) { res.status(404).send(unsubscribeMessagePage(pickLang(req), "invalid")); return; }
    const lang = await profileLang(req, userId);
    const company = await companyNameForUser(userId);
    res.status(200).send(resubscribe ? resubscribedPage({ lang, company }) : unsubscribeDonePage({ lang, kind: "lifecycle", company }));
  } catch (err) {
    logger.error({ err }, "Lifecycle unsubscribe (POST) failed");
    res.status(500).send(unsubscribeMessagePage(pickLang(req), "error"));
  }
});

export default router;
