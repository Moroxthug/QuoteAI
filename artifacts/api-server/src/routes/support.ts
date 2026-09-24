import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { db, conversations, messages, settingsTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAdmin, isAdmin } from "./admin.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { moderateSupportMessage } from "../lib/moderation.js";
import crypto from "crypto";

// Phase 70: the help centre's ten guides (artifacts/quote-ai/src/data/help-articles.ts).
// Kept as a plain list here so the support bot can point visitors at the
// right page instead of improvising product behaviour. Update both when a
// guide is added or renamed.
const HELP_GUIDES: ReadonlyArray<[slug: string, topic: string]> = [
  ["getting-started", "account creation, business profile (taxes, licence, e-Transfer email, logo), plans and billing"],
  ["create-a-quote", "creating a quote from text, voice or photos; editing; catalog; Good/Better/Best options; PDF templates"],
  ["send-a-quote-and-get-it-accepted", "emailing or sharing a quote, online acceptance, automatic follow-ups on days 2/5/10"],
  ["contracts-and-e-signature", "province contract templates (ON/BC/AB/QC), review, sending for signature, email-code e-signature, signed PDF and audit certificate"],
  ["jobs-milestones-and-change-orders", "job setup review, milestones, schedule, calendar sync, change orders, holdback release"],
  ["invoices-and-getting-paid", "deposit/progress/final invoices, Interac e-Transfer, card payments via Stripe, recording payments, overdue reminders 3/7/14 days"],
  ["costs-receipts-and-time", "receipt scanning, cost tracking, worker time-entry links, GPS clock-in, payroll CSV export"],
  ["team-accounts-and-roles", "inviting team members, roles (admin/office/foreman/viewer), seats per plan"],
  ["leads-and-follow-ups", "lead sources (website widget, WhatsApp, Meta Lead Ads, Google LSA), pipeline, CASL consent and unsubscribe, review requests"],
  ["integrations-and-imports", "Gmail sending, Google/Outlook calendar, QuickBooks and Wave, Stripe Connect, importing old quotes from CSV/Excel/PDF, public API and Zapier"],
];

const SUPPORT_SYSTEM_PROMPT = [
  "You are QuoteAI's AI support assistant. QuoteAI is a web platform for tradespeople and construction businesses in Canada that turns a plain-language job description into a detailed quote, then handles contracts and e-signature, jobs, invoices and payments.",
  "Reply kindly, professionally and concisely, in the language the user writes in (English or French).",
  "When a question is covered by a help-centre guide, answer briefly and link the guide as https://quoteai.ca/help/<slug>/ . Do not invent product behaviour that is not in the guide list; if unsure, say so and offer a human agent.",
  "Guides (slug — topics): " + HELP_GUIDES.map(([slug, topic]) => `${slug} — ${topic}`).join("; ") + ".",
  "If the user explicitly asks to speak with an agent or a person, or asks about payments, their account, legal questions or technical bugs, tell them they can request a human agent by clicking the button in the chat, or that typing 'talk to an agent' will put them in the queue for human follow-up.",
].join(" ");

const router = Router();

const MAX_MESSAGE_LENGTH = 4000;
const MAX_VISITOR_FIELD_LENGTH = 200;

// Conversations are opened by unauthenticated widget visitors, so ownership
// can't rely on a session. Instead each conversation gets a stateless HMAC
// token (derived from its id + BETTER_AUTH_SECRET) handed back on creation;
// the widget stores it and must present it on every subsequent call. Admins
// bypass the token check via their own session (isAdmin), since they need to
// reach any conversation.
function conversationToken(convId: number): string {
  const secret = process.env.BETTER_AUTH_SECRET || "";
  return crypto.createHmac("sha256", secret).update(String(convId)).digest("hex").slice(0, 32);
}

function getRequestToken(req: Request): string | undefined {
  const header = req.headers["x-conversation-token"];
  if (typeof header === "string") return header;
  if (Array.isArray(header)) return header[0];
  const query = req.query.token;
  return typeof query === "string" ? query : undefined;
}

// Guards the visitor-facing conversation routes: an authenticated admin may
// always proceed; otherwise the caller must present the token issued when
// the conversation was created.
async function requireConversationAccess(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const convId = parseInt(req.params.id);
  if (isNaN(convId)) {
    res.status(400).json({ error: "Invalid conversation ID" });
    return;
  }

  if (await isAdmin(req)) {
    next();
    return;
  }

  const provided = getRequestToken(req);
  const expected = conversationToken(convId);
  const providedBuf = Buffer.from(provided || "");
  const expectedBuf = Buffer.from(expected);
  const valid =
    provided !== undefined &&
    providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!valid) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

