// Phase 5 — assistant conversation runner. One turn = user message →
// (model → tool calls → results)* → final answer. Every message is stored;
// propose_* calls become assistant_proposals rows the UI renders as cards.
import { openai, type OpenAI } from "@workspace/integrations-openai-ai-server";
import {
  db,
  assistantConversationsTable,
  assistantMessagesTable,
  assistantProposalsTable,
  projectsTable,
  clientsTable,
  businessProfilesTable,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantProposal,
  type AssistantToolCall,
} from "@workspace/db";
import { and, asc, desc, eq, isNull, inArray } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { toIsoDate } from "../jobs/dates.js";
import { TOOL_DEFINITIONS, PROPOSAL_TOOLS, runReadTool, validateProposal, type ToolContext } from "./tools.js";

export type Lang = "en" | "fr";
const MAX_ROUNDS = 6;
const HISTORY_LIMIT = 40;
const MODEL = "gpt-4o";

// ── Conversations ────────────────────────────────────────────────────────────

export async function getOrCreateConversation(userId: string, projectId: string | null): Promise<AssistantConversation> {
  const where = projectId ? and(eq(assistantConversationsTable.userId, userId), eq(assistantConversationsTable.projectId, projectId)) : and(eq(assistantConversationsTable.userId, userId), isNull(assistantConversationsTable.projectId));
  const [existing] = await db.select().from(assistantConversationsTable).where(where).orderBy(desc(assistantConversationsTable.lastMessageAt)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(assistantConversationsTable).values({ userId, projectId, title: "" }).returning();
  return created!;
}

export async function loadConversation(userId: string, id: string): Promise<{ conversation: AssistantConversation; messages: AssistantMessage[]; proposals: AssistantProposal[] } | null> {
  const [conversation] = await db.select().from(assistantConversationsTable).where(and(eq(assistantConversationsTable.id, id), eq(assistantConversationsTable.userId, userId)));
  if (!conversation) return null;
  const [messages, proposals] = await Promise.all([
    db.select().from(assistantMessagesTable).where(eq(assistantMessagesTable.conversationId, id)).orderBy(asc(assistantMessagesTable.createdAt)).limit(400),
    db.select().from(assistantProposalsTable).where(eq(assistantProposalsTable.conversationId, id)).orderBy(asc(assistantProposalsTable.createdAt)),
  ]);
  return { conversation, messages, proposals };
}

export async function clearConversation(userId: string, id: string): Promise<boolean> {
  const deleted = await db.delete(assistantConversationsTable).where(and(eq(assistantConversationsTable.id, id), eq(assistantConversationsTable.userId, userId))).returning({ id: assistantConversationsTable.id });
  return deleted.length > 0;
}

// ── System prompt ────────────────────────────────────────────────────────────

async function buildSystemPrompt(params: { userId: string; projectId: string | null; language: Lang; now: Date }): Promise<{ prompt: string; province: string | null }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, params.userId));
  const company = profile?.companyName || "the company";
  let province = profile?.province ?? null;
  let jobBlock = "";
  if (params.projectId) {
    const [p] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, params.projectId), eq(projectsTable.userId, params.userId)));
    if (p) {
      province = p.province ?? province;
      const client = p.clientId ? (await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, p.clientId)))[0] : null;
      jobBlock = `\nCurrent job (tools default to it): id ${p.id} — "${p.name}"${client ? ` for ${client.name}` : ""}, status ${p.status}, ${p.progressPercent}% complete, ${toIsoDate(p.plannedStart ?? p.startDate) ?? "?"} → ${toIsoDate(p.plannedEnd ?? p.endDate) ?? "?"}, value ${((p.contractValueCents + p.changeOrdersCents) / 100).toFixed(2)} CAD incl. tax.`;
    }
  }
  const langLine = params.language === "fr" ? "Réponds toujours en français (Canada)." : "Always answer in English (Canada).";
  const prompt = `You are the job assistant inside QuoteAI, a construction management app used by ${company}, a Canadian contractor${province ? ` based in ${province}` : ""}. Today is ${toIsoDate(params.now)}.
${langLine}
${jobBlock}

You help the contractor run jobs: schedule, budget vs costs, hours, invoices and cash. Use the tools to look things up before answering — never guess figures. Amounts are CAD; say whether a figure is before or after tax when it matters.

You cannot change data yourself. When the user asks you to add a cost, complete/start/re-date a milestone, add a task, draft/send an invoice or record a payment, call the matching propose_* tool; it returns a proposal the user confirms from a card in the chat. After proposing, tell the user briefly what the card will do and that nothing happens until they confirm. Never claim something was saved, sent or completed — only that it was proposed. If a proposal tool returns an error, explain it and suggest the closest alternative.

Be concise: short paragraphs or bullet lists, no headings, no filler. When you spot a risk (over budget, late milestone, unbilled work, overdue invoice) mention it once with the number behind it.`;
  return { prompt, province };
}

