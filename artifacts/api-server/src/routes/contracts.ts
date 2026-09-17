import { Router } from "express";
import { z } from "zod";
import { db, contractsTable, contractSignersTable, businessProfilesTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireAuth, getUserId, getUserName } from "../middlewares/authMiddleware.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import {
  createContractFromQuote,
  loadContract,
  applyVariableEdits,
  sendContractToCustomer,
  contractPdfBuffer,
  logContractEvent,
  finalizeContract,
} from "../contracts/service.js";
import { renderContractHtml, CONTRACT_CSS } from "../contracts/render.js";
import { writeAudit } from "../lib/notifications.js";

const router = Router();
const aiLimiter = userRateLimiter({ windowMs: 60_000, max: 10, message: "Too many contract drafts, try again in a minute." });

async function requireContractsFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "contracts")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("contracts") };
}

function serializeContract(c: typeof contractsTable.$inferSelect, signers: (typeof contractSignersTable.$inferSelect)[] = [], events: { id: string; type: string; actor: string; createdAt: Date; detail: unknown }[] = []) {
  return {
    id: c.id,
    quoteId: c.quoteId,
    clientId: c.clientId,
    projectId: c.projectId,
    kind: c.kind,
    parentContractId: c.parentContractId,
    changeOrderId: c.changeOrderId,
    contractNumber: c.contractNumber,
    status: c.status,
    province: c.province,
    language: c.language,
    templateKey: c.templateKey,
    document: c.document,
    variables: c.variables,
    contractValueCents: c.contractValueCents,
    holdbackEnabled: c.holdbackEnabled,
    holdbackPercent: c.holdbackPercent,
    hasSignedPdf: !!c.signedPdfUrl,
    signedPdfHash: c.signedPdfHash,
    unsignedPdfHash: c.unsignedPdfHash,
    sentAt: c.sentAt?.toISOString() ?? null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    signedAt: c.signedAt?.toISOString() ?? null,
    voidedAt: c.voidedAt?.toISOString() ?? null,
    voidReason: c.voidReason,
    reminderCount: c.reminderCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    archivedAt: c.archivedAt?.toISOString() ?? null,
    signers: signers.map((s) => ({
      id: s.id,
      role: s.role,
      name: s.name,
      email: s.email,
      status: s.status,
      signatureType: s.signatureType,
      signedAt: s.signedAt?.toISOString() ?? null,
      viewedAt: s.viewedAt?.toISOString() ?? null,
      declinedAt: s.declinedAt?.toISOString() ?? null,
      declineReason: s.declineReason,
    })),
    events: events.map((e) => ({ id: e.id, type: e.type, actor: e.actor, detail: e.detail, createdAt: e.createdAt.toISOString() })),
  };
}

