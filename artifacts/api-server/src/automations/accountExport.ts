import { registerAutomation } from "../lib/automation.js";
import { buildAccountExport } from "../account/service.js";

// Phase 72: "Export my data". Raised by POST /api/account/export with the
// account_exports row id as the entity; runs inline in that request and is
// retried by the cron tick if the build, upload or email fails. Idempotent:
// a row already marked ready is returned as-is.
registerAutomation("account.export_requested", async (run) => {
  return await buildAccountExport(run.entityId);
});
