import { randomBytes, createHmac } from "crypto";
import { db, webhookEndpointsTable, webhookDeliveriesTable, type WebhookEndpoint, type AutomationEvent } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { safeFetch, assertPublicHttpsUrl } from "./safeFetch.js";
import { encryptSecret, decryptSecret } from "./crypto.js";

/**
 * The signing secret is stored AES-GCM encrypted (audit B9). Rows written
 * before that still hold the plain `whsec_…` value and are read as is.
 */
export function readWebhookSecret(stored: string): string {
  return stored.startsWith("whsec_") ? stored : decryptSecret(stored);
}

export async function createWebhook(userId: string, url: string, events: AutomationEvent[]): Promise<{ webhook: WebhookEndpoint; secret: string }> {
  assertPublicHttpsUrl(url);
  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  const [webhook] = await db.insert(webhookEndpointsTable).values({ userId, url, events, secret: encryptSecret(secret) }).returning();
  return { webhook: webhook!, secret };
}

export async function listWebhooks(userId: string): Promise<WebhookEndpoint[]> {
  return db.select().from(webhookEndpointsTable).where(eq(webhookEndpointsTable.userId, userId)).orderBy(desc(webhookEndpointsTable.createdAt));
}

export async function deleteWebhook(userId: string, webhookId: string): Promise<boolean> {
  const deleted = await db
    .delete(webhookEndpointsTable)
    .where(and(eq(webhookEndpointsTable.id, webhookId), eq(webhookEndpointsTable.userId, userId)))
    .returning();
  return deleted.length > 0;
}

export async function setWebhookEnabled(userId: string, webhookId: string, isEnabled: boolean): Promise<boolean> {
  const updated = await db
    .update(webhookEndpointsTable)
    .set({ isEnabled })
    .where(and(eq(webhookEndpointsTable.id, webhookId), eq(webhookEndpointsTable.userId, userId)))
    .returning();
  return updated.length > 0;
}

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Delivers one automation event to every enabled webhook the company has
 * registered for it. Never throws for an individual delivery failure — each
 * one is logged to `webhook_deliveries` and left there for the company to
 * see in Settings; the automation run itself only fails (and gets retried)
 * if the whole dispatch step throws, which it doesn't on a per-endpoint basis.
 */
export async function dispatchWebhooks(userId: string, event: AutomationEvent, entityId: string, payload: Record<string, unknown>): Promise<void> {
  const endpoints = await db
    .select()
    .from(webhookEndpointsTable)
    .where(and(eq(webhookEndpointsTable.userId, userId), eq(webhookEndpointsTable.isEnabled, true)));
  const matching = endpoints.filter((e) => (e.events as AutomationEvent[]).includes(event));
  if (matching.length === 0) return;

  const body = JSON.stringify({ event, entityId, data: payload, createdAt: new Date().toISOString() });

  for (const endpoint of matching) {
    let responseStatus: number | null = null;
    let success = false;
    let error: string | null = null;
    try {
      // Audit B5: private/loopback/metadata addresses refused, redirects not followed.
      const res = await safeFetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-QuoteAI-Signature": signPayload(readWebhookSecret(endpoint.secret), body),
          "X-QuoteAI-Event": event,
        },
        body,
        timeoutMs: 10_000,
        maxBytes: 64_000,
      });
      responseStatus = res.status;
      success = res.ok;
      if (!success) error = `HTTP ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      logger.warn({ err, webhookId: endpoint.id, event }, "Webhook delivery failed");
    }
    await db.insert(webhookDeliveriesTable).values({ webhookId: endpoint.id, event, entityId, responseStatus, success, error });
  }
}
