import { Router } from "express";
import { z } from "zod";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db, contractsTable, contractSignersTable, authUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { hashToken, loadContract, logContractEvent, finalizeContract, contractPdfBuffer } from "../contracts/service.js";
import { renderContractHtml, CONTRACT_CSS } from "../contracts/render.js";
import { sendContractOtpEmail, sendContractDeclinedEmail } from "../lib/emailContracts.js";
import { raiseAutomation } from "../lib/automation.js";
import { writeAudit } from "../lib/notifications.js";
import { isWellFormedPngDataUrl } from "../lib/pngDataUrl.js";
import { portalLinkForClient } from "../portal/service.js";

// Public, token-addressed signing flow. Every endpoint is keyed by the raw
// token from the emailed link (hashed before lookup) and rate-limited by IP.

const router = Router();
const viewLimiter = ipRateLimiter({ windowMs: 60_000, max: 60, message: "Too many requests" });
const otpLimiter = ipRateLimiter({ windowMs: 15 * 60_000, max: 8, message: "Too many verification attempts. Try again later." });
const signLimiter = ipRateLimiter({ windowMs: 15 * 60_000, max: 10, message: "Too many attempts." });

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

type Loaded = NonNullable<Awaited<ReturnType<typeof loadContract>>>;

async function resolveToken(rawToken: string): Promise<{ loaded: Loaded; signer: Loaded["signers"][number] } | { error: "not_found" | "expired" | "closed"; loaded?: Loaded }> {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 200) return { error: "not_found" };
  const [signer] = await db.select().from(contractSignersTable).where(eq(contractSignersTable.tokenHash, hashToken(rawToken)));
  if (!signer) return { error: "not_found" };
  const loaded = await loadContract(signer.contractId);
  if (!loaded) return { error: "not_found" };
  const { contract } = loaded;
  if (contract.status === "voided" || contract.status === "declined") return { error: "closed", loaded };
  if (contract.status === "signed") return { loaded, signer: loaded.signers.find((s) => s.id === signer.id)! };
  if (contract.status === "expired" || (signer.tokenExpiresAt && signer.tokenExpiresAt < new Date())) {
    if (contract.status !== "expired") {
      await db.update(contractsTable).set({ status: "expired" }).where(eq(contractsTable.id, contract.id));
      await logContractEvent({ contractId: contract.id, type: "expired", actor: "system" });
    }
    return { error: "expired", loaded };
  }
  return { loaded, signer: loaded.signers.find((s) => s.id === signer.id)! };
}

function publicPayload(loaded: Loaded, signer: Loaded["signers"][number], portalUrl: string | null = null) {
  const { contract, signers } = loaded;
  const contractor = signers.find((s) => s.role === "contractor");
  return {
    contract: {
      id: contract.id,
      contractNumber: contract.contractNumber,
      status: contract.status,
      language: contract.language,
      province: contract.province,
      title: contract.document.title,
      total: contract.variables.total,
      companyName: contract.variables.contractor.name,
      companyEmail: contract.variables.contractor.email ?? null,
      companyPhone: contract.variables.contractor.phone ?? null,
      customerName: contract.variables.customer.name,
      expiresAt: contract.expiresAt?.toISOString() ?? null,
      signedAt: contract.signedAt?.toISOString() ?? null,
      contractorSignedAt: contractor?.signedAt?.toISOString() ?? null,
      /** Phase 76: the client portal ("see everything"), when the contract has a client with an email. */
      portalUrl,
    },
    signer: {
      name: signer.name,
      emailMasked: signer.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
      status: signer.status,
      otpVerified: !!signer.otpVerifiedAt && (signer.otpVerifiedAt.getTime() > Date.now() - 60 * 60_000),
      signedAt: signer.signedAt?.toISOString() ?? null,
    },
    html: renderContractHtml({ document: contract.document, variables: contract.variables, signers, status: contract.status, createdAt: contract.createdAt }),
    css: CONTRACT_CSS,
  };
}

