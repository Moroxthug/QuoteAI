import { Router } from "express";
import { z } from "zod";
import { db, projectsTable, businessProfilesTable, hasFeature, minimumPlanFor, type AssistantMessage, type AssistantProposal } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { getOrCreateConversation, loadConversation, clearConversation, runAssistantTurn, type Lang } from "../assistant/service.js";
import { confirmProposal, dismissProposal, ProposalError } from "../assistant/apply.js";

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

function langOf(req: { headers: Record<string, unknown>; body?: unknown }): Lang {
  const fromBody = (req.body as { language?: string } | undefined)?.language;
  if (fromBody === "fr" || fromBody === "en") return fromBody;
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
router.post("/assistant/conversations/:id/messages", requireAuth, chatLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireAssistant(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const body = z.object({ content: z.string().trim().min(1).max(4000), language: z.enum(["en", "fr"]).optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const loaded = await loadConversation(userId, req.params.id as string);
    if (!loaded) { res.status(404).json({ error: "Not found" }); return; }
    const result = await runAssistantTurn({ conversation: loaded.conversation, userId, content: body.data.content, language: langOf(req) });
    res.json({ messages: result.messages.map(serializeMessage), proposals: result.proposals.map(serializeProposal) });
  } catch (err) {
    req.log.error({ err }, "Assistant turn failed");
    res.status(502).json({ error: "ASSISTANT_FAILED", message: "The assistant could not answer right now. Try again in a moment." });
  }
});

// DELETE /api/assistant/conversations/:id — start over
router.delete("/assistant/conversations/:id", requireAuth, async (req, res) => {
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
router.post("/assistant/proposals/:id/confirm", requireAuth, async (req, res) => {
  try {
    const out = await confirmProposal({ userId: getUserId(res), proposalId: req.params.id as string, ip: req.ip });
    res.json({ proposal: serializeProposal(out.proposal), link: out.link });
  } catch (err) {
    if (err instanceof ProposalError) { res.status(err.status).json({ error: err.code, message: err.message }); return; }
    req.log.error({ err }, "Error confirming proposal");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/assistant/proposals/:id/dismiss
router.post("/assistant/proposals/:id/dismiss", requireAuth, async (req, res) => {
  try {
    const proposal = await dismissProposal({ userId: getUserId(res), proposalId: req.params.id as string });
    res.json({ proposal: serializeProposal(proposal) });
  } catch (err) {
    if (err instanceof ProposalError) { res.status(err.status).json({ error: err.code, message: err.message }); return; }
    req.log.error({ err }, "Error dismissing proposal");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
