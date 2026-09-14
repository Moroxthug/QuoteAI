import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "processing",
  "done",
  "error",
]);

export const uploadedDocumentsTable = pgTable("uploaded_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type").notNull(),
  fileUrl: text("file_url").notNull(),
  status: documentStatusEnum("status").notNull().default("pending"),
  /** price_intelligence (catalog learning), receipt (Phase 3 cost entry), or import_pdf (Phase 14 old-quote import). */
  purpose: text("purpose", { enum: ["price_intelligence", "receipt", "import_pdf"] }).notNull().default("price_intelligence"),
  /** Job the receipt was uploaded from (plain uuid; crm.ts is not imported here to avoid a cycle). */
  projectId: uuid("project_id"),
  extractedData: jsonb("extracted_data"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const priceIntelligenceTable = pgTable("price_intelligence", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  workType: text("work_type").notNull(),
  unitPrice: text("unit_price").notNull(),
  unit: text("unit"),
  zone: text("zone"),
  /** Supplier/vendor name extracted from the source document, if any — enables cross-supplier comparison (Phase 18). */
  vendor: text("vendor"),
  sourceDocumentId: uuid("source_document_id").references(
    () => uploadedDocumentsTable.id,
    { onDelete: "cascade" }
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceTrendDirectionEnum = pgEnum("price_trend_direction", ["up", "down"]);

/** Phase 18: weekly-cadence price-trend alerts, one row per (userId, workType, zone) trend crossing the threshold. */
export const priceIntelligenceAlertsTable = pgTable("price_intelligence_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  workType: text("work_type").notNull(),
  zone: text("zone"),
  previousAvgPrice: text("previous_avg_price").notNull(),
  currentAvgPrice: text("current_avg_price").notNull(),
  percentChange: text("percent_change").notNull(),
  direction: priceTrendDirectionEnum("direction").notNull(),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const extractedDocumentDataSchema = z.object({
  lavorazioni: z
    .array(
      z.object({
        tipo: z.string(),
        prezzoUnitario: z.number(),
        um: z.string().nullable().optional(),
        zona: z.string().nullable().optional(),
      })
    )
    .nullable()
    .optional(),
  totale: z.number().nullable().optional(),
  zona: z.string().nullable().optional(),
  /** Supplier/vendor/contractor company name issuing the document, if identifiable. */
  fornitore: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export type UploadedDocument = typeof uploadedDocumentsTable.$inferSelect;
export type PriceIntelligenceItem = typeof priceIntelligenceTable.$inferSelect;
export type PriceIntelligenceAlert = typeof priceIntelligenceAlertsTable.$inferSelect;
export type ExtractedDocumentData = z.infer<typeof extractedDocumentDataSchema>;
