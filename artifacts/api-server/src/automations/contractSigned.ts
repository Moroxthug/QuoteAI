import { registerAutomation } from "../lib/automation.js";
import { createNotification } from "../lib/notifications.js";
import { loadContract } from "../contracts/service.js";

// contract.signed → (Phase 2) create the job site, milestones, deposit invoice.
// For now the notification + emails are sent by finalizeContract itself; this
// handler exists so the run is recorded and Phase 2 can hook in.
registerAutomation("contract.signed", async (run) => {
  const loaded = await loadContract(run.entityId);
  if (!loaded) throw new Error(`Contract ${run.entityId} not found`);
  if (loaded.contract.status !== "signed") return { skipped: "not signed" };
  return { ok: true, contractNumber: loaded.contract.contractNumber };
});

registerAutomation("contract.declined", async (run) => {
  const loaded = await loadContract(run.entityId);
  if (!loaded) throw new Error(`Contract ${run.entityId} not found`);
  const done = (run.result ?? {}) as { notified?: boolean };
  if (!done.notified) {
    const reason = typeof run.payload.reason === "string" ? run.payload.reason : "";
    await createNotification({
      userId: loaded.contract.userId,
      type: "contract_declined",
      title: `${loaded.contract.variables.customer.name} declined contract ${loaded.contract.contractNumber}`,
      body: reason ? `Reason: ${reason}` : "No reason given. You can edit and resend a new version.",
      link: `/dashboard/contracts/${loaded.contract.id}`,
      entityType: "contract",
      entityId: loaded.contract.id,
    });
  }
  return { notified: true };
});
