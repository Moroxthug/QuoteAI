// Phase 77 — seeds a "field mode" showcase for the walkthrough server and
// prints what the Browser pane needs: an Elite org with an active job and a
// worker, the worker's /t link, and a signed session cookie for the dashboard
// (no sign-up/verification round trip). Shares the database with the running
// walkthrough server (E2E_NO_PURGE), and is cleaned up by walkthrough-cleanup.
//
//   pnpm --filter @workspace/api-server walkthrough              # API on :5000
//   WALKTHROUGH_FRONTEND=http://localhost:5199 pnpm --filter @workspace/api-server walkthrough:seed
//
// Then in the browser at the frontend origin: document.cookie = <printed line>.

import { resolve } from "node:path";
import { bootstrapQaEnv } from "./qaEnv.js";

process.env.E2E_NO_PURGE = "1";
process.env.LOG_LEVEL ??= "warn";
bootstrapQaEnv("walkthrough");
const FRONTEND = process.env.WALKTHROUGH_FRONTEND ?? "http://localhost:5183";
process.env.QUOTEAI_BASE_URL = FRONTEND;
process.env.BETTER_AUTH_URL = FRONTEND;

// The db module reads DATABASE_URL at import time — after bootstrapQaEnv.
const { db, projectsTable, milestonesTable } = await import("@workspace/db");
const { makeSignature } = await import("better-auth/crypto");
const { startServer, stopServer, createOrg } = await import("./harness.js");

await startServer();
const org = await createOrg({ plan: "monthly_elite", province: "ON", companyName: "Field Mode Contracting" });
const [job] = await db.insert(projectsTable).values({ userId: org.userId, name: "Basement finish — 12 Elm St", status: "active", setupStatus: "confirmed", setupConfirmedAt: new Date(), address: "12 Elm St, Ottawa", latitude: "45.423600", longitude: "-75.700900", geofenceRadiusMeters: 300, contractValueCents: 2_450_000 }).returning();
await db.insert(milestonesTable).values([
  { userId: org.userId, projectId: job!.id, key: "framing", title: "Framing", sortOrder: 0, status: "completed", valueCents: 800_000 },
  { userId: org.userId, projectId: job!.id, key: "drywall", title: "Drywall + taping", sortOrder: 1, status: "in_progress", valueCents: 900_000 },
  { userId: org.userId, projectId: job!.id, key: "finish", title: "Trim + paint", sortOrder: 2, status: "planned", valueCents: 750_000 },
]);
const worker = await org.api("/api/team/workers", { body: { name: "Sam Tremblay", email: `sam-${org.userId.slice(-6)}@example.invalid`, hourlyRateCents: 3800 } });
if (worker.status !== 201) throw new Error(`worker: ${worker.status} ${JSON.stringify(worker.body)}`);
const invite = await org.api(`/api/team/workers/${worker.body.worker.id}/invite`, { body: {} });
if (invite.status !== 200) throw new Error(`invite: ${invite.status} ${JSON.stringify(invite.body)}`);
await org.api(`/api/jobs/${job!.id}/assignments`, { body: { workerId: worker.body.worker.id } });

const cookieValue = `${org.token}.${await makeSignature(org.token, process.env.BETTER_AUTH_SECRET!)}`;
console.log("\n[seed] org:", org.userId, org.email);
console.log("[seed] job:", job!.id, `${FRONTEND}/dashboard/jobs/${job!.id}`);
console.log("[seed] worker page:", invite.body.url);
console.log(`[seed] cookie (run in the browser console at ${FRONTEND}):`);
console.log(`document.cookie = "better-auth.session_token=${encodeURIComponent(cookieValue)}; path=/; max-age=86400"`);
console.log(`[seed] mailbox → ${resolve(import.meta.dirname, "../../.walkthrough-mailbox.json")}`);
await stopServer();
process.exit(0);