// Widget chat is fully unauthenticated public traffic — anyone can open a
// conversation and trigger an AI completion per message, so both are capped
// per-IP. Limits are generous enough for a real visitor conversation.
const createConversationLimiter = ipRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: "Too many requests. Please try again in a few minutes.",
});

const sendMessageLimiter = ipRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many messages sent. Please try again later.",
});

// --- Admin status endpoints ---

router.get("/support/admin-status", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "admin_online"));
    const online = row ? row.value === "true" : false;
    res.json({ online });
  } catch (err) {
    logger.error({ err }, "Failed to get admin online status");
    res.json({ online: false });
  }
});

router.post("/support/admin-status", requireAdmin, async (req, res) => {
  try {
    const body = z.object({ online: z.boolean() }).safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "online (boolean) is required" });
      return;
    }
    const { online } = body.data;
    const value = online ? "true" : "false";

    await db
      .insert(settingsTable)
      .values({ key: "admin_online", value })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value },
      });

    res.json({ success: true, online });
  } catch (err) {
    logger.error({ err }, "Failed to update admin online status");
    res.status(500).json({ error: "Failed to update admin online status" });
  }
});

// --- Conversations endpoints ---

// Start conversation (Visitor)
router.post("/support/conversations", createConversationLimiter, async (req, res) => {
  try {
    const visitorField = z.string().transform((s) => s.slice(0, MAX_VISITOR_FIELD_LENGTH)).nullish();
    const body = z.object({ visitorName: visitorField, visitorEmail: visitorField, visitorPhone: visitorField }).safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid visitor details" });
      return;
    }
    const { visitorName, visitorEmail, visitorPhone } = body.data;

    const dateStr = new Date().toLocaleDateString("en-CA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const [newConv] = await db
      .insert(conversations)
      .values({
        title: `Chat ${visitorName || "Visitor"} (${dateStr})`,
        visitorName: visitorName || null,
        visitorEmail: visitorEmail || null,
        visitorPhone: visitorPhone || null,
        ipAddress: req.ip || null,
        userAgent: (Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"])?.slice(0, 500) || null,
        status: "ai",
      })
      .returning();

    res.json({ ...newConv, token: conversationToken(newConv.id) });
  } catch (err) {
    logger.error({ err }, "Failed to start support conversation");
    res.status(500).json({ error: "Failed to start support conversation" });
  }
});

// List conversations (Admin only)
router.get("/support/conversations", requireAdmin, async (_req, res) => {
  try {
    const list = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));
    res.json(list);
  } catch (err) {
    logger.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

// Get messages (Visitor or Admin)
router.get("/support/conversations/:id/messages", requireConversationAccess, async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const messagesList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(asc(messages.createdAt));

    res.json(messagesList);
  } catch (err) {
    logger.error({ err }, "Failed to get messages");
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// Send message
router.post("/support/conversations/:id/messages", sendMessageLimiter, requireConversationAccess, async (req, res) => {
  try {
    const convId = parseInt(String(req.params.id));
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const body = z.object({ content: z.string().min(1), role: z.string().max(20).optional() }).safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Role and content are required" });
      return;
    }
    const { content } = body.data;
    // The caller may only claim to be an admin if they actually authenticated
    // as one (checked by requireConversationAccess) — every other sender is
    // forced to "user", regardless of what the request body asks for.
    const role = body.data.role === "admin" && (await isAdmin(req)) ? "admin" : "user";
    if (content.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Message too long (maximum ${MAX_MESSAGE_LENGTH} characters).` });
      return;
    }

    // 1. Fetch current conversation to check status
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, convId));

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // 2. Insert the sender's message
    const [userMsg] = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role,
        content,
      })
      .returning();

    // Update the conversation's updatedAt timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    // 3. If sent by user and status is 'ai', trigger AI response
    if (role === "user" && conv.status === "ai") {
      // Check if user is asking for a human agent explicitly
      const humanKeywords = ["operatore", "umano", "parlare con qualcuno", "persona", "assistenza umana", "human", "agent", "supporto umano", "aiuto reale"];
      const requestHuman = humanKeywords.some(k => content.toLowerCase().includes(k));

      if (requestHuman) {
        // Change conversation status to human_needed
        await db
          .update(conversations)
          .set({ status: "human_needed" })
          .where(eq(conversations.id, convId));

        // Insert notification message from system/assistant
        const [systemMsg] = await db
          .insert(messages)
          .values({
            conversationId: convId,
            role: "assistant",
            content: "I've forwarded your request to speak with a human agent. As soon as one is online, they'll reply here.",
          })
          .returning();

        res.json({ userMessage: userMsg, aiMessage: systemMsg, status: "human_needed" });
        return;
      }

      // Screen the message before it reaches the assistant model, so a
      // prompt-injection or abuse payload can't influence this turn's reply.
      const moderation = await moderateSupportMessage(content);
      if (moderation.violation) {
        logger.warn({ convId, category: moderation.category, rationale: moderation.rationale }, "Support chat message blocked by moderation");
        const [blockedMsg] = await db
          .insert(messages)
          .values({
            conversationId: convId,
            role: "assistant",
            content: "Your message doesn't comply with the chat guidelines and can't be processed. Please rephrase your request or ask for a human agent.",
          })
          .returning();
        res.json({ userMessage: userMsg, aiMessage: blockedMsg, status: "ai" });
        return;
      }

      // Otherwise generate AI response using OpenAI (mapped to Groq)
      try {
        // Get chat history for context
        const history = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, convId))
          .orderBy(asc(messages.createdAt));

        const formattedMessages = [
          {
            role: "system" as const,
            content: SUPPORT_SYSTEM_PROMPT,
          },
          ...history.map(m => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          })),
        ];

        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini", // Auto-mapped to openai/gpt-oss-20b on Groq
          messages: formattedMessages,
          max_tokens: 350,
          temperature: 0.7,
        });

        const aiContent = aiResponse.choices[0]?.message?.content || "Sorry, something went wrong generating a response.";

        const [aiMsg] = await db
          .insert(messages)
          .values({
            conversationId: convId,
            role: "assistant",
            content: aiContent,
          })
          .returning();

        res.json({ userMessage: userMsg, aiMessage: aiMsg, status: "ai" });
      } catch (aiErr) {
        logger.error({ err: aiErr }, "Failed to generate support bot response");
        const [fallbackMsg] = await db
          .insert(messages)
          .values({
            conversationId: convId,
            role: "assistant",
            content: "I'm having some trouble responding right now. If you need immediate help, you can request a human agent by clicking the button above.",
          })
          .returning();
        res.json({ userMessage: userMsg, aiMessage: fallbackMsg, status: "ai" });
      }
    } else {
      // Conversation status is already human_needed, human_active, closed, or admin is posting
      let newStatus = conv.status;
      if (role === "admin" && conv.status !== "human_active") {
        newStatus = "human_active";
        await db
          .update(conversations)
          .set({ status: "human_active" })
          .where(eq(conversations.id, convId));
      }
      res.json({ userMessage: userMsg, status: newStatus });
    }
  } catch (err) {
    logger.error({ err }, "Failed to send message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Request Human
router.post("/support/conversations/:id/request-human", requireConversationAccess, async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    await db
      .update(conversations)
      .set({ status: "human_needed", updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    const [systemMsg] = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role: "assistant",
        content: "Human agent requested. Please stay put, an agent will join as soon as possible.",
      })
      .returning();

    res.json({ success: true, systemMessage: systemMsg });
  } catch (err) {
    logger.error({ err }, "Failed to request human support");
    res.status(500).json({ error: "Failed to request human support" });
  }
});

// Join conversation (Admin only)
router.post("/support/conversations/:id/join", requireAdmin, async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    await db
      .update(conversations)
      .set({ status: "human_active", updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    const [systemMsg] = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role: "assistant",
        content: "A QuoteAI agent has joined the chat and will take care of your request.",
      })
      .returning();

    res.json({ success: true, systemMessage: systemMsg });
  } catch (err) {
    logger.error({ err }, "Failed to join support conversation");
    res.status(500).json({ error: "Failed to join support conversation" });
  }
});

// Close conversation
router.post("/support/conversations/:id/close", requireConversationAccess, async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    await db
      .update(conversations)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    const [systemMsg] = await db
      .insert(messages)
      .values({
        conversationId: convId,
        role: "assistant",
        content: "This chat session has been closed. Thanks for reaching out!",
      })
      .returning();

    res.json({ success: true, systemMessage: systemMsg });
  } catch (err) {
    logger.error({ err }, "Failed to close support conversation");
    res.status(500).json({ error: "Failed to close support conversation" });
  }
});

export default router;
