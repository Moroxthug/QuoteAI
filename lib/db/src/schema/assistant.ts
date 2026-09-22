import { pgTable, text, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./crm";

// ── Phase 5: job assistant ───────────────────────────────────────────────────
// One conversation per (user, job) — or company-wide when project_id is null.
// The model only *proposes* writes: every propose_* tool call becomes an
// `assistant_proposals` row that the user confirms or dismisses from a card.

export const ASSISTANT_ROLES = ["user", "assistant", "tool"] as const;
export type AssistantRole = (typeof ASSISTANT_ROLES)[number];

export const PROPOSAL_KINDS = ["cost_entry", "milestone_update", "task", "invoice", "record_payment", "send_invoice", "change_order", "job_note"] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const PROPOSAL_STATUSES = ["pending", "confirmed", "dismissed", "failed"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type AssistantToolCall = { id: string; name: string; arguments: string };

export const assistantConversationsTable = pgTable(
  "assistant_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("assistant_conversations_user_idx").on(t.userId, t.projectId)],
);

export const assistantMessagesTable = pgTable(
  "assistant_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull().references(() => assistantConversationsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ASSISTANT_ROLES }).notNull(),
    content: text("content").notNull().default(""),
    /** Assistant turn: the tool calls the model requested. */
    toolCalls: jsonb("tool_calls").$type<AssistantToolCall[] | null>(),
    /** Tool turn: the call this message answers. */
    toolCallId: text("tool_call_id"),
    toolName: text("tool_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistant_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const assistantProposalsTable = pgTable(
  "assistant_proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull().references(() => assistantConversationsTable.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => assistantMessagesTable.id, { onDelete: "set null" }),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: PROPOSAL_KINDS }).notNull(),
    /** Human-readable one-liner shown on the card. */
    summary: text("summary").notNull().default(""),
    /** Validated tool arguments (shape depends on `kind`). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status", { enum: PROPOSAL_STATUSES }).notNull().default("pending"),
    /** Entity created/changed when confirmed (e.g. "invoice", "cost_entry"). */
    resultEntityType: text("result_entity_type"),
    resultEntityId: text("result_entity_id"),
    error: text("error"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistant_proposals_conversation_idx").on(t.conversationId, t.status)],
);

export type AssistantConversation = typeof assistantConversationsTable.$inferSelect;
export type AssistantMessage = typeof assistantMessagesTable.$inferSelect;
export type AssistantProposal = typeof assistantProposalsTable.$inferSelect;
