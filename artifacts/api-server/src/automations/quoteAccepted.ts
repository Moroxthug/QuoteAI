import { db, quotesTable, businessProfilesTable, authUsersTable, DEFAULT_AUTOMATION_SETTINGS, hasFeature, type QuoteClientData, type QuoteCompanySnapshot } from "@workspace/db";
import { createContractFromQuote } from "../contracts/service.js";
import { logger } from "../lib/logger.js";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation";
import { createNotification, writeAudit } from "../lib/notifications";
import { sendQuoteAcceptedEmail } from "../lib/email";
import { getBaseUrl } from "../lib/baseUrl";

// quote.accepted → tell the company (in-app + email). Phase 1 adds
// "auto-draft the contract" to this same handler.
registerAutomation("quote.accepted", async (run) => {
  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, run.entityId));
  if (!quote) throw new Error(`Quote ${run.entityId} not found`);
  if (quote.status !== "accepted") return { skipped: "not accepted" };

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, quote.userId));
  const [owner] = await db.select({ email: authUsersTable.email, name: authUsersTable.name }).from(authUsersTable).where(eq(authUsersTable.id, quote.userId));

  const settings = { ...DEFAULT_AUTOMATION_SETTINGS, ...(profile?.automationSettings ?? {}) };
  const clientName = quote.acceptedByName || (quote.clientData as QuoteClientData)?.nome || "The customer";
  const quoteNumber = quote.numeroPreventivoData || `No. ${quote.id.slice(0, 4).toUpperCase()}`;
  const totale = new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(quote.totale));
  const quoteUrl = `${getBaseUrl()}/dashboard/quotes/${quote.id}`;

  await writeAudit({
    userId: quote.userId,
    actorType: "customer",
    actorId: quote.acceptedByName,
    entityType: "quote",
    entityId: quote.id,
    action: "accepted",
    diff: { acceptedAt: quote.acceptedAt, acceptedByName: quote.acceptedByName },
    ip: quote.acceptedIp,
  });

  // Idempotency: a retry after a partial failure must not create a second
  // notification, so the payload records what already happened.
  const done = (run.result ?? {}) as { notified?: boolean; emailed?: boolean; contractId?: string };
  const result: Record<string, unknown> = { ...done };

  // Phase 1: draft the contract right away so the company only has to
  // review, sign and send. createContractFromQuote is idempotent per quote.
  if (!done.contractId && settings.autoDraftContract && hasFeature(profile, "contracts")) {
    try {
      const { contract } = await createContractFromQuote({ userId: quote.userId, quoteId: quote.id, actor: "system" });
      result.contractId = contract.id;
    } catch (err) {
      // Not fatal for the notification path; the company can draft manually.
      logger.warn({ err, quoteId: quote.id }, "Auto-draft contract failed");
      result.contractError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!done.notified) {
    await createNotification({
      userId: quote.userId,
      type: "quote_accepted",
      title: `${clientName} accepted quote ${quoteNumber}`,
      body: result.contractId ? `Total ${totale}. We drafted the contract — review, sign and send it.` : `Total ${totale}. Next: turn it into a signed contract.`,
      link: result.contractId ? `/dashboard/contracts/${result.contractId}` : `/dashboard/quotes/${quote.id}`,
      entityType: "quote",
      entityId: quote.id,
    });
    result.notified = true;
  }

  if (!done.emailed && settings.notifyOnQuoteAccepted) {
    const toEmail = profile?.email || owner?.email;
    if (toEmail) {
      const companyName = (quote.companySnapshot as QuoteCompanySnapshot | null)?.companyName || profile?.companyName || owner?.name || "there";
      await sendQuoteAcceptedEmail({
        toEmail,
        companyName,
        clientName,
        quoteNumber,
        totale,
        acceptedAt: (quote.acceptedAt ?? new Date()).toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short" }),
        quoteUrl,
      });
      result.emailed = true;
    } else {
      result.emailed = false;
      result.emailSkipped = "no owner email";
    }
  }

  return result;
});
