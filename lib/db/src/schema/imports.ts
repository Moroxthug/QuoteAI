import { pgTable, text, uuid, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

// ── Phase 14: data migration / import ────────────────────────────────────────
// A company brings in historical quotes from a spreadsheet or old PDFs.
// Nothing becomes a real `quotes` row until a human confirms the candidate —
// same trust pattern as the receipt-review queue (Phase 3), just for quotes.

export const IMPORT_BATCH_KINDS = ["csv", "xlsx", "pdf"] as const;
export type ImportBatchKind = (typeof IMPORT_BATCH_KINDS)[number];

export const IMPORT_BATCH_STATUSES = ["processing", "done", "error"] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export const IMPORT_CANDIDATE_STATUSES = ["pending_review", "confirmed", "rejected"] as const;
export type ImportCandidateStatus = (typeof IMPORT_CANDIDATE_STATUSES)[number];

export const importBatchesTable = pgTable("import_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind", { enum: IMPORT_BATCH_KINDS }).notNull(),
  fileName: text("file_name").notNull(),
  status: text("status", { enum: IMPORT_BATCH_STATUSES }).notNull().default("processing"),
  totalRows: integer("total_rows").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  userIdx: index("import_batches_user_idx").on(t.userId),
}));

export type ImportedQuoteItem = { description: string; quantity: number | null; unitPrice: number | null; total: number | null };

/** Normalized shape produced by both the CSV/XLSX column mapper and the AI PDF reader. */
export type ImportedQuoteExtraction = {
  clientName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  date: string | null; // YYYY-MM-DD
  status: "draft" | "accepted"; // imported historical quotes only ever land as one of these two
  items: ImportedQuoteItem[];
  total: number | null;
  notes: string | null;
  confidence: "high" | "medium" | "low";
};

export const quoteImportCandidatesTable = pgTable("quote_import_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id").notNull().references(() => importBatchesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  rowIndex: integer("row_index").notNull().default(0),
  status: text("status", { enum: IMPORT_CANDIDATE_STATUSES }).notNull().default("pending_review"),
  rawRow: jsonb("raw_row").$type<Record<string, string> | null>(),
  extraction: jsonb("extraction").$type<ImportedQuoteExtraction>().notNull(),
  matchedClientId: uuid("matched_client_id"),
  createdQuoteId: uuid("created_quote_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
}, (t) => ({
  batchIdx: index("quote_import_candidates_batch_idx").on(t.batchId),
  userStatusIdx: index("quote_import_candidates_user_status_idx").on(t.userId, t.status),
}));

export const importedQuoteItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  total: z.number().nullable(),
});

export const importedQuoteExtractionSchema = z.object({
  clientName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  postalCode: z.string().nullable(),
  date: z.string().nullable(),
  status: z.enum(["draft", "accepted"]),
  items: z.array(importedQuoteItemSchema),
  total: z.number().nullable(),
  notes: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type ImportBatch = typeof importBatchesTable.$inferSelect;
export type QuoteImportCandidate = typeof quoteImportCandidatesTable.$inferSelect;
