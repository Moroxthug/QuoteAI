import { Router } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

// CASL requires a working unsubscribe link that takes effect without delay,
// same pattern as public-leads.ts. No auth — the token itself (a random uuid,
// never the client id) is the credential. Only stops marketing-type sends
// (review requests, shared photos) — never transactional messages.
router.get("/public/clients/unsubscribe", async (req, res) => {
  const token = String(req.query.token ?? "");
  if (!token) {
    res.status(400).send("Missing unsubscribe link.");
    return;
  }

  try {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.marketingUnsubscribeToken, token));
    if (!client) {
      res.status(404).send("This unsubscribe link is no longer valid.");
      return;
    }

    if (!client.marketingUnsubscribedAt) {
      await db.update(clientsTable).set({ marketingUnsubscribedAt: new Date() }).where(eq(clientsTable.id, client.id));
    }

    res.status(200).send(`<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;text-align:center;padding:48px;">
      <h2>You've been unsubscribed</h2>
      <p>You won't receive any more review requests or shared photos from us. This doesn't affect quotes, contracts, or invoices we send you.</p>
    </body></html>`);
  } catch (err) {
    logger.error({ err }, "Client marketing unsubscribe failed");
    res.status(500).send("Something went wrong. Please try again later.");
  }
});

export default router;
