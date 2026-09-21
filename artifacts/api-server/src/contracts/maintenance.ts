import { db, contractsTable, contractSignersTable, businessProfilesTable, DEFAULT_AUTOMATION_SETTINGS, type BusinessProfile } from "@workspace/db";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { sendContractReminderEmail } from "../lib/emailContracts.js";
import { hashToken, newRawToken, logContractEvent } from "./service.js";
import { sendSms } from "../lib/sms.js";

const automationSettings = (profile: BusinessProfile) => ({ ...DEFAULT_AUTOMATION_SETTINGS, ...(profile.automationSettings ?? {}) });

const REMINDER_AFTER_DAYS = [3, 7, 14];
const MAX_REMINDERS = REMINDER_AFTER_DAYS.length;

/**
 * Cron: expire signing links past their date and remind customers who have
 * not signed after 3 / 7 / 14 days. A reminder re-issues the token so the
 * emailed link is always the freshest one.
 */
export async function runContractMaintenance(): Promise<{ expired: number; reminded: number }> {
  const now = new Date();
  let expired = 0;
  let reminded = 0;

  const toExpire = await db
    .select({ id: contractsTable.id })
    .from(contractsTable)
    .where(and(inArray(contractsTable.status, ["sent", "viewed"]), isNotNull(contractsTable.expiresAt), lt(contractsTable.expiresAt, now)))
    .limit(50);
  for (const c of toExpire) {
    await db.update(contractsTable).set({ status: "expired" }).where(eq(contractsTable.id, c.id));
    await logContractEvent({ contractId: c.id, type: "expired", actor: "system" });
    expired++;
  }

  const candidates = await db
    .select()
    .from(contractsTable)
    .where(and(inArray(contractsTable.status, ["sent", "viewed"]), isNotNull(contractsTable.sentAt), lt(contractsTable.reminderCount, MAX_REMINDERS)))
    .limit(100);

  for (const c of candidates) {
    const daysSinceSent = (now.getTime() - c.sentAt!.getTime()) / 86_400_000;
    const threshold = REMINDER_AFTER_DAYS[c.reminderCount];
    if (threshold === undefined || daysSinceSent < threshold) continue;
    const [signer] = await db.select().from(contractSignersTable).where(and(eq(contractSignersTable.contractId, c.id), eq(contractSignersTable.role, "customer")));
    if (!signer || signer.status === "signed" || !signer.email) continue;
    try {
      const raw = newRawToken();
      await db.update(contractSignersTable).set({ tokenHash: hashToken(raw), tokenExpiresAt: c.expiresAt }).where(eq(contractSignersTable.id, signer.id));
      const [senderProfile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, c.userId));
      const signUrl = `${getBaseUrl()}/sign/${raw}`;
      // Phase 74: with text reminders on, the customer is also texted the (fresh) signing link.
      const customerPhone = c.variables.customer?.phone;
      if (senderProfile && automationSettings(senderProfile).smsReminders && customerPhone) {
        const lang = c.language === "fr" ? "fr" : "en";
        await sendSms({
          profile: senderProfile,
          to: customerPhone,
          body: lang === "fr" ? `Rappel : le contrat ${c.contractNumber} attend votre signature. ${signUrl}` : `Reminder: contract ${c.contractNumber} is waiting for your signature. ${signUrl}`,
          lang,
          purpose: "contract_reminder",
          relatedEntityType: "contract",
          relatedEntityId: c.id,
        });
      }
      await sendContractReminderEmail({
        toEmail: signer.email,
        userId: c.userId,
        customerName: signer.name,
        companyName: c.variables.contractor.name,
        contractNumber: c.contractNumber,
        signUrl,
        expiresAt: c.expiresAt ?? new Date(now.getTime() + 7 * 86_400_000),
        language: c.language as "en" | "fr",
        companyLogoUrl: senderProfile?.logoUrl ?? null,
        replyTo: senderProfile?.email ?? null,
      });
      await db.update(contractsTable).set({ lastReminderAt: now, reminderCount: sql`${contractsTable.reminderCount} + 1` }).where(eq(contractsTable.id, c.id));
      await logContractEvent({ contractId: c.id, type: "reminder_sent", actor: "system", signerId: signer.id, detail: { number: c.reminderCount + 1 } });
      reminded++;
    } catch (err) {
      logger.error({ err, contractId: c.id }, "Contract reminder failed");
    }
  }

  return { expired, reminded };
}
