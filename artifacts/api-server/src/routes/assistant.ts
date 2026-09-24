import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import multer from "multer";
import { db, projectsTable, businessProfilesTable, hasFeature, minimumPlanFor, type AssistantMessage, type AssistantProposal, type Project } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { openai, toFile } from "@workspace/integrations-openai-ai-server";
import { requireAuth, getUserId, getActorRole, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { getOrCreateConversation, loadConversation, clearConversation, runAssistantTurn, type Lang } from "../assistant/service.js";
import { confirmProposal, dismissProposal, ProposalError } from "../assistant/apply.js";
import { photoUpload, serializePhoto, storeJobPhoto } from "../jobs/photos.js";

// ── Phase 5: job assistant ───────────────────────────────────────────────────
// Gate: "assistant" (Elite). Reads are free-form; writes only happen when
// the user confirms a proposal card.

const router = Router();
const chatLimiter = userRateLimiter({ windowMs: 60 * 60 * 1000, max: 120, message: "Hourly assistant limit reached. Try again later." });

async function requireAssistant(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "assistant")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("assistant") };
}

export function serializeMessage(m: AssistantMessage) {
  return { id: m.id, role: m.role, content: m.content, toolCalls: m.toolCalls?.map((c) => ({ id: c.id, name: c.name })) ?? null, toolCallId: m.toolCallId, toolName: m.toolName, createdAt: m.createdAt.toISOString() };
}

export function serializeProposal(p: AssistantProposal) {
  return { id: p.id, messageId: p.messageId, projectId: p.projectId, kind: p.kind, summary: p.summary, payload: p.payload, status: p.status, resultEntityType: p.resultEntityType, resultEntityId: p.resultEntityId, error: p.error, resolvedAt: p.resolvedAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString() };
}

/** The language the route parsed from the body wins; otherwise the request headers. */
function langOf(req: { headers: Record<string, unknown> }, fromBody?: Lang): Lang {
  if (fromBody) return fromBody;
  const header = String(req.headers["x-language"] ?? req.headers["accept-language"] ?? "");
  return header.toLowerCase().startsWith("fr") ? "fr" : "en";
}

// GET /api/assistant/conversation?projectId=… — the conversation for a job (or the company one), created on first use
router.get("/assistant/conversation", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "The assistant requires the Elite plan" }); return; }
    const projectId = typeof req.query.projectId === "string" && req.query.projectId ? req.query.projectId : null;
    if (projectId) {
      const [p] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
      if (!p) { res.status(404).json({ error: "Not found" }); return; }
    }
    const conv = await getOrCreateConversation(userId, projectId);
    const loaded = await loadConversation(userId, conv.id);
    res.json({ conversation: { id: conv.id, projectId: conv.projectId, title: conv.title }, messages: loaded!.messages.map(serializeMessage), proposals: loaded!.proposals.map(serializeProposal) });
  } catch (err) {
    req.log.error({ err }, "Error loading assistant conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assistant/conversations/:id/messages { content, language? }
router.post("/assistant/conversations/:id/messages", requireAuth, requirePermission("jobs", "view"), chatLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const body = z.object({ content: z.string().trim().min(1).max(4000), language: z.enum(["en", "fr"]).optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const loaded = await loadConversation(userId, req.params.id as string);
    if (!loaded) { res.status(404).json({ error: "Not found" }); return; }
    const result = await runAssistantTurn({ conversation: loaded.conversation, userId, content: body.data.content, language: langOf(req, body.data.language) });
    res.json({ messages: result.messages.map(serializeMessage), proposals: result.proposals.map(serializeProposal) });
  } catch (err) {
    req.log.error({ err }, "Assistant turn failed");
    res.status(502).json({ error: "ASSISTANT_FAILED", message: "The assistant could not answer right now. Try again in a moment." });
  }
});

// DELETE /api/assistant/conversations/:id — start over
router.delete("/assistant/conversations/:id", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const ok = await clearConversation(getUserId(res), req.params.id as string);
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error clearing assistant conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assistant/proposals/:id/confirm
router.post("/assistant/proposals/:id/confirm", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const out = await confirmProposal({ userId: getUserId(res), proposalId: req.params.id as string, ip: req.ip, actorRole: getActorRole(res), actorName: getUserName(res) });
    res.json({ proposal: serializeProposal(out.proposal), link: out.link });
  } catch (err) {
    if (err instanceof ProposalError) { res.status(err.status).json({ error: err.code, message: err.message }); return; }
    req.log.error({ err }, "Error confirming proposal");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assistant/proposals/:id/dismiss
router.post("/assistant/proposals/:id/dismiss", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const proposal = await dismissProposal({ userId: getUserId(res), proposalId: req.params.id as string });
    res.json({ proposal: serializeProposal(proposal) });
  } catch (err) {
    if (err instanceof ProposalError) { res.status(err.status).json({ error: err.code, message: err.message }); return; }
    req.log.error({ err }, "Error dismissing proposal");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Phase 78: voice-first job actions ────────────────────────────────────────
// One tap on the job page: dictation (or a photo) → transcript → the same
// tool-calling turn as the chat, in "on-site" mode → proposal cards. Reuses
// the job's conversation so the Assistant tab shows what happened.

const actionLimiter = userRateLimiter({ windowMs: 60 * 60 * 1000, max: 60, message: "You have reached the hourly limit for on-site actions. Please try again later." });

const AUDIO_MIMES = ["audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/x-m4a", "audio/aac"];
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Browsers append codec parameters ("audio/webm;codecs=opus"); match on the type only.
    if (AUDIO_MIMES.includes(file.mimetype.split(";")[0]!.trim())) cb(null, true);
    else cb(new Error(`Unsupported audio format: ${file.mimetype}`));
  },
});

function single(upload: multer.Multer, field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(field)(req, res, (err) => {
      if (err instanceof multer.MulterError || err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    });
  };
}

async function ownedJob(userId: string, projectId: string): Promise<Project | null> {
  const [p] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return p ?? null;
}

/** Shared tail of the three action routes: gate → job → conversation → on-site turn. */
async function runAction(req: Request, res: Response, params: { projectId: string; content: string; source: "voice" | "photo"; language?: Lang; imageDataUrl?: string | null; photoId?: string | null; extra?: Record<string, unknown> }) {
  const userId = getUserId(res);
  const gate = await requireAssistant(userId);
  if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "On-site actions use the assistant, which requires the Elite plan" }); return; }
  const job = await ownedJob(userId, params.projectId);
  if (!job) { res.status(404).json({ error: "Not found" }); return; }
  const conv = await getOrCreateConversation(userId, job.id);
  try {
    const result = await runAssistantTurn({ conversation: conv, userId, content: params.content, language: langOf(req, params.language), source: params.source, imageDataUrl: params.imageDataUrl ?? null, photoId: params.photoId ?? null });
    res.json({ conversationId: conv.id, ...(params.extra ?? {}), messages: result.messages.map(serializeMessage), proposals: result.proposals.map(serializeProposal) });
  } catch (err) {
    req.log.error({ err }, "On-site assistant turn failed");
    res.status(502).json({ error: "ASSISTANT_FAILED", message: "The assistant could not work on that right now. Try again in a moment.", ...(params.extra ?? {}) });
  }
}

