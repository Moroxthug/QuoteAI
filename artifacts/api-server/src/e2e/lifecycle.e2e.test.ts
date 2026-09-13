// Phase 6 — end-to-end lifecycle test.
//
// Exercises the full chain: quote accepted -> contract auto-drafted ->
// contractor signs -> customer signs -> job set up -> setup confirmed ->
// cost entry -> milestone completed -> progress invoice drafted -> sent ->
// paid -> job completed -> final invoice drafted. Runs it twice: once for
// Ontario in English, once for Quebec in French (holdback on for ON).
//
// WHAT THIS DOES AND DOES NOT COVER
// - It drives the same service-layer functions the real routes call
//   (createContractFromQuote via the quote.accepted automation,
//   finalizeContract, setupJobFromContract via contract.signed,
//   draftMilestoneInvoice/draftFinalInvoice via milestone.completed /
//   job.completed, sendInvoice, recordPayment) — this is the business logic
//   that matters (tax math, contract templates, job planning, invoice math,
//   holdback, automations).
// - For the two steps that are public, token-addressed HTTP endpoints
//   (POST /api/sign/:token/otp and /complete), it writes the same rows those
//   routes write directly instead of resolving a real emailed token/OTP —
//   the transport layer (token hashing, OTP throttling, rate limits) is
//   covered separately by the security audit, not by this test. If
//   routes/sign.ts's signing logic changes, update the block marked
//   "mirrors POST /api/sign/:token/complete" below to match.
// - Job setup-confirm and milestone-status-update also mirror small,
//   specific route bodies (routes/jobs.ts) rather than calling an exported
//   service, because that logic isn't factored out yet. Each spot says
//   which route it mirrors.
//
// REQUIREMENTS TO RUN
//   DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY must point at a
//   DISPOSABLE / STAGING project — this test creates a real auth user,
//   quote, contract, job, invoices and storage objects, and does not assume
//   it can clean up storage. NEVER point this at the production `quoteai`
//   Supabase project.
//
//   cd artifacts/api-server
//   DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     ../../scripts/node_modules/.bin/tsx src/e2e/lifecycle.e2e.test.ts
//
// AI calls (contract scope/schedule draft, job plan refinement) are safe to
// leave unconfigured — every AI call path has a deterministic fallback on
// error (see contracts/service.ts draftWithAi, jobs/setup.ts refineWithAi).
// RESEND_API_KEY is safe to leave unset — every email path no-ops with a
// warning when it's missing.

import { randomUUID } from "node:crypto";
import {
  db,
  authUsersTable,
  businessProfilesTable,
  quotesTable,
  contractsTable,
  contractSignersTable,
  projectsTable,
  milestonesTable,
  costEntriesTable,
  invoicesTable,
  automationRunsTable,
} from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import "../automations/index.js"; // registers automation handlers
import { raiseAutomation } from "../lib/automation.js";
import { logContractEvent, finalizeContract } from "../contracts/service.js";
import { sendInvoice, recordPayment } from "../invoices/service.js";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function raiseAndExpectSuccess(params: Parameters<typeof raiseAutomation>[0]) {
  const run = await raiseAutomation(params);
  if (!run) return; // already recorded (idempotent) — treated as success
  const [row] = await db.select().from(automationRunsTable).where(eq(automationRunsTable.id, run.id));
  assert(row?.status === "succeeded", `automation ${params.event} did not succeed: ${row?.status} ${row?.lastError ?? ""}`);
  return row;
}

type Scenario = {
  label: string;
  province: "ON" | "QC";
  language: "en" | "fr";
  holdback: boolean;
};

const SCENARIOS: Scenario[] = [
  { label: "Ontario / English", province: "ON", language: "en", holdback: true },
  { label: "Quebec / French", province: "QC", language: "fr", holdback: false },
];