// GET /api/contracts — list (newest first)
router.get("/contracts", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db.select().from(contractsTable).where(and(eq(contractsTable.userId, userId), isNull(contractsTable.archivedAt))).orderBy(desc(contractsTable.createdAt)).limit(200);
    res.json({ items: rows.map((c) => serializeContract(c)) });
  } catch (err) {
    req.log.error({ err }, "Error listing contracts");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/contracts/:id/archive
router.post("/contracts/:id/archive", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [existing] = await db.select().from(contractsTable).where(eq(contractsTable.id, req.params.id as string));
    if (!existing || existing.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    const [updated] = await db
      .update(contractsTable)
      .set({ archivedAt: new Date(), archivedByName: getUserName(res) })
      .where(eq(contractsTable.id, existing.id))
      .returning();
    res.json(serializeContract(updated));
  } catch (err) {
    req.log.error({ err }, "Error archiving contract");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/contracts/:id/restore
router.post("/contracts/:id/restore", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [existing] = await db.select().from(contractsTable).where(eq(contractsTable.id, req.params.id as string));
    if (!existing || existing.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    const [updated] = await db
      .update(contractsTable)
      .set({ archivedAt: null, archivedByName: null })
      .where(eq(contractsTable.id, existing.id))
      .returning();
    res.json(serializeContract(updated));
  } catch (err) {
    req.log.error({ err }, "Error restoring contract");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/contracts/by-quote/:quoteId — the active contract for a quote (or null)
router.get("/contracts/by-quote/:quoteId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db
      .select()
      .from(contractsTable)
      .where(and(eq(contractsTable.userId, userId), eq(contractsTable.quoteId, req.params.quoteId as string)))
      .orderBy(desc(contractsTable.createdAt));
    const active = rows.find((c) => !["voided", "declined", "expired"].includes(c.status)) ?? rows[0] ?? null;
    res.json({ contract: active ? serializeContract(active) : null });
  } catch (err) {
    req.log.error({ err }, "Error fetching contract by quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/contracts/from-quote/:quoteId — draft (AI) a contract from an accepted/unlocked quote
router.post("/contracts/from-quote/:quoteId", requireAuth, aiLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireContractsFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Contracts require the Pro plan" });
      return;
    }
    const body = z.object({ language: z.enum(["en", "fr"]).optional(), province: z.string().optional() }).safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const { contract, created } = await createContractFromQuote({ userId, quoteId: req.params.quoteId as string, language: body.data.language, province: body.data.province, actor: "contractor" });
    const loaded = await loadContract(contract.id);
    res.status(created ? 201 : 200).json({ contract: serializeContract(contract, loaded?.signers, loaded?.events), created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (message === "Quote not found") {
      res.status(404).json({ error: message });
      return;
    }
    req.log.error({ err }, "Error creating contract from quote");
    res.status(500).json({ error: "Could not draft the contract" });
  }
});

async function ownedContract(userId: string, id: string) {
  const loaded = await loadContract(id);
  if (!loaded || loaded.contract.userId !== userId) return null;
  return loaded;
}

// GET /api/contracts/:id
router.get("/contracts/:id", requireAuth, async (req, res) => {
  try {
    const loaded = await ownedContract(getUserId(res), req.params.id as string);
    if (!loaded) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      contract: serializeContract(loaded.contract, loaded.signers, loaded.events),
      html: renderContractHtml({ document: loaded.contract.document, variables: loaded.contract.variables, signers: loaded.signers, status: loaded.contract.status, createdAt: loaded.contract.createdAt }),
      css: CONTRACT_CSS,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching contract");
    res.status(500).json({ error: "Internal server error" });
  }
});

const UpdateContractBody = z.object({
  sections: z.array(z.object({ key: z.string(), body: z.string().max(20000) })).optional(),
  variables: z
    .object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      estimatedDurationWeeks: z.number().int().min(1).max(260).nullable().optional(),
      warrantyMonths: z.number().int().min(0).max(120).optional(),
      directAgreement: z.boolean().optional(),
      englishRequestedInQuebec: z.boolean().optional(),
      holdbackEnabled: z.boolean().optional(),
      holdbackPercent: z.number().min(0).max(50).optional(),
      customerEmail: z.string().email().optional(),
      customerName: z.string().min(1).max(200).optional(),
    })
    .optional(),
});

// PUT /api/contracts/:id — edit editable sections and variables (draft only)
router.put("/contracts/:id", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const loaded = await ownedContract(userId, req.params.id as string);
    if (!loaded) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (loaded.contract.status !== "draft") {
      res.status(409).json({ error: "LOCKED", message: "Only draft contracts can be edited. Void it and draft a new one to make changes." });
      return;
    }
    const parsed = UpdateContractBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }

    let { variables, document } = applyVariableEdits(loaded.contract, parsed.data.variables ?? {});
    if (parsed.data.sections) {
      const editableKeys = new Set(document.sections.filter((s) => s.editable).map((s) => s.key));
      for (const edit of parsed.data.sections) {
        if (!editableKeys.has(edit.key)) {
          res.status(400).json({ error: `Section "${edit.key}" is not editable` });
          return;
        }
      }
      document = { ...document, sections: document.sections.map((s) => { const e = parsed.data.sections!.find((x) => x.key === s.key); return e ? { ...s, body: e.body } : s; }) };
    }

    // Any edit invalidates a contractor signature made on the previous text.
    const contractorSigner = loaded.signers.find((s) => s.role === "contractor");
    if (contractorSigner?.status === "signed") {
      await db.update(contractSignersTable).set({ status: "pending", signedAt: null, signatureData: null, signatureType: null }).where(eq(contractSignersTable.id, contractorSigner.id));
    }
    const customerSigner = loaded.signers.find((s) => s.role === "customer");
    if (customerSigner && parsed.data.variables?.customerEmail) {
      await db.update(contractSignersTable).set({ email: parsed.data.variables.customerEmail, name: variables.customer.name }).where(eq(contractSignersTable.id, customerSigner.id));
    }

    const [updated] = await db
      .update(contractsTable)
      .set({ variables, document, holdbackEnabled: variables.paymentSchedule.holdback.enabled, holdbackPercent: variables.paymentSchedule.holdback.percent, contractValueCents: Math.round(variables.total * 100) })
      .where(eq(contractsTable.id, loaded.contract.id))
      .returning();
    await logContractEvent({ contractId: loaded.contract.id, type: "edited", actor: "contractor", detail: { keys: Object.keys(parsed.data.variables ?? {}), sections: parsed.data.sections?.map((s) => s.key) }, ip: req.ip, userAgent: req.headers["user-agent"] });

    const fresh = await loadContract(loaded.contract.id);
    res.json({
      contract: serializeContract(updated!, fresh?.signers, fresh?.events),
      html: renderContractHtml({ document: updated!.document, variables: updated!.variables, signers: fresh?.signers ?? [], status: updated!.status, createdAt: updated!.createdAt }),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating contract");
    res.status(500).json({ error: "Internal server error" });
  }
});

const SignBody = z.object({
  signatureType: z.enum(["drawn", "typed"]),
  signatureData: z.string().min(1).max(200_000),
  name: z.string().min(2).max(200),
  consent: z.literal(true),
});

// POST /api/contracts/:id/sign — the contractor signs (before sending)
router.post("/contracts/:id/sign", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const loaded = await ownedContract(userId, req.params.id as string);
    if (!loaded) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!["draft", "sent", "viewed"].includes(loaded.contract.status)) {
      res.status(409).json({ error: "LOCKED" });
      return;
    }
    const parsed = SignBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid signature", details: parsed.error });
      return;
    }
    if (parsed.data.signatureType === "drawn" && !parsed.data.signatureData.startsWith("data:image/png;base64,")) {
      res.status(400).json({ error: "Drawn signatures must be PNG data URLs" });
      return;
    }
    const signer = loaded.signers.find((s) => s.role === "contractor");
    if (!signer) {
      res.status(500).json({ error: "Missing contractor signer" });
      return;
    }
    const consentText = loaded.contract.language === "fr"
      ? "J'accepte de signer ce contrat électroniquement et je reconnais que ma signature électronique a la même valeur qu'une signature manuscrite."
      : "I agree to sign this contract electronically and acknowledge that my electronic signature has the same effect as a handwritten signature.";
    await db
      .update(contractSignersTable)
      .set({ status: "signed", name: parsed.data.name, signatureType: parsed.data.signatureType, signatureData: parsed.data.signatureData, consentText, signedAt: new Date(), ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null })
      .where(eq(contractSignersTable.id, signer.id));
    await logContractEvent({ contractId: loaded.contract.id, type: "contractor_signed", actor: "contractor", signerId: signer.id, ip: req.ip, userAgent: req.headers["user-agent"] });
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "contract", entityId: loaded.contract.id, action: "contractor_signed", ip: req.ip, userAgent: req.headers["user-agent"] });

    // If the customer had already signed (contractor countersigning), execute.
    await finalizeContract(loaded.contract.id);
    const fresh = await loadContract(loaded.contract.id);
    res.json({ contract: serializeContract(fresh!.contract, fresh!.signers, fresh!.events) });
  } catch (err) {
    req.log.error({ err }, "Error signing contract");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/contracts/:id/send — email the customer a signing link (also used to resend)
router.post("/contracts/:id/send", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z.object({ message: z.string().max(1000).optional() }).safeParse(req.body ?? {});
    const { contract } = await sendContractToCustomer({ contractId: req.params.id as string, userId, message: body.success ? body.data.message : undefined, ip: req.ip, userAgent: req.headers["user-agent"] });
    const fresh = await loadContract(contract.id);
    res.json({ contract: serializeContract(fresh!.contract, fresh!.signers, fresh!.events) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (message === "SIGN_FIRST") {
      res.status(409).json({ error: "SIGN_FIRST", message: "Sign the contract before sending it to the customer." });
      return;
    }
    if (message === "CUSTOMER_EMAIL_MISSING") {
      res.status(400).json({ error: "CUSTOMER_EMAIL_MISSING", message: "Add the customer's email address first." });
      return;
    }
    if (message === "Contract not found") {
      res.status(404).json({ error: message });
      return;
    }
    req.log.error({ err }, "Error sending contract");
    res.status(500).json({ error: message });
  }
});

// POST /api/contracts/:id/void
router.post("/contracts/:id/void", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const loaded = await ownedContract(userId, req.params.id as string);
    if (!loaded) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (loaded.contract.status === "signed") {
      res.status(409).json({ error: "LOCKED", message: "An executed contract cannot be voided from here." });
      return;
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : null;
    await db.update(contractsTable).set({ status: "voided", voidedAt: new Date(), voidReason: reason }).where(eq(contractsTable.id, loaded.contract.id));
    await db.update(contractSignersTable).set({ tokenHash: null, tokenExpiresAt: null }).where(eq(contractSignersTable.contractId, loaded.contract.id));
    await logContractEvent({ contractId: loaded.contract.id, type: "voided", actor: "contractor", detail: { reason }, ip: req.ip, userAgent: req.headers["user-agent"] });
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "contract", entityId: loaded.contract.id, action: "voided", diff: { reason } });
    const fresh = await loadContract(loaded.contract.id);
    res.json({ contract: serializeContract(fresh!.contract, fresh!.signers, fresh!.events) });
  } catch (err) {
    req.log.error({ err }, "Error voiding contract");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/contracts/:id/pdf — draft preview or the executed PDF
router.get("/contracts/:id/pdf", requireAuth, async (req, res) => {
  try {
    const loaded = await ownedContract(getUserId(res), req.params.id as string);
    if (!loaded) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { buffer, filename } = await contractPdfBuffer(loaded.contract.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Error rendering contract PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
