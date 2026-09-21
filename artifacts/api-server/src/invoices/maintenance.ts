import { db, invoicesTable, businessProfilesTable, type BusinessProfile } from "@workspace/db";
import { and, eq, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { raiseAutomation } from "../lib/automation.js";
import { createNotification } from "../lib/notifications.js";
import { sendInvoiceReminderEmail } from "../lib/emailInvoices.js";
import { REMINDER_AFTER_DAYS, balanceCents } from "./math.js";
import { automationSettings, invoiceToken, logInvoiceEvent, publicInvoiceUrl, sendInvoice, invoicePdfBuffer } from "./service.js";
import { ti, type Lang, type IKey } from "./render.js";
import { sendSms } from "../lib/sms.js";

// ── Daily invoice maintenance (cron) ─────────────────────────────────────────
// 1. Open invoices past due → overdue (+ one in-app notification via the
//    `invoice.overdue` automation, idempotent per invoice).
// 2. Reminder emails 3 / 7 / 14 days past due when the company allows them.
// 3. Review-then-auto-send drafts whose timer elapsed.
// 4. Holdback releases whose lien period ended → notify (or auto-send).

const cad = (c: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(c / 100);

async function profilesFor(userIds: string[]): Promise<Map<string, BusinessProfile>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(businessProfilesTable).where(inArray(businessProfilesTable.userId, ids));
  return new Map(rows.map((r) => [r.userId, r]));
}

export async function runInvoiceMaintenance(now = new Date()): Promise<{ overdue: number; reminded: number; autoSent: number; releasesDue: number }> {
  let overdue = 0, reminded = 0, autoSent = 0, releasesDue = 0;

  // 1. Overdue detection
  const newlyOverdue = await db
    .select()
    .from(invoicesTable)
    .where(and(inArray(invoicesTable.status, ["sent", "viewed"]), lt(invoicesTable.dueDate, now), sql`${invoicesTable.totalCents} > ${invoicesTable.paidCents}`))
    .limit(200);
  for (const inv of newlyOverdue) {
    await db.update(invoicesTable).set({ status: "overdue" }).where(and(eq(invoicesTable.id, inv.id), inArray(invoicesTable.status, ["sent", "viewed"])));
    await logInvoiceEvent({ invoiceId: inv.id, type: "overdue", actor: "system" });
    await raiseAutomation({ event: "invoice.overdue", userId: inv.userId, entityType: "invoice", entityId: inv.id });
    overdue++;
  }

  // 2. Reminders
  const candidates = await db
    .select()
    .from(invoicesTable)
    .where(and(inArray(invoicesTable.status, ["overdue", "partially_paid"]), lt(invoicesTable.dueDate, now), lt(invoicesTable.reminderCount, REMINDER_AFTER_DAYS.length)))
    .limit(200);
  const profiles = await profilesFor(candidates.map((c) => c.userId));
  for (const inv of candidates) {
    if (balanceCents(inv) <= 0) continue;
    const settings = automationSettings(profiles.get(inv.userId));
    if (!settings.invoiceReminders) continue;
    const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000);
    const threshold = REMINDER_AFTER_DAYS[inv.reminderCount];
    if (threshold === undefined || daysOverdue < threshold) continue;
    const toEmail = (inv.customer.email ?? "").trim();
    const hasEmail = toEmail.includes("@");
    const smsTo = settings.smsReminders ? inv.customer.phone : null;
    if (!hasEmail && !smsTo) continue;
    try {
      if (hasEmail) {
        const { buffer } = await invoicePdfBuffer(inv.id);
        await sendInvoiceReminderEmail({
          toEmail,
          userId: inv.userId,
          customerName: inv.customer.name,
          companyName: inv.contractor.name,
          number: inv.number,
          totalCents: inv.totalCents,
          balanceCents: balanceCents(inv),
          dueDate: inv.dueDate,
          publicUrl: publicInvoiceUrl(invoiceToken(inv)),
          language: inv.language as Lang,
          etransferEmail: inv.paymentInstructions.etransferEmail ?? null,
          daysOverdue,
          pdfBuffer: buffer,
          replyTo: profiles.get(inv.userId)?.email ?? null,
        });
      }
      // Phase 74: with text reminders on, the customer is also texted the balance + link (or only texted, when there is no email).
      const senderProfile = profiles.get(inv.userId);
      if (senderProfile && smsTo) {
        const lang = inv.language === "fr" ? "fr" : "en";
        const balance = cad(balanceCents(inv));
        await sendSms({
          profile: senderProfile,
          to: smsTo,
          body: lang === "fr"
            ? `Rappel : la facture ${inv.number} (${balance}) est en retard de ${daysOverdue} jour${daysOverdue > 1 ? "s" : ""}. ${publicInvoiceUrl(invoiceToken(inv))}`
            : `Reminder: invoice ${inv.number} (${balance}) is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue. ${publicInvoiceUrl(invoiceToken(inv))}`,
          lang,
          purpose: "invoice_reminder",
          relatedEntityType: "invoice",
          relatedEntityId: inv.id,
        });
      }
      await db.update(invoicesTable).set({ reminderCount: sql`${invoicesTable.reminderCount} + 1`, lastReminderAt: now }).where(eq(invoicesTable.id, inv.id));
      await logInvoiceEvent({ invoiceId: inv.id, type: "reminder_sent", actor: "system", detail: { number: inv.reminderCount + 1, daysOverdue } });
      reminded++;
    } catch (err) {
      logger.error({ err, invoiceId: inv.id }, "Invoice reminder failed");
    }
  }

  // 3. Review-then-auto-send
  const toAutoSend = await db.select().from(invoicesTable).where(and(eq(invoicesTable.status, "draft"), isNotNull(invoicesTable.autoSendAt), lte(invoicesTable.autoSendAt, now))).limit(50);
  for (const inv of toAutoSend) {
    try {
      await sendInvoice({ invoiceId: inv.id, actor: "system" });
      await createNotification({ userId: inv.userId, type: "invoice_sent", title: `${ti(`type_${inv.type}` as IKey, inv.language as Lang)} ${inv.number} sent automatically`, body: `${cad(inv.totalCents)} — sent to ${inv.customer.name || "the customer"} after the review window elapsed.`, link: `/dashboard/invoices/${inv.id}`, entityType: "invoice", entityId: inv.id });
      autoSent++;
    } catch (err) {
      logger.error({ err, invoiceId: inv.id }, "Auto-send failed");
      await db.update(invoicesTable).set({ autoSendAt: null }).where(eq(invoicesTable.id, inv.id));
      await createNotification({ userId: inv.userId, type: "invoice_drafted", title: `Could not auto-send ${inv.number}`, body: err instanceof Error ? err.message : "Unknown error", link: `/dashboard/invoices/${inv.id}`, entityType: "invoice", entityId: inv.id });
    }
  }

  // 4. Holdback releases whose lien period is over
  const releases = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.status, "draft"), eq(invoicesTable.type, "holdback_release"), isNotNull(invoicesTable.scheduledFor), lte(invoicesTable.scheduledFor, now), sql`${invoicesTable.scheduledNotifiedAt} IS NULL`))
    .limit(50);
  const relProfiles = await profilesFor(releases.map((r) => r.userId));
  for (const inv of releases) {
    await db.update(invoicesTable).set({ scheduledNotifiedAt: now }).where(eq(invoicesTable.id, inv.id));
    const settings = automationSettings(relProfiles.get(inv.userId));
    let sent = false;
    if (settings.autoSendInvoices) {
      try {
        await sendInvoice({ invoiceId: inv.id, actor: "system" });
        sent = true;
      } catch (err) {
        logger.warn({ err, invoiceId: inv.id }, "Holdback release auto-send failed");
      }
    }
    await createNotification({
      userId: inv.userId,
      type: sent ? "invoice_sent" : "invoice_drafted",
      title: sent ? `Holdback release ${inv.number} sent` : `Holdback of ${cad(inv.totalCents)} is now releasable`,
      body: sent ? `${cad(inv.totalCents)} — the lien period ended and the release invoice was emailed to ${inv.customer.name || "the customer"}.` : `The lien period for this job has ended. Review and send holdback release invoice ${inv.number}.`,
      link: `/dashboard/invoices/${inv.id}`,
      entityType: "invoice",
      entityId: inv.id,
    });
    releasesDue++;
  }

  return { overdue, reminded, autoSent, releasesDue };
}