async function runScenario(s: Scenario) {
  console.log(`\n=== ${s.label} ===`);
  const userId = `e2e_${randomUUID()}`;
  const email = `e2e-${randomUUID()}@example.invalid`;

  try {
    // ── Fixtures: user + business profile ────────────────────────────────
    await db.insert(authUsersTable).values({ id: userId, name: "E2E Test Co", email });
    await db.insert(businessProfilesTable).values({
      userId,
      companyName: "E2E Test Co",
      province: s.province,
      gstHstNumber: "123456789RT0001",
      qstNumber: s.province === "QC" ? "1234567890TQ0001" : null,
      licenceNumber: s.province === "QC" ? "RBQ 1234-5678-01" : "LIC-0001",
      etransferEmail: "payments@e2e-test.invalid",
      email: "owner@e2e-test.invalid",
      // Feature-flag override bypasses needing a real Stripe subscription.
      featureFlags: { contracts: true, jobs: true, costs: true, invoicing: true, team_time: true, analytics_pro: true },
      automationSettings: { notifyOnQuoteAccepted: true, autoDraftContract: true, autoSendInvoices: false, invoiceAutoSendAfterHours: 0, invoiceReminders: true },
    });
    console.log("✓ business profile created");

    // ── Quote (seeded directly — AI quote generation is out of scope here
    //    and separately unit-tested) ─────────────────────────────────────
    const [quote] = await db
      .insert(quotesTable)
      .values({
        userId,
        province: s.province,
        clientData: {
          nome: "Jordan Client",
          indirizzo: "456 Client Ave",
          city: s.province === "QC" ? "Montréal" : "Ottawa",
          province: s.province,
          postalCode: "K1A 0B1",
          email: "client@e2e-test.invalid",
          phone: "6135550100",
        },
        descrizioneGenerale: "Kitchen renovation",
        capitoli: [
          {
            lettera: "A",
            titolo: "Demolition and prep",
            subtotale: 4000,
            voci: [{ descrizione: "Demo existing cabinets", quantita: 1, um: "lot", prezzoUnitario: 4000, totale: 4000 }],
          },
          {
            lettera: "B",
            titolo: "Cabinets and countertops",
            subtotale: 6000,
            voci: [{ descrizione: "Install cabinets and counters", quantita: 1, um: "lot", prezzoUnitario: 6000, totale: 6000 }],
          },
        ],
        condizioniPagamento: ["30% deposit upon signing", "40% at start of work", "30% upon completion"],
        paymentSchedule: {
          currency: "CAD",
          derived: false,
          holdback: { enabled: s.holdback, percent: 10 },
          terms: [
            { id: "t1", type: "deposit", label: "Deposit", trigger: "on_signing", amountType: "percent", value: 30, dueDays: 0 },
            { id: "t2", type: "milestone", label: "Start of work", trigger: "milestone", amountType: "percent", value: 40, dueDays: 15 },
            { id: "t3", type: "completion", label: "Final balance", trigger: "on_completion", amountType: "percent", value: 30, dueDays: 15 },
          ],
        },
        subtotale: "10000",
        ivaPercentuale: "0", // forces buildVariablesFromQuote to use the real province tax profile
        totale: "10000",
        status: "unlocked",
      })
      .returning();
    console.log(`✓ quote seeded (${quote!.id})`);

    // ── Accept (mirrors POST /api/public/quotes/:id/accept) ─────────────
    await db.update(quotesTable).set({ status: "accepted", acceptedAt: new Date(), acceptedByName: "Jordan Client" }).where(eq(quotesTable.id, quote!.id));
    await raiseAndExpectSuccess({ event: "quote.accepted", userId, entityType: "quote", entityId: quote!.id, payload: { acceptedByName: "Jordan Client" } });

    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.quoteId, quote!.id));
    assert(contract, "contract was not auto-drafted on quote.accepted");
    assert(contract.province === s.province, "contract province mismatch");
    assert(contract.language === s.language, `expected language ${s.language}, got ${contract.language}`);
    console.log(`✓ contract auto-drafted (${contract.contractNumber}), total $${contract.variables.total}`);

    // ── Contractor signs (mirrors POST /api/contracts/:id/sign) ─────────
    const signers = await db.select().from(contractSignersTable).where(eq(contractSignersTable.contractId, contract.id));
    const contractorSigner = signers.find((x) => x.role === "contractor")!;
    const customerSigner = signers.find((x) => x.role === "customer")!;
    assert(contractorSigner && customerSigner, "expected two signer rows");

    await db.update(contractSignersTable).set({
      status: "signed", name: "E2E Test Co", signatureType: "typed", signatureData: "E2E Test Co",
      consentText: "test consent", signedAt: new Date(),
    }).where(eq(contractSignersTable.id, contractorSigner.id));
    await logContractEvent({ contractId: contract.id, type: "contractor_signed", actor: "contractor", signerId: contractorSigner.id });

    // ── Customer signs (mirrors POST /api/sign/:token/complete — see file
    //    header note on why this bypasses the token/OTP transport) ───────
    await db.update(contractSignersTable).set({
      status: "signed", name: "Jordan Client", signatureType: "drawn", signatureData: "data:image/png;base64,iVBORw0KGgo=",
      consentText: "test consent", signedAt: new Date(),
    }).where(eq(contractSignersTable.id, customerSigner.id));
    await logContractEvent({ contractId: contract.id, type: "signed", actor: "customer", signerId: customerSigner.id });

    await finalizeContract(contract.id);
    const [signedContract] = await db.select().from(contractsTable).where(eq(contractsTable.id, contract.id));
    assert(signedContract!.status === "signed", `expected contract signed, got ${signedContract!.status}`);
    assert(signedContract!.signedPdfUrl, "signed PDF was not stored");
    console.log("✓ both parties signed, signed PDF stored, contract.signed automation ran");

    // ── Job was set up by the contract.signed automation ─────────────────
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.contractId, contract.id));
    assert(project, "job was not created by contract.signed");
    const milestones = await db.select().from(milestonesTable).where(eq(milestonesTable.projectId, project.id));
    assert(milestones.length >= 2, `expected at least 2 milestones, got ${milestones.length}`);
    console.log(`✓ job "${project.name}" set up with ${milestones.length} milestones`);

    const depositInvoice = (await db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, project.id), eq(invoicesTable.type, "deposit"))))[0];
    assert(depositInvoice, "deposit invoice was not drafted on contract.signed");
    console.log(`✓ deposit invoice ${depositInvoice.number} drafted for $${(depositInvoice.totalCents / 100).toFixed(2)}`);

    // ── Confirm setup (mirrors POST /api/jobs/:id/setup/confirm) ────────
    await db.update(projectsTable).set({ setupStatus: "confirmed", setupConfirmedAt: new Date(), status: "active" }).where(eq(projectsTable.id, project.id));
    console.log("✓ job setup confirmed, job active");

    // ── Cost entry (mirrors POST /api/jobs/:id/costs, manual entry) ─────
    await db.insert(costEntriesTable).values({
      userId, projectId: project.id, category: "materials", vendor: "ACME Supply",
      description: "Cabinet hardware", subtotalCents: 50000, taxCents: 0, totalCents: 50000,
      status: "confirmed", source: "manual", createdBy: "user", confirmedAt: new Date(),
    });
    console.log("✓ cost entry confirmed");

    // ── Complete the milestone that releases the "milestone" payment term
    //    (mirrors PUT /api/jobs/:id/milestones/:mid) ─────────────────────
    const releaseMilestone = milestones.find((m) => m.paymentTermId && m.paymentAmountCents);
    assert(releaseMilestone, "no milestone was linked to a payment term by the job planner");
    await db.update(milestonesTable).set({ status: "completed", actualStart: new Date(), actualEnd: new Date() }).where(eq(milestonesTable.id, releaseMilestone!.id));
    await raiseAndExpectSuccess({ event: "milestone.completed", userId, entityType: "milestone", entityId: releaseMilestone!.id, payload: { projectId: project.id } });

    const progressInvoice = (await db.select().from(invoicesTable).where(eq(invoicesTable.paymentTermId, releaseMilestone!.paymentTermId!)))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    assert(progressInvoice, "progress invoice was not drafted on milestone.completed");
    console.log(`✓ milestone "${releaseMilestone!.title}" completed, invoice ${progressInvoice.number} drafted ($${(progressInvoice.totalCents / 100).toFixed(2)})`);

    // ── Send + pay the progress invoice ──────────────────────────────────
    const { invoice: sent } = await sendInvoice({ invoiceId: progressInvoice.id, userId, actor: "contractor" });
    assert(sent.status === "sent", `expected invoice sent, got ${sent.status}`);
    assert(sent.pdfUrl, "invoice PDF was not stored");
    const { invoice: paid } = await recordPayment({ invoiceId: sent.id, userId, amountCents: sent.totalCents, method: "etransfer" });
    assert(paid.status === "paid", `expected invoice paid, got ${paid.status}`);
    console.log(`✓ invoice ${paid.number} sent and paid in full via e-Transfer`);

    // ── Complete the job (mirrors PUT /api/jobs/:id with status: completed) ─
    await db.update(projectsTable).set({ status: "completed", completedAt: new Date() }).where(eq(projectsTable.id, project.id));
    await raiseAndExpectSuccess({ event: "job.completed", userId, entityType: "project", entityId: project.id });

    const finalInvoice = (await db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, project.id), eq(invoicesTable.type, "final"))))[0];
    assert(finalInvoice, "final invoice was not drafted on job.completed");
    console.log(`✓ job completed, final invoice ${finalInvoice.number} drafted for $${(finalInvoice.totalCents / 100).toFixed(2)}`);

    if (s.holdback) {
      const release = (await db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, project.id), eq(invoicesTable.type, "holdback_release"))))[0];
      assert(release, "holdback was enabled but no release invoice was scheduled");
      assert(release.scheduledFor, "holdback release invoice has no scheduled date");
      console.log(`✓ holdback release invoice ${release.number} scheduled for ${release.scheduledFor?.toDateString()}`);
    }

    console.log(`=== ${s.label}: PASSED ===`);
  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.userId, userId));
    if (project) {
      await db.delete(invoicesTable).where(eq(invoicesTable.projectId, project.id));
      await db.delete(costEntriesTable).where(eq(costEntriesTable.projectId, project.id));
      await db.delete(milestonesTable).where(eq(milestonesTable.projectId, project.id));
      await db.delete(projectsTable).where(eq(projectsTable.id, project.id));
    }
    await db.delete(automationRunsTable).where(eq(automationRunsTable.userId, userId));
    const contracts = await db.select().from(contractsTable).where(eq(contractsTable.userId, userId));
    for (const c of contracts) {
      await db.delete(contractSignersTable).where(eq(contractSignersTable.contractId, c.id));
    }
    await db.delete(contractsTable).where(eq(contractsTable.userId, userId));
    await db.delete(quotesTable).where(eq(quotesTable.userId, userId));
    await db.delete(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    await db.delete(authUsersTable).where(eq(authUsersTable.id, userId));
    console.log(`(cleaned up fixtures for ${userId})`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — refusing to run (see file header for requirements).");
    process.exit(1);
  }
  for (const s of SCENARIOS) {
    await runScenario(s);
  }
  console.log("\nAll lifecycle scenarios passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nLIFECYCLE E2E TEST FAILED:", err);
  process.exit(1);
});