// ── History → OpenAI messages ────────────────────────────────────────────────

function toOpenAiMessages(rows: AssistantMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  for (const m of rows) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "assistant") {
      if (m.toolCalls && m.toolCalls.length) out.push({ role: "assistant", content: m.content || null, tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.arguments } })) });
      else out.push({ role: "assistant", content: m.content });
    } else if (m.role === "tool" && m.toolCallId) out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
  }
  // A tool message whose assistant turn fell outside the window would break the API — drop leading orphans.
  while (out.length && out[0]!.role === "tool") out.shift();
  return out;
}

// ── Turn ─────────────────────────────────────────────────────────────────────

export type TurnResult = { messages: AssistantMessage[]; proposals: AssistantProposal[] };

export async function runAssistantTurn(params: { conversation: AssistantConversation; userId: string; content: string; language: Lang; now?: Date }): Promise<TurnResult> {
  const now = params.now ?? new Date();
  const conv = params.conversation;
  const newMessages: AssistantMessage[] = [];
  const newProposals: AssistantProposal[] = [];

  const insertMessage = async (values: Omit<typeof assistantMessagesTable.$inferInsert, "conversationId" | "userId">) => {
    const [row] = await db.insert(assistantMessagesTable).values({ conversationId: conv.id, userId: params.userId, ...values }).returning();
    newMessages.push(row!);
    return row!;
  };

  await insertMessage({ role: "user", content: params.content });
  if (!conv.title) await db.update(assistantConversationsTable).set({ title: params.content.slice(0, 80) }).where(eq(assistantConversationsTable.id, conv.id));

  const { prompt, province } = await buildSystemPrompt({ userId: params.userId, projectId: conv.projectId, language: params.language, now });
  const ctx: ToolContext = { userId: params.userId, projectId: conv.projectId, province, now };
  const history = await db.select().from(assistantMessagesTable).where(eq(assistantMessagesTable.conversationId, conv.id)).orderBy(desc(assistantMessagesTable.createdAt)).limit(HISTORY_LIMIT);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: prompt }, ...toOpenAiMessages(history.reverse())];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const lastRound = round === MAX_ROUNDS - 1;
    const completion = await openai.chat.completions.create(
      { model: MODEL, temperature: 0.2, max_completion_tokens: 1200, messages, tools: TOOL_DEFINITIONS, tool_choice: lastRound ? "none" : "auto" },
      { timeout: 45_000 },
    );
    const choice = completion.choices[0]?.message;
    if (!choice) throw new Error("Empty completion");
    const calls = (choice.tool_calls ?? []).filter((c): c is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall => c.type === "function");
    if (!calls.length) {
      const text = (choice.content ?? "").trim() || (params.language === "fr" ? "Je n'ai rien à ajouter." : "Nothing to add.");
      await insertMessage({ role: "assistant", content: text });
      break;
    }
    const stored: AssistantToolCall[] = calls.map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments }));
    const assistantRow = await insertMessage({ role: "assistant", content: choice.content ?? "", toolCalls: stored });
    messages.push({ role: "assistant", content: choice.content ?? null, tool_calls: calls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.function.name, arguments: c.function.arguments } })) });

    for (const call of calls) {
      let args: unknown = {};
      try { args = call.function.arguments ? JSON.parse(call.function.arguments) : {}; } catch { args = {}; }
      let result: unknown;
      const kind = PROPOSAL_TOOLS[call.function.name];
      try {
        if (kind) {
          const v = await validateProposal(call.function.name, args, ctx);
          if (v.ok) {
            const [row] = await db.insert(assistantProposalsTable).values({ conversationId: conv.id, messageId: assistantRow.id, userId: params.userId, projectId: v.proposal.projectId, kind: v.proposal.kind, summary: v.proposal.summary, payload: v.proposal.payload, status: "pending" }).returning();
            newProposals.push(row!);
            result = { proposal_id: row!.id, status: "pending_confirmation", summary: v.proposal.summary, note: "The user sees a card and must confirm. Do not say this was done." };
          } else result = { error: v.error };
        } else {
          result = await runReadTool(call.function.name, args, ctx);
        }
      } catch (err) {
        logger.warn({ err, tool: call.function.name }, "assistant tool failed");
        result = { error: (err as Error).message };
      }
      const content = JSON.stringify(result).slice(0, 24_000);
      await insertMessage({ role: "tool", content, toolCallId: call.id, toolName: call.function.name });
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }

  await db.update(assistantConversationsTable).set({ lastMessageAt: new Date() }).where(eq(assistantConversationsTable.id, conv.id));
  return { messages: newMessages, proposals: newProposals };
}

export async function proposalsByIds(userId: string, ids: string[]): Promise<AssistantProposal[]> {
  if (!ids.length) return [];
  return db.select().from(assistantProposalsTable).where(and(eq(assistantProposalsTable.userId, userId), inArray(assistantProposalsTable.id, ids)));
}
