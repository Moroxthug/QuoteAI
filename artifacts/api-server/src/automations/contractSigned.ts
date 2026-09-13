import { db, projectsTable, milestonesTable, businessProfilesTable, paymentTermAmount } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { createNotification } from "../lib/notifications.js";
import { logger } from "../lib/logger.js";
import { loadContract } from "../contracts/service.js";
import { setupJobFromContract } from "../jobs/setup.js";
import { applySignedChangeOrder } from "../jobs/changeOrders.js";
import { draftDepositInvoice, applyAutoSendPolicy } from "../invoices/service.js";

const cad = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
const longDate = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null);

// contract.signed → Phase 2: set up the job (milestones imported from the
// quote + payment schedule, proposed schedule, cost budget) and send ONE
// notification that lands on the review screen. Change-order documents are
// applied to their job instead. finalizeContract already emailed the signed
// PDF to both parties before raising this event.
registerAutomation("contract.signed", async (run) => {
  const loaded = await loadContract(run.entityId);
  if (!loaded) throw new Error(`Contract ${run.entityId} not found`);
  const { contract } = loaded;
  if (contract.status !== "signed") return { skipped: "not signed" };

  if (contract.kind === "change_order") {
    const res = await applySignedChangeOrder(contract);
    return { ok: true, kind: "change_order", ...res };
  }

  const customer = contract.variables.customer.name || "The customer";
  try {
    const setup = await setupJobFromContract(contract);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, setup.projectId));
    const milestones = await db.select().from(milestonesTable).where(eq(milestonesTable.projectId, setup.projectId));
    const deposit = contract.variables.paymentSchedule.terms.find((t) => t.trigger === "on_signing");
    const endText = setup.plannedEnd ? ` and a schedule ending ${longDate(setup.plannedEnd)}` : "";

    // Phase 4: the deposit invoice is drafted (or sent, per the company's
    // setting) right away and folded into the same single notification.
    let depositText = deposit ? ` and a ${cad(paymentTermAmount(deposit, contract.variables.total))} deposit due now` : "";
    let depositInvoiceId: string | null = null;
    let depositAction: string | null = null;
    if (deposit) {
      try {
        const drafted = await draftDepositInvoice({ contract, projectId: setup.projectId });
        if (drafted) {
          depositInvoiceId = drafted.invoice.id;
          const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, contract.userId));
          const outcome = await applyAutoSendPolicy(drafted.invoice, profile, { notify: false });
          depositAction = outcome.action;
          depositText =
            outcome.action === "sent" ? ` and deposit invoice ${drafted.invoice.number} (${cad(drafted.invoice.totalCents / 100)}) was sent to ${customer}`
            : outcome.action === "scheduled_auto_send" ? ` and deposit invoice ${drafted.invoice.number} (${cad(drafted.invoice.totalCents / 100)}) will go out automatically unless you edit it first`
            : ` and deposit invoice ${drafted.invoice.number} (${cad(drafted.invoice.totalCents / 100)}) is ready to send`;
        }
      } catch (err) {
        // The job setup is what matters here; the deposit can be created from the Invoices tab.
        logger.error({ err, contractId: contract.id }, "Deposit invoice drafting failed");
      }
    }

    await createNotification({
      userId: contract.userId,
      type: "job_setup_ready",
      title: `${customer} signed ${contract.contractNumber} — job set up`,
      body: `We set up "${project?.name ?? contract.variables.projectTitle}" with ${milestones.length} milestones${endText}${depositText}. Review the setup to start the job.`,
      link: `/dashboard/jobs/${setup.projectId}/setup`,
      entityType: "project",
      entityId: setup.projectId,
    });
    return { ok: true, kind: "agreement", projectId: setup.projectId, milestones: milestones.length, created: setup.created, depositInvoiceId, depositAction };
  } catch (err) {
    // The signature itself is already final; tell the company now and let
    // the cron retry the job setup (the handler is idempotent).
    logger.error({ err, contractId: contract.id }, "Job setup after signing failed");
    const done = (run.result ?? {}) as { fallbackNotified?: boolean };
    if (!done.fallbackNotified && run.attempts <= 1) {
      await createNotification({
        userId: contract.userId,
        type: "contract_signed",
        title: `${customer} signed contract ${contract.contractNumber}`,
        body: `Contract value ${cad(contract.variables.total)}. Signed copy sent to both parties. We'll finish setting up the job shortly.`,
        link: `/dashboard/contracts/${contract.id}`,
        entityType: "contract",
        entityId: contract.id,
      });
    }
    throw err;
  }
});

registerAutomation("contract.declined", async (run) => {
  const loaded = await loadContract(run.entityId);
  if (!loaded) throw new Error(`Contract ${run.entityId} not found`);
  const done = (run.result ?? {}) as { notified?: boolean };
  if (!done.notified) {
    const reason = typeof run.payload.reason === "string" ? run.payload.reason : "";
    const isCo = loaded.contract.kind === "change_order";
    await createNotification({
      userId: loaded.contract.userId,
      type: "contract_declined",
      title: `${loaded.contract.variables.customer.name} declined ${isCo ? "change order" : "contract"} ${loaded.contract.contractNumber}`,
      body: reason ? `Reason: ${reason}` : "No reason given. You can edit and resend a new version.",
      link: isCo && loaded.contract.projectId ? `/dashboard/jobs/${loaded.contract.projectId}?tab=changes` : `/dashboard/contracts/${loaded.contract.id}`,
      entityType: "contract",
      entityId: loaded.contract.id,
    });
  }
  return { notified: true };
});
