// Phase 19: registers a handler for every automation event that fans the
// event out to the company's registered webhook endpoints. Runs alongside
// each event's existing domain handler (registerAutomation now supports
// multiple handlers per event — see lib/automation.ts).
import { AUTOMATION_EVENTS } from "@workspace/db";
import { registerAutomation } from "../lib/automation.js";
import { dispatchWebhooks } from "../lib/webhooks.js";

for (const event of AUTOMATION_EVENTS) {
  registerAutomation(event, async (run) => {
    await dispatchWebhooks(run.userId, event, run.entityId, run.payload ?? {});
  });
}
