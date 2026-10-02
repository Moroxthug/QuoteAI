import { pgTable, text, uuid, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

// Pocket 128.1 (AssistantProposals, AssistantActivity, AssistantPermissions): what the assistant suggests for the whole company, what it did, and
// how much it may do on its own. (The job assistant's chat proposals are in ./assistant.ts and are not these.)

export const COMPANY_SUGGESTION_KINDS = ["reminder", "order", "move", "followup"] as const;
export type CompanySuggestionKind = (typeof COMPANY_SUGGESTION_KINDS)[number];
export const COMPANY_SUGGESTION_STATUSES = ["pending", "approved", "dismissed", "failed"] as const;
export type CompanySuggestionStatus = (typeof COMPANY_SUGGESTION_STATUSES)[number];

/** The facts a card shows: the draft of a message, the lines of an order, or the two days of a move, and what the "Why" line is built from. */
export type SuggestionPayload = {
  /** reminder, followup */
  channel?: "sms" | "email";
  to?: string;
  toName?: string;
  subject?: string;
  draft?: string;
  language?: "en" | "fr";
  invoiceId?: string;
  number?: string;
  balanceCents?: number;
  daysLate?: number;
  quoteId?: string;
  totalCents?: number;
  daysSent?: number;
  /** order */
  supplierId?: string;
  supplierName?: string;
  lines?: { itemId: string | null; name: string; unit: string; qty: number; unitPriceCents: number | null }[];
  destination?: string;
  overLimit?: boolean;
  /** move */
  blockId?: string;
  blockTitle?: string;
  jobName?: string;
  from?: string;
  moveTo?: string;
};

export const assistantSuggestionsTable = pgTable(
  "assistant_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The company (business_profiles.user_id). */
    userId: text("user_id").notNull(),
    /** What the suggestion is about, so it is made once: "reminder:<invoice id>", "order:<item id>". */
    key: text("key").notNull(),
    kind: text("kind", { enum: COMPANY_SUGGESTION_KINDS }).notNull(),
    /** What the card says: the facts, not sentences (the phone writes the sentences in its language). */
    payload: jsonb("payload").$type<SuggestionPayload>().notNull().default({}),
    status: text("status", { enum: COMPANY_SUGGESTION_STATUSES }).notNull().default("pending"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("assistant_suggestions_key_idx").on(t.userId, t.key), index("assistant_suggestions_status_idx").on(t.userId, t.status)],
);

export const ASSISTANT_ACTIVITY_UNDO = ["none", "undo", "void", "open"] as const;
export type AssistantActivityUndo = (typeof ASSISTANT_ACTIVITY_UNDO)[number];
export type ActivityUndoData = { entity?: "cost" | "payment" | "block" | "order"; id?: string; was?: string; invoiceId?: string };

export const assistantActivityTable = pgTable(
  "assistant_activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** The board's glyph and tone follow the kind. */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    /** The facts the line is written from (client, number, supplier...), so the phone writes it in its own language; title and detail are the English fallback. */
    params: jsonb("params").$type<Record<string, string | number>>().notNull().default({}),
    /** The person who asked (their name) or, for an automatic action, the rule ("Receipts", "Invoice reminders"). */
    who: text("who").notNull().default(""),
    whoKind: text("who_kind", { enum: ["you", "auto"] }).notNull().default("auto"),
    category: text("category", { enum: ["msg", "money", "jobs"] }).notNull().default("jobs"),
    undo: text("undo", { enum: ASSISTANT_ACTIVITY_UNDO }).notNull().default("none"),
    undoData: jsonb("undo_data").$type<ActivityUndoData>().notNull().default({}),
    /** What the row says it came to: sent, opened, undone, voided. */
    word: text("word").notNull().default(""),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
  },
  (t) => [index("assistant_activity_user_idx").on(t.userId, t.at)],
);

/** 0 asks first, 1 does it and tells, 2 is off. */
export type AssistantLevel = 0 | 1 | 2;
export type AssistantLevels = { followups: AssistantLevel; reminders: AssistantLevel; receipts: AssistantLevel; scheduling: AssistantLevel; crew: AssistantLevel };
export const RECOMMENDED_LEVELS: AssistantLevels = { followups: 0, reminders: 1, receipts: 1, scheduling: 0, crew: 1 };

export const assistantSettingsTable = pgTable("assistant_settings", {
  /** The company. */
  userId: text("user_id").primaryKey(),
  levels: jsonb("levels").$type<Partial<AssistantLevels>>().notNull().default({}),
  /** Orders above this always ask first. */
  spendLimitCents: integer("spend_limit_cents").notNull().default(30000),
  quietHours: text("quiet_hours", { enum: ["on", "off"] }).notNull().default("on"),
  /** Minutes after midnight. */
  quietFrom: integer("quiet_from").notNull().default(20 * 60),
  quietUntil: integer("quiet_until").notNull().default(7 * 60),
  quietSunday: text("quiet_sunday", { enum: ["on", "off"] }).notNull().default("on"),
  readBack: text("read_back", { enum: ["on", "off"] }).notNull().default("on"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AssistantSuggestion = typeof assistantSuggestionsTable.$inferSelect;
export type AssistantActivityRow = typeof assistantActivityTable.$inferSelect;
export type AssistantSettings = typeof assistantSettingsTable.$inferSelect;