// GET /api/sign/:token — the contract as the customer sees it
router.get("/sign/:token", viewLimiter, async (req, res) => {
  try {
    const r = await resolveToken(req.params.token as string);
    if ("error" in r) {
      res.status(r.error === "not_found" ? 404 : 410).json({ error: r.error });
      return;
    }
    const { loaded, signer } = r;
    const portalUrl = await portalLinkForClient(loaded.contract.clientId);
    if (!signer.viewedAt) {
      await db.update(contractSignersTable).set({ viewedAt: new Date(), status: signer.status === "pending" ? "viewed" : signer.status, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null }).where(eq(contractSignersTable.id, signer.id));
      if (loaded.contract.status === "sent") await db.update(contractsTable).set({ status: "viewed" }).where(eq(contractsTable.id, loaded.contract.id));
      await logContractEvent({ contractId: loaded.contract.id, type: "viewed", actor: "customer", signerId: signer.id, ip: req.ip, userAgent: req.headers["user-agent"] });
      const fresh = await loadContract(loaded.contract.id);
      res.json(publicPayload(fresh!, fresh!.signers.find((s) => s.id === signer.id)!, portalUrl));
      return;
    }
    res.json(publicPayload(loaded, signer, portalUrl));
  } catch (err) {
    req.log.error({ err }, "Error loading signing page");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sign/:token/otp — email a 6-digit verification code
router.post("/sign/:token/otp", otpLimiter, async (req, res) => {
  try {
    const r = await resolveToken(req.params.token as string);
    if ("error" in r) {
      res.status(r.error === "not_found" ? 404 : 410).json({ error: r.error });
      return;
    }
    const { loaded, signer } = r;
    if (signer.status === "signed") {
      res.status(409).json({ error: "already_signed" });
      return;
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db
      .update(contractSignersTable)
      .set({ otpHash: createHash("sha256").update(`${signer.id}:${code}`).digest("hex"), otpExpiresAt: new Date(Date.now() + OTP_TTL_MS), otpAttempts: 0 })
      .where(eq(contractSignersTable.id, signer.id));
    await sendContractOtpEmail({ toEmail: signer.email, code, companyName: loaded.contract.variables.contractor.name, language: loaded.contract.language as "en" | "fr" });
    await logContractEvent({ contractId: loaded.contract.id, type: "otp_sent", actor: "system", signerId: signer.id, ip: req.ip });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error sending OTP");
    res.status(500).json({ error: "Could not send the verification code" });
  }
});

// POST /api/sign/:token/verify — check the code
router.post("/sign/:token/verify", otpLimiter, async (req, res) => {
  try {
    const r = await resolveToken(req.params.token as string);
    if ("error" in r) {
      res.status(r.error === "not_found" ? 404 : 410).json({ error: r.error });
      return;
    }
    const { loaded, signer } = r;
    const body = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    if (!signer.otpHash || !signer.otpExpiresAt || signer.otpExpiresAt < new Date()) {
      res.status(400).json({ error: "code_expired" });
      return;
    }
    if (signer.otpAttempts >= OTP_MAX_ATTEMPTS) {
      res.status(429).json({ error: "too_many_attempts" });
      return;
    }
    // Constant-time compare (Phase 62): a `===` on the hex digests would leak how many leading bytes matched.
    const expected = Buffer.from(signer.otpHash, "hex");
    const provided = createHash("sha256").update(`${signer.id}:${body.data.code}`).digest();
    const ok = expected.length === provided.length && timingSafeEqual(expected, provided);
    if (!ok) {
      await db.update(contractSignersTable).set({ otpAttempts: signer.otpAttempts + 1 }).where(eq(contractSignersTable.id, signer.id));
      res.status(400).json({ error: "invalid_code", attemptsLeft: OTP_MAX_ATTEMPTS - signer.otpAttempts - 1 });
      return;
    }
    await db.update(contractSignersTable).set({ otpVerifiedAt: new Date(), otpHash: null, status: "verified" }).where(eq(contractSignersTable.id, signer.id));
    await logContractEvent({ contractId: loaded.contract.id, type: "otp_verified", actor: "customer", signerId: signer.id, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error verifying OTP");
    res.status(500).json({ error: "Internal server error" });
  }
});

const CompleteBody = z.object({
  name: z.string().min(2).max(200),
  signatureType: z.enum(["drawn", "typed"]),
  signatureData: z.string().min(1).max(200_000),
  consent: z.literal(true),
});

// POST /api/sign/:token/complete — record the customer's signature
router.post("/sign/:token/complete", signLimiter, async (req, res) => {
  try {
    const r = await resolveToken(req.params.token as string);
    if ("error" in r) {
      res.status(r.error === "not_found" ? 404 : 410).json({ error: r.error });
      return;
    }
    const { loaded, signer } = r;
    if (signer.status === "signed") {
      res.json({ success: true, alreadySigned: true });
      return;
    }
    if (!signer.otpVerifiedAt || signer.otpVerifiedAt.getTime() < Date.now() - 60 * 60_000) {
      res.status(403).json({ error: "verify_first" });
      return;
    }
    const body = CompleteBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid_signature", details: body.error });
      return;
    }
    // A corrupt image would only blow up later, inside the signed-PDF render —
    // after this signer is already recorded as signed. Refuse it here instead.
    if (body.data.signatureType === "drawn" && !isWellFormedPngDataUrl(body.data.signatureData)) {
      res.status(400).json({ error: "invalid_signature" });
      return;
    }
    const lang = loaded.contract.language;
    const consentText = lang === "fr"
      ? "J'ai lu le contrat, y compris mon droit de résolution, et j'accepte de le signer électroniquement. Ma signature électronique a la même valeur qu'une signature manuscrite."
      : "I have read the contract, including my cancellation rights, and agree to sign it electronically. My electronic signature has the same effect as a handwritten signature.";
    await db
      .update(contractSignersTable)
      .set({ status: "signed", name: body.data.name, signatureType: body.data.signatureType, signatureData: body.data.signatureData, consentText, signedAt: new Date(), ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null, tokenHash: signer.tokenHash })
      .where(eq(contractSignersTable.id, signer.id));
    await logContractEvent({ contractId: loaded.contract.id, type: "signed", actor: "customer", signerId: signer.id, detail: { signatureType: body.data.signatureType, consentText }, ip: req.ip, userAgent: req.headers["user-agent"] });
    await writeAudit({ userId: loaded.contract.userId, actorType: "customer", actorId: signer.id, entityType: "contract", entityId: loaded.contract.id, action: "customer_signed", ip: req.ip, userAgent: req.headers["user-agent"] });

    await finalizeContract(loaded.contract.id);
    const fresh = await loadContract(loaded.contract.id);
    res.json({ success: true, status: fresh!.contract.status, signedAt: fresh!.contract.signedAt?.toISOString() ?? null });
  } catch (err) {
    req.log.error({ err }, "Error completing signature");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sign/:token/decline
router.post("/sign/:token/decline", signLimiter, async (req, res) => {
  try {
    const r = await resolveToken(req.params.token as string);
    if ("error" in r) {
      res.status(r.error === "not_found" ? 404 : 410).json({ error: r.error });
      return;
    }
    const { loaded, signer } = r;
    if (signer.status === "signed") {
      res.status(409).json({ error: "already_signed" });
      return;
    }
    const body = z.object({ reason: z.string().max(5000).nullish() }).safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "invalid_reason" });
      return;
    }
    const reason = body.data.reason?.trim().slice(0, 1000) ?? null;
    await db.update(contractSignersTable).set({ status: "declined", declinedAt: new Date(), declineReason: reason, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null }).where(eq(contractSignersTable.id, signer.id));
    await db.update(contractsTable).set({ status: "declined" }).where(eq(contractsTable.id, loaded.contract.id));
    await logContractEvent({ contractId: loaded.contract.id, type: "declined", actor: "customer", signerId: signer.id, detail: { reason }, ip: req.ip, userAgent: req.headers["user-agent"] });
    await writeAudit({ userId: loaded.contract.userId, actorType: "customer", actorId: signer.id, entityType: "contract", entityId: loaded.contract.id, action: "declined", diff: { reason } });

    const [owner] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, loaded.contract.userId));
    const toEmail = loaded.contract.variables.contractor.email || owner?.email;
    if (toEmail) {
      sendContractDeclinedEmail({ toEmail, customerName: signer.name, contractNumber: loaded.contract.contractNumber, reason, dashboardUrl: `${getBaseUrl()}/dashboard/contracts/${loaded.contract.id}` }).catch((err) => req.log.error({ err }, "Failed to send declined email"));
    }
    await raiseAutomation({ event: "contract.declined", userId: loaded.contract.userId, entityType: "contract", entityId: loaded.contract.id, payload: { reason } });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error declining contract");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sign/:token/pdf — the customer's copy (signed when executed, otherwise the sent version)
router.get("/sign/:token/pdf", viewLimiter, async (req, res) => {
  try {
    const r = await resolveToken(req.params.token as string);
    if ("error" in r && r.error !== "expired") {
      res.status(r.error === "not_found" ? 404 : 410).json({ error: r.error });
      return;
    }
    const loaded = "loaded" in r ? r.loaded : undefined;
    if (!loaded) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { buffer, filename } = await contractPdfBuffer(loaded.contract.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Error rendering customer PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
