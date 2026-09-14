import { pgTable, text, timestamp, integer, jsonb, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { randomUUID } from "crypto";
import { clientsTable } from "./clients";
import { quotesTable } from "./quotes";

// ── Phase 9: customer reachout pipeline ─────────────────────────────────────
// See docs/GROWTH-PLATFORM-PLAN.md §Phase 9. A lead is the first-contact
// record — the widget (and any future "contact us" form) writes here first;
// quotes.id is linked after generation instead of being the only entry point.
// CASL requires a recorded consent basis and a working unsubscribe on every
// lead before any automated follow-up message can be sent (see lead_events).

export const LEAD_STATUSES = ["new", "contacted", "quoted", "won", "lost", "unsubscribed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ["widget", "manual", "import"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_CHANNELS = ["email", "sms", "whatsapp"] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

/** CASL requires every automated message to have a recorded, honest consent basis. */
export const LEAD_CONSENT_SOURCES = ["widget_form", "manual_entry", "import", "existing_client"] as const;
export type LeadConsentSource = (typeof LEAD_CONSENT_SOURCES)[number];

export const leadsTable = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    clientId: uuid("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
    quoteId: uuid("quote_id").references(() => quotesTable.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    preferredLanguage: text("preferred_language", { enum: ["en", "fr"] }).notNull().default("en"),
    preferredChannel: text("preferred_channel", { enum: LEAD_CHANNELS }).notNull().default("email"),
    source: text("source", { enum: LEAD_SOURCES }).notNull().default("manual"),
    status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
    consentSource: text("consent_source", { enum: LEAD_CONSENT_SOURCES }).notNull().default("manual_entry"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull().defaultNow(),
    /** Opaque token embedded in the unsubscribe link — never the lead id, so the link can't be used to enumerate/leak leads. */
    unsubscribeToken: text("unsubscribe_token").notNull().$defaultFn(() => randomUUID()),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    /** How many follow-up sequence steps have fired; 0 = none sent yet. */
    followUpStage: integer("follow_up_stage").notNull().default(0),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("leads_user_status_idx").on(t.userId, t.status),
    index("leads_user_created_idx").on(t.userId, t.createdAt),
    index("leads_followup_due_idx").on(t.status, t.nextFollowUpAt),
    uniqueIndex("leads_unsubscribe_token_idx").on(t.unsubscribeToken),
  ],
);

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  unsubscribeToken: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;

// ── Lead events (consent/audit trail + message history) ─────────────────────

export const LEAD_EVENT_TYPES = [
  "created",
  "status_changed",
  "message_sent",
  "message_failed",
  "consent_recorded",
  "unsubscribed",
  "note_added",
] as const;
export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number];

export const leadEventsTable = pgTable(
  "lead_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id").notNull().references(() => leadsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    type: text("type", { enum: LEAD_EVENT_TYPES }).notNull(),
    channel: text("channel", { enum: LEAD_CHANNELS }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lead_events_lead_idx").on(t.leadId, t.createdAt)],
);

export const insertLeadEventSchema = createInsertSchema(leadEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertLeadEvent = z.infer<typeof insertLeadEventSchema>;
export type LeadEvent = typeof leadEventsTable.$inferSelect;
