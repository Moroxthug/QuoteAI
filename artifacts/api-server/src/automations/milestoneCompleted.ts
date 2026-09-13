import { db, milestonesTable, projectsTable, businessProfilesTable, invoicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { createNotification } from "../lib/notifications.js";
import { logger } from "../lib/logger.js";
import { draftMilestoneInvoice, draftFinalInvoice, draftHoldbackReleaseInvoice, applyAutoSendPolicy } from "../invoices/service.js";

const cad = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

// milestone.completed → Phase 4: draft the progress invoice for the payment
// term this milestone releases (or leave a plain reminder when the term is
// not linked to a schedule), then apply the company's send policy. A
// completion-type term becomes the final invoice instead.
registerAutomation("milestone.completed", async (run) => {
  const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, run.entityId));
  if (!m) throw new Error(`Milestone ${run.entityId} not found`);
  if (m.status !== "completed") return { skipped: "not completed" };
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, m.projectId));
  const done = (run.result ?? {}) as { notified?: boolean; invoiceId?: string };
  if (!m.paymentTermId || !m.paymentAmountCents) return { notified: false, reason: "no payment term" };

  const drafted = await draftMilestoneInvoice({ milestone: m });
  if (drafted?.created || (drafted && !done.notified)) {
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, run.userId));
    const outcome = await applyAutoSendPolicy(drafted.invoice, profile, {
      notify: true,
      notificationTitle: `"${m.title}" completed — ${drafted.invoice.number} ${outcomeVerb(drafted.created)}`,
    });
    return { notified: true, invoiceId: drafted.invoice.id, action: outcome.action, paymentTermId: m.paymentTermId };
  }
  if (!drafted && !done.notified) {
    // No contract behind the job: remind the company which payment is due.
    await createNotification({
      userId: run.userId,
      type: "milestone_payment_due",
      title: `"${m.title}" completed — ${cad(m.paymentAmountCents)} now due`,
      body: `${project?.name ?? "Job"}: payment "${m.paymentTermLabel ?? ""}" is released by this milestone. Create the invoice from the job's Invoices tab.`,
      link: `/dashboard/jobs/${m.projectId}?tab=invoices`,
      entityType: "milestone",
      entityId: m.id,
    });
  }
  return { notified: true, invoiceId: drafted?.invoice.id ?? null, paymentTermId: m.paymentTermId };
});

function outcomeVerb(created: boolean): string {
  return created ? "ready" : "already drafted";
}

// job.completed → final invoice for the unbilled balance (contract + change
// orders − invoiced) and, when the contract carries a statutory holdback, the
// release invoice scheduled for the end of the lien period.
registerAutomation("job.completed", async (run) => {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, run.entityId));
  if (!project) throw new Error(`Project ${run.entityId} not found`);
  if (project.status !== "completed") return { skipped: "not completed" };
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, run.userId));
  const done = (run.result ?? {}) as { finalNotified?: boolean; releaseNotified?: boolean };
  const result: Record<string, unknown> = { ok: true, totalValueCents: project.contractValueCents + project.changeOrdersCents };

  try {
    const fin = await draftFinalInvoice({ project });
    if (fin) {
      result.finalInvoiceId = fin.invoice.id;
      if (fin.created || !done.finalNotified) {
        const o = await applyAutoSendPolicy(fin.invoice, profile, { notify: true, notificationTitle: `"${project.name}" completed — final invoice ${fin.invoice.number} ${fin.created ? "ready" : "pending"}` });
        result.finalAction = o.action;
      }
      result.finalNotified = true;
    }
  } catch (err) {
    logger.error({ err, projectId: project.id }, "Final invoice drafting failed");
    throw err;
  }

  // The release sums the holdback withheld on every invoice, so it is drafted after the final one.
  const rel = await draftHoldbackReleaseInvoice({ project });
  if (rel) {
    result.holdbackReleaseInvoiceId = rel.invoice.id;
    if (rel.created || !done.releaseNotified) {
      const o = await applyAutoSendPolicy(rel.invoice, profile, { notify: true, notificationTitle: `Holdback release ${rel.invoice.number} scheduled` });
      result.releaseAction = o.action;
    }
    result.releaseNotified = true;
  }
  return result;
});

// invoice.overdue → one in-app notification per invoice (the reminder
// emails to the customer are sent by the cron maintenance).
registerAutomation("invoice.overdue", async (run) => {
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, run.entityId));
  if (!inv) throw new Error(`Invoice ${run.entityId} not found`);
  if (inv.status !== "overdue") return { skipped: inv.status };
  await createNotification({
    userId: inv.userId,
    type: "invoice_overdue",
    title: `Invoice ${inv.number} is overdue`,
    body: `${inv.customer.name || "Customer"} owes ${cad(inv.totalCents - inv.paidCents)} (due ${inv.dueDate.toLocaleDateString("en-CA", { dateStyle: "medium" })}). Reminders go out automatically after 3, 7 and 14 days.`,
    link: `/dashboard/invoices/${inv.id}`,
    entityType: "invoice",
    entityId: inv.id,
  });
  return { notified: true };
});
