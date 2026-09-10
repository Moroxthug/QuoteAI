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
  sourceDocumentId: uuid("source_document_id").references(
    () => uploadedDocumentsTable.id,
    { onDelete: "cascade" }
  ),
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
  note: z.string().nullable().optional(),
});

export type UploadedDocument = typeof uploadedDocumentsTable.$inferSelect;
export type PriceIntelligenceItem = typeof priceIntelligenceTable.$inferSelect;
export type ExtractedDocumentData = z.infer<typeof extractedDocumentDataSchema>;
