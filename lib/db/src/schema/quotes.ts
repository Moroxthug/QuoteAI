import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  jsonb,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { randomUUID } from "crypto";
import { clientsTable } from "./clients";
import type { PaymentSchedule } from "./payment-schedule";

export const quoteItemSchema = z.object({
  descrizione: z.string(),
  quantita: z.number(),
  unita: z.string(),
  prezzoUnitario: z.number(),
  totale: z.number(),
});

export const quoteClientDataSchema = z.object({
  nome: z.string(),
  indirizzo: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  businessNumber: z.string().optional(),
  partitaIva: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().optional(),
});

export const quoteChapterItemSchema = z.object({
  descrizione: z.string(),
  um: z.string(),
  quantita: z.number(),
  prezzoUnitario: z.number(),
  totale: z.number(),
});

export const quoteChapterSchema = z.object({
  lettera: z.string(),
  titolo: z.string(),
  voci: z.array(quoteChapterItemSchema),
  subtotale: z.number(),
  osservazione: z.string().optional(),
});

export const quoteDiscountSchema = z.object({
  percentuale: z.number(),
  importoScontato: z.number(),
});

export const quoteCompanySnapshotSchema = z.object({
  companyName: z.string(),
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  logoUrl: z.string().optional(),
});

export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type QuoteClientData = z.infer<typeof quoteClientDataSchema>;
export type QuoteChapterItem = z.infer<typeof quoteChapterItemSchema>;
export type QuoteChapter = z.infer<typeof quoteChapterSchema>;
export type QuoteDiscount = z.infer<typeof quoteDiscountSchema>;
export type QuoteCompanySnapshot = z.infer<typeof quoteCompanySnapshotSchema>;

export const quotesTable = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Set when the quote PDF is first emailed to the client — drives Phase 21's follow-up reminder sequence. */
  sentAt: timestamp("sent_at", { withTimezone: true }),
  /** How many follow-up sequence steps have fired; 0 = none sent yet. Mirrors leadsTable's pattern. */
  followUpStage: integer("follow_up_stage").notNull().default(0),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  /** Opaque token for the follow-up unsubscribe link — never the quote id, so the link can't enumerate quotes. */
  unsubscribeToken: text("unsubscribe_token").notNull().$defaultFn(() => randomUUID()),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  userId: text("user_id").notNull(),
  /** Linked client record (Phase 0). Null only for legacy rows that could not be matched. */
  clientId: uuid("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  /** Province the work is performed in (drives tax + contract template). */
  province: text("province"),
  /** Structured payment schedule; null means "derive from condizioniPagamento". */
  paymentSchedule: jsonb("payment_schedule").$type<PaymentSchedule | null>(),
  clientData: jsonb("client_data").$type<QuoteClientData>().notNull().default({ nome: "", indirizzo: "" }),
  descrizioneGenerale: text("descrizione_generale").notNull().default(""),
  items: jsonb("items").$type<QuoteItem[]>().notNull().default([]),
  capitoli: jsonb("capitoli").$type<QuoteChapter[]>().default([]),
  sconto: jsonb("sconto").$type<QuoteDiscount | null>(),
  condizioniPagamento: text("condizioni_pagamento").array().default([]),
  titoloPreventivoRiga1: text("titolo_preventivo_riga1").default("Analisi Economica e Computo Metrico Prezzato"),
  titoloPreventivoRiga2: text("titolo_preventivo_riga2").default(""),
  numeroPreventivoData: text("numero_preventivo_data").default(""),
  companySnapshot: jsonb("company_snapshot").$type<QuoteCompanySnapshot | null>(),
  subtotale: numeric("subtotale", { precision: 10, scale: 2 }).notNull().default("0"),
  ivaPercentuale: numeric("iva_percentuale", { precision: 5, scale: 2 }).notNull().default("22"),
  ivaValore: numeric("iva_valore", { precision: 10, scale: 2 }).notNull().default("0"),
  totale: numeric("totale", { precision: 10, scale: 2 }).notNull().default("0"),
  note: text("note").notNull().default("Preventivo valido 30 giorni"),
  status: text("status", { enum: ["draft", "unlocked", "pending_payment", "accepted"] }).notNull().default("draft"),
  pdfUrl: text("pdf_url"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedByName: text("accepted_by_name"),
  acceptedIp: text("accepted_ip"),
  /** Which variant the client accepted, when the quote has Good/Better/Best variants (Phase 22). Null for single-price quotes or before acceptance. */
  acceptedVariantId: uuid("accepted_variant_id"),
  rawInput: text("raw_input").notNull().default(""),
  stripeSessionId: text("stripe_session_id"),
  unlockedWithPlan: text("unlocked_with_plan"),
  capitolatoPro: boolean("capitolato_pro").notNull().default(false),
  capitolatoPdfUrl: text("capitolato_pdf_url"),
  templateId: text("template_id").default("standard"),
  pdfDownloadedAt: timestamp("pdf_downloaded_at", { withTimezone: true }),
  source: text("source").default("web"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  modelUsed: text("model_used"),
  apiCost: numeric("api_cost", { precision: 10, scale: 6 }),
  /** Phase 47: soft-archive. Set when moved to the Archive view; excluded from list endpoints while set. */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedByName: text("archived_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("quotes_followup_due_idx").on(t.status, t.nextFollowUpAt),
  uniqueIndex("quotes_unsubscribe_token_idx").on(t.unsubscribeToken),
  index("quotes_archived_idx").on(t.userId, t.archivedAt),
]);

export const quoteAttachmentsTable = pgTable("quote_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id").notNull().references(() => quotesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: numeric("file_size", { precision: 15, scale: 0 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Phase 22 — Good/Better/Best tiered quotes. A quote gets 0-3 variant rows; when
 * exactly one (or zero) exist, every downstream code path (PDF, contracts, invoices)
 * keeps reading quotesTable.items/capitoli/totale unchanged. When a customer accepts
 * a specific variant, its pricing fields are copied onto the parent quotesTable row
 * before the accept flow fires, so no downstream consumer needs to know variants exist.
 */
export const quoteVariantsTable = pgTable("quote_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id").notNull().references(() => quotesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  /** Freeform label, typically "Good" / "Better" / "Best" but not constrained to those three. */
  label: text("label").notNull().default(""),
  description: text("description").notNull().default(""),
  /** Display order, 0-based. */
  position: integer("position").notNull().default(0),
  items: jsonb("items").$type<QuoteItem[]>().notNull().default([]),
  capitoli: jsonb("capitoli").$type<QuoteChapter[]>().default([]),
  sconto: jsonb("sconto").$type<QuoteDiscount | null>(),
  condizioniPagamento: text("condizioni_pagamento").array().default([]),
  subtotale: numeric("subtotale", { precision: 10, scale: 2 }).notNull().default("0"),
  ivaPercentuale: numeric("iva_percentuale", { precision: 5, scale: 2 }).notNull().default("22"),
  ivaValore: numeric("iva_valore", { precision: 10, scale: 2 }).notNull().default("0"),
  totale: numeric("totale", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("quote_variants_quote_id_idx").on(t.quoteId),
]);

export const insertQuoteSchema = createInsertSchema(quotesTable).omit({
  id: true,
  unsubscribeToken: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuoteVariantSchema = createInsertSchema(quoteVariantsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotesTable.$inferSelect;
export type QuoteAttachment = typeof quoteAttachmentsTable.$inferSelect;
export type InsertQuoteVariant = z.infer<typeof insertQuoteVariantSchema>;
export type QuoteVariant = typeof quoteVariantsTable.$inferSelect;
