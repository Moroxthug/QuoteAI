import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Readable } from "node:stream";
import { db, clientsTable, invoicesTable, invoicePaymentsTable, contractsTable, contractSignersTable, jobPhotosTable, projectsTable, hasFeature, type Client } from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { writeAudit } from "../lib/notifications.js";
import { sendPortalOtpEmail } from "../lib/emailPortal.js";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { thumbnailOrOriginal } from "../jobs/thumbnails.js";
import { buildInvoicePdf } from "../invoices/pdf.js";
import { reportEtransferSent } from "../invoices/service.js";
import { createInvoiceCheckoutSession } from "../invoices/stripeConnect.js";
import { contractPdfBuffer, logContractEvent, newRawToken, hashToken as hashSignToken } from "../contracts/service.js";
import {
  hashToken,
  maskEmail,
  newOtpCode,
  otpHash,
  otpMatches,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  issueSession,
  resolveSession,
  revokeSession,
  buildOverview,
  portalHeader,
  PORTAL_INVOICE_STATUSES,
  PORTAL_CONTRACT_STATUSES,
  contractCanSign,
} from "../portal/service.js";
import { postClientMessage, MAX_MESSAGE_LENGTH } from "../portal/messages.js";

// ── Phase 76: client portal (/portal/:token) ────────────────────────────────
// Public, token-addressed like /sign and /i: the token in the link is hashed
// before lookup and every endpoint is IP rate-limited. The token alone only
// tells the browser which company and a masked email; everything else needs
// a session, obtained by proving the mailbox with a 6-digit emailed code.
// The session travels in the `X-Portal-Session` header (never a cookie, so a
// contractor's dashboard session and a client's portal session cannot mix).

const router = Router();
const objectStorage = new ObjectStorageService();
const viewLimiter = ipRateLimiter({ windowMs: 60_000, max: 120, message: "Too many requests" });
const otpLimiter = ipRateLimiter({ windowMs: 15 * 60_000, max: 8, message: "Too many verification attempts. Try again later." });
const actionLimiter = ipRateLimiter({ windowMs: 60_000, max: 20, message: "Too many requests" });

const PORTAL_SESSION_HEADER = "x-portal-session";

async function resolveClient(rawToken: string): Promise<Client | null> {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 200) return null;
  const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.portalTokenHash, hashToken(rawToken)), isNull(clientsTable.archivedAt)));
  return client ?? null;
}