// POST /api/assistant/actions { projectId, text, language? } — a typed (or edited) on-site instruction
router.post("/assistant/actions", requireAuth, requirePermission("jobs", "edit"), actionLimiter, async (req, res) => {
  try {
    const body = z.object({ projectId: z.string().uuid(), text: z.string().trim().min(1).max(4000), language: z.enum(["en", "fr"]).optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    await runAction(req, res, { projectId: body.data.projectId, content: body.data.text, source: "voice", language: body.data.language });
  } catch (err) {
    req.log.error({ err }, "Error running on-site action");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assistant/voice multipart { audio, projectId, language? } — dictation → transcript → proposals
router.post("/assistant/voice", requireAuth, requirePermission("jobs", "edit"), actionLimiter, single(audioUpload, "audio"), async (req, res) => {
  try {
    const fields = z.object({ projectId: z.string().uuid(), language: z.enum(["en", "fr"]).optional() }).safeParse(req.body ?? {});
    if (!fields.success) { res.status(400).json({ error: "Invalid parameters", details: fields.error }); return; }
    const file = req.file;
    if (!file) { res.status(400).json({ error: "No audio file provided" }); return; }
    const language = langOf(req, fields.data.language);
    let transcript = "";
    try {
      const uploadable = await toFile(file.buffer, file.originalname || "recording.webm", { type: file.mimetype });
      const out = await openai.audio.transcriptions.create({ file: uploadable, model: "whisper-large-v3-turbo", language, response_format: "json" }, { timeout: 30_000 });
      transcript = (out.text ?? "").trim();
    } catch (err) {
      req.log.error({ err }, "On-site transcription failed");
      res.status(502).json({ error: "TRANSCRIPTION_FAILED", message: "Could not transcribe that. Try again or type it." });
      return;
    }
    if (!transcript) { res.status(422).json({ error: "EMPTY_TRANSCRIPT", message: "Didn't catch that — try speaking more clearly." }); return; }
    await runAction(req, res, { projectId: fields.data.projectId, content: transcript, source: "voice", language, extra: { transcript } });
  } catch (err) {
    req.log.error({ err }, "Error running voice action");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assistant/photo multipart { photo, projectId, note?, milestoneId?, language? } — photo saved to the gallery, then looked at
router.post("/assistant/photo", requireAuth, requirePermission("jobs", "edit"), actionLimiter, single(photoUpload, "photo"), async (req, res) => {
  try {
    const fields = z.object({ projectId: z.string().uuid(), note: z.string().trim().max(2000).optional(), milestoneId: z.string().uuid().optional(), language: z.enum(["en", "fr"]).optional() }).safeParse(req.body ?? {});
    if (!fields.success) { res.status(400).json({ error: "Invalid parameters", details: fields.error }); return; }
    const file = req.file;
    if (!file) { res.status(400).json({ error: "No photo provided" }); return; }
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "On-site actions use the assistant, which requires the Elite plan" }); return; }
    const job = await ownedJob(userId, fields.data.projectId);
    if (!job) { res.status(404).json({ error: "Not found" }); return; }
    if (file.mimetype === "image/heic") { res.status(415).json({ error: "UNSUPPORTED_FOR_VISION", message: "HEIC photos can be added to the gallery but not read by the assistant — take the photo as JPG (most phones: Settings → Camera → Formats → Most compatible)." }); return; }
    const note = fields.data.note ?? "";
    let stored: Awaited<ReturnType<typeof storeJobPhoto>>;
    try {
      stored = await storeJobPhoto({ userId, projectId: job.id, file, caption: note, milestoneId: fields.data.milestoneId ?? null });
    } catch (err) {
      if ((err as Error).message === "Milestone not found") { res.status(404).json({ error: "Milestone not found" }); return; }
      throw err;
    }
    const imageDataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const content = note ? `[Photo] ${note}` : "[Photo] What do you see, and does it change the job?";
    await runAction(req, res, { projectId: job.id, content, source: "photo", language: fields.data.language, imageDataUrl, photoId: stored.photo.id, extra: { photo: serializePhoto(stored.photo) } });
  } catch (err) {
    req.log.error({ err }, "Error running photo action");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
