import { Router } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { companyNameForUser, pickLang, unsubscribeDonePage, unsubscribeMessagePage } from "../lib/unsubscribePage.js";
import { ipRateLimiter } from "../lib/rateLimit.js";

const router = Router();
const unsubscribeLimiter = ipRateLimiter({ windowMs: 60_000, max: 30, message: "Too many requests" });

// CASL requires a working unsubscribe link that takes effect without delay,
// same pattern as public-leads.ts. No auth — the token itself (a random uuid,
// never the client id) is the credential. Only stops marketing-type sends
// (review requests, shared photos) — never transactional messages.
router.get("/public/clients/unsubscribe", unsubscribeLimiter, async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) {
    res.status(400).send(unsubscribeMessagePage(pickLang(req), "missing"));
    return;
  }

  try {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.marketingUnsubscribeToken, token));
    if (!client) {
      res.status(404).send(unsubscribeMessagePage(pickLang(req), "invalid"));
      return;
    }

    if (!client.marketingUnsubscribedAt) {
      await db.update(clientsTable).set({ marketingUnsubscribedAt: new Date() }).where(eq(clientsTable.id, client.id));
    }

    res.status(200).send(unsubscribeDonePage({ lang: pickLang(req, client.preferredLanguage), kind: "marketing", company: await companyNameForUser(client.userId) }));
  } catch (err) {
    logger.error({ err }, "Client marketing unsubscribe failed");
    res.status(500).send(unsubscribeMessagePage(pickLang(req), "error"));
  }
});

export default router;