function sessionHeader(req: Request): string | undefined {
  const v = req.headers[PORTAL_SESSION_HEADER];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

/** Token → client, then session → authenticated. Writes the error response itself and returns null. */
async function authenticate(req: Request, res: Response): Promise<Client | null> {
  const client = await resolveClient(req.params.token as string);
  if (!client) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  const session = await resolveSession(client, sessionHeader(req));
  if (!session) {
    res.status(401).json({ error: "session_required" });
    return null;
  }
  return client;
}

// GET /api/portal/:token — who this is for, and whether the browser's session is still good
router.get("/portal/:token", viewLimiter, async (req, res) => {
  try {
    const client = await resolveClient(req.params.token as string);
    if (!client) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { company, language } = await portalHeader(client);
    const session = await resolveSession(client, sessionHeader(req));
    res.json({
      company,
      client: { name: client.name, emailMasked: client.email ? maskEmail(client.email) : null, language },
      authenticated: !!session,
      sessionExpiresAt: session?.expiresAt.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Portal header failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/portal/:token/otp — email the 6-digit code
router.post("/portal/:token/otp", otpLimiter, async (req, res) => {
  try {
    const client = await resolveClient(req.params.token as string);
    if (!client) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (!client.email) {
      res.status(409).json({ error: "no_email" });
      return;
    }
    const code = newOtpCode();
    await db.update(clientsTable).set({ portalOtpHash: otpHash(client.id, code), portalOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS), portalOtpAttempts: 0 }).where(eq(clientsTable.id, client.id));
    const { company, language } = await portalHeader(client);
    await sendPortalOtpEmail({ toEmail: client.email, code, companyName: company.name || "QuoteAI", language });
    await writeAudit({ userId: client.userId, actorType: "customer", actorId: client.id, entityType: "client", entityId: client.id, action: "portal_otp_sent", ip: req.ip });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Portal OTP send failed");
    res.status(500).json({ error: "Could not send the access code" });
  }
});

// POST /api/portal/:token/verify — check the code, hand out a session
router.post("/portal/:token/verify", otpLimiter, async (req, res) => {
  try {
    const client = await resolveClient(req.params.token as string);
    if (!client) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const body = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    if (!client.portalOtpHash || !client.portalOtpExpiresAt || client.portalOtpExpiresAt < new Date()) {
      res.status(400).json({ error: "code_expired" });
      return;
    }
    if (client.portalOtpAttempts >= OTP_MAX_ATTEMPTS) {
      res.status(429).json({ error: "too_many_attempts" });
      return;
    }
    if (!otpMatches(client, body.data.code)) {
      await db.update(clientsTable).set({ portalOtpAttempts: client.portalOtpAttempts + 1 }).where(eq(clientsTable.id, client.id));
      res.status(400).json({ error: "invalid_code", attemptsLeft: OTP_MAX_ATTEMPTS - client.portalOtpAttempts - 1 });
      return;
    }
    await db.update(clientsTable).set({ portalOtpHash: null, portalOtpExpiresAt: null, portalOtpAttempts: 0 }).where(eq(clientsTable.id, client.id));
    const session = await issueSession(client, { ip: req.ip, userAgent: req.headers["user-agent"] });
    await writeAudit({ userId: client.userId, actorType: "customer", actorId: client.id, entityType: "client", entityId: client.id, action: "portal_signed_in", ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ success: true, session: session.raw, expiresAt: session.expiresAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Portal OTP verify failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/portal/:token/logout
router.post("/portal/:token/logout", actionLimiter, async (req, res) => {
  try {
    const client = await resolveClient(req.params.token as string);
    if (!client) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const raw = sessionHeader(req);
    if (raw) await revokeSession(raw);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Portal logout failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/portal/:token/overview — everything, in one call
router.get("/portal/:token/overview", viewLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const { profile, company, language } = await portalHeader(client);
    const overview = await buildOverview(client, profile);
    res.json({ company, client: { name: client.name, email: client.email, language }, ...overview });
  } catch (err) {
    req.log.error({ err }, "Portal overview failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/portal/:token/messages — the client writes to the company
router.post("/portal/:token/messages", actionLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const body = z.object({ body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH), jobId: z.string().uuid().nullable().optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid_message" });
      return;
    }
    let projectId: string | null = null;
    if (body.data.jobId) {
      const [job] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, body.data.jobId), eq(projectsTable.clientId, client.id)));
      if (!job) {
        res.status(404).json({ error: "job_not_found" });
        return;
      }
      projectId = job.id;
    }
    const { message } = await postClientMessage({ client, sender: "client", senderName: client.name, body: body.data.body, projectId, ip: req.ip });
    res.status(201).json({ message });
  } catch (err) {
    req.log.error({ err }, "Portal message failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/portal/:token/photos/:photoId/file — streams a job photo (the job must be the client's)
router.get("/portal/:token/photos/:photoId/file", viewLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const [row] = await db
      .select({ photo: jobPhotosTable })
      .from(jobPhotosTable)
      .innerJoin(projectsTable, eq(projectsTable.id, jobPhotosTable.projectId))
      .where(and(eq(jobPhotosTable.id, req.params.photoId as string), eq(projectsTable.clientId, client.id), eq(projectsTable.userId, client.userId)));
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    // Phase 96: the portal grid asks for `?size=thumb`; a tap on a photo fetches the original.
    const file = req.query.size === "thumb" ? (await thumbnailOrOriginal(row.photo)).body : await objectStorage.downloadPrivateObject(row.photo.fileUrl.replace(/^\/objects\//, ""));
    res.status(file.status);
    file.headers.forEach((v, k) => res.setHeader(k, v));
    if (file.body) Readable.fromWeb(file.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    req.log.error({ err }, "Portal photo failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Invoices: PDF, pay by card, "I've sent the e-Transfer" ──────────────────

async function clientInvoice(client: Client, invoiceId: string) {
  const [inv] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.clientId, client.id), eq(invoicesTable.userId, client.userId)));
  if (!inv || !(PORTAL_INVOICE_STATUSES as readonly string[]).includes(inv.status)) return null;
  return inv;
}

router.get("/portal/:token/invoices/:id/pdf", viewLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const inv = await clientInvoice(client, req.params.id as string);
    if (!inv) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const payments = await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, inv.id)).orderBy(asc(invoicePaymentsTable.date));
    const { buffer } = await buildInvoicePdf(inv, payments);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${inv.number}.pdf"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Portal invoice PDF failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/portal/:token/invoices/:id/pay-link", actionLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const inv = await clientInvoice(client, req.params.id as string);
    if (!inv) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { profile } = await portalHeader(client);
    if (!hasFeature(profile, "invoice_card_payments")) {
      res.status(403).json({ error: "NOT_AVAILABLE" });
      return;
    }
    const { url } = await createInvoiceCheckoutSession(inv);
    res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "CARD_PAYMENTS_NOT_ENABLED") {
      res.status(403).json({ error: "NOT_AVAILABLE" });
      return;
    }
    req.log.error({ err }, "Portal pay-link failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/portal/:token/invoices/:id/mark-sent", actionLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const inv = await clientInvoice(client, req.params.id as string);
    if (!inv) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const updated = await reportEtransferSent({ invoiceId: inv.id, ip: req.ip, userAgent: req.headers["user-agent"] ?? null });
    res.json({ status: updated.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "NOT_OPEN") {
      res.status(400).json({ error: "NOT_OPEN" });
      return;
    }
    req.log.error({ err }, "Portal mark-sent failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Contracts: PDF and "sign now" ───────────────────────────────────────────

async function clientContract(client: Client, contractId: string) {
  const [c] = await db.select().from(contractsTable).where(and(eq(contractsTable.id, contractId), eq(contractsTable.clientId, client.id), eq(contractsTable.userId, client.userId)));
  if (!c || !(PORTAL_CONTRACT_STATUSES as readonly string[]).includes(c.status)) return null;
  return c;
}

router.get("/portal/:token/contracts/:id/pdf", viewLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const c = await clientContract(client, req.params.id as string);
    if (!c) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { buffer, filename } = await contractPdfBuffer(c.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Portal contract PDF failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/portal/:token/contracts/:id/sign-link — a fresh /sign link for a
// contract awaiting the client's signature. The portal session already proved
// the same mailbox the signing OTP would, so the signer is marked verified and
// the signing page goes straight to the signature step. The emailed link is
// replaced (one live token per signer), which the response says.
router.post("/portal/:token/contracts/:id/sign-link", actionLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const c = await clientContract(client, req.params.id as string);
    if (!c) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const [signer] = await db.select().from(contractSignersTable).where(and(eq(contractSignersTable.contractId, c.id), eq(contractSignersTable.role, "customer")));
    if (!contractCanSign(c, signer, client.email)) {
      res.status(409).json({ error: "not_signable" });
      return;
    }
    const raw = newRawToken();
    await db
      .update(contractSignersTable)
      .set({ tokenHash: hashSignToken(raw), tokenExpiresAt: c.expiresAt, otpVerifiedAt: new Date(), status: signer!.status === "pending" ? "viewed" : signer!.status })
      .where(eq(contractSignersTable.id, signer!.id));
    await logContractEvent({ contractId: c.id, type: "otp_verified", actor: "customer", signerId: signer!.id, detail: { via: "portal" }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ url: `${getBaseUrl()}/sign/${raw}` });
  } catch (err) {
    req.log.error({ err }, "Portal sign-link failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
