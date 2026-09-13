import { db, milestonesTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { createNotification } from "../lib/notifications.js";

const cad = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);

// milestone.completed → Phase 4 will draft the progress invoice here. Until
// then the company is reminded which payment term the milestone released.
registerAutomation("milestone.completed", async (run) => {
  const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, run.entityId));
  if (!m) throw new Error(`Milestone ${run.entityId} not found`);
  if (m.status !== "completed") return { skipped: "not completed" };
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, m.projectId));
  const done = (run.result ?? {}) as { notified?: boolean };
  if (!done.notified && m.paymentTermId && m.paymentAmountCents) {
    await createNotification({
      userId: run.userId,
      type: "milestone_payment_due",
      title: `"${m.title}" completed — ${cad(m.paymentAmountCents)} now due`,
      body: `${project?.name ?? "Job"}: payment "${m.paymentTermLabel ?? ""}" is released by this milestone. Send the customer the progress invoice.`,
      link: `/dashboard/jobs/${m.projectId}?tab=schedule`,
      entityType: "milestone",
      entityId: m.id,
    });
  }
  return { notified: true, paymentTermId: m.paymentTermId, paymentAmountCents: m.paymentAmountCents };
});

registerAutomation("job.completed", async (run) => {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, run.entityId));
  if (!project) throw new Error(`Project ${run.entityId} not found`);
  if (project.status !== "completed") return { skipped: "not completed" };
  return { ok: true, totalValueCents: project.contractValueCents + project.changeOrdersCents };
});
