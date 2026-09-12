import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { quotesTable } from "./quotes";
import { clientsTable } from "./clients";
import type { PaymentSchedule } from "./payment-schedule";

// ── Contract document model ──────────────────────────────────────────────────
// A contract is a list of sections. Legal sections come from the province
// template and are locked; "ai" sections (scope, schedule) are drafted from
// the quote and editable; "data" sections are rendered from `variables`
// (price table, payment schedule, parties) and cannot be edited by hand.

export const contractSectionSchema = z.object({
  key: z.string().min(1).max(60),
  heading: z.string().max(200),
  /** Markdown-lite: blank-line paragraphs, "- " bullets, **bold**. Empty for data sections. */
  body: z.string().max(20000),
  kind: z.enum(["legal", "ai", "data"]),
  editable: z.boolean(),
});
export type ContractSection = z.infer<typeof contractSectionSchema>;

export const contractDocumentSchema = z.object({
  templateKey: z.string(), // ON | BC | AB | QC | CA (generic)
  templateVersion: z.number().int(),
  language: z.enum(["en", "fr"]),
  title: z.string(),
  sections: z.array(contractSectionSchema),
});
export type ContractDocument = z.infer<typeof contractDocumentSchema>;

export type ContractParty = {
  name: string;
  legalName?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  email?: string;
  phone?: string;
  businessNumber?: string; // GST/HST or BN
  licenceNumber?: string;
};

export type ContractPriceLine = { label: string; amount: number };

export type ContractVariables = {
  contractNumber: string;
  quoteNumber: string;
  contractor: ContractParty;
  customer: ContractParty;
  siteAddress: string;
  province: string;
  projectTitle: string;
  /** Pre-tax price lines (one per quote chapter) */
  priceLines: ContractPriceLine[];
  discount: { percent: number; amount: number } | null;
  subtotal: number;
  taxLines: { code: string; label: string; rate: number; amount: number }[];
  taxTotal: number;
  total: number;
  paymentSchedule: PaymentSchedule;
  startDate: string | null; // ISO date
  estimatedDurationWeeks: number | null;
  warrantyMonths: number;
  /** For QC contracts written in English: the customer expressly asked for English. */
  englishRequestedInQuebec: boolean;
  /** Signed at the customer's home → cooling-off notice applies. */
  directAgreement: boolean;
};

export const CONTRACT_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "signed",
  "declined",
  "voided",
  "expired",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const contractsTable = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    quoteId: uuid("quote_id").references(() => quotesTable.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
    /** Set in Phase 2 once the job is created. Plain uuid (no FK) to avoid a schema cycle with crm.ts. */
    projectId: uuid("project_id"),
    contractNumber: text("contract_number").notNull(),
    status: text("status", { enum: CONTRACT_STATUSES }).notNull().default("draft"),
    province: text("province").notNull(),
    language: text("language", { enum: ["en", "fr"] }).notNull().default("en"),
    templateKey: text("template_key").notNull(),
    document: jsonb("document").$type<ContractDocument>().notNull(),
    variables: jsonb("variables").$type<ContractVariables>().notNull(),
    contractValueCents: integer("contract_value_cents").notNull().default(0), // total incl. tax
    holdbackEnabled: boolean("holdback_enabled").notNull().default(false),
    holdbackPercent: integer("holdback_percent").notNull().default(10),
    /** SHA-256 of the unsigned PDF generated at send time (what the customer saw). */
    unsignedPdfHash: text("unsigned_pdf_hash"),
    unsignedPdfUrl: text("unsigned_pdf_url"),
    signedPdfHash: text("signed_pdf_hash"),
    signedPdfUrl: text("signed_pdf_url"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    reminderCount: integer("reminder_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("contracts_user_idx").on(t.userId, t.createdAt),
    index("contracts_quote_idx").on(t.quoteId),
    index("contracts_status_idx").on(t.status, t.sentAt),
  ],
);

export const contractSignersTable = pgTable(
  "contract_signers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contractId: uuid("contract_id").notNull().references(() => contractsTable.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["contractor", "customer"] }).notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    /** SHA-256 of the raw signing token in the emailed link (customer only). */
    tokenHash: text("token_hash"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    status: text("status", { enum: ["pending", "viewed", "verified", "signed", "declined"] }).notNull().default("pending"),
    otpHash: text("otp_hash"),
    otpExpiresAt: timestamp("otp_expires_at", { withTimezone: true }),
    otpAttempts: integer("otp_attempts").notNull().default(0),
    otpVerifiedAt: timestamp("otp_verified_at", { withTimezone: true }),
    signatureType: text("signature_type", { enum: ["drawn", "typed"] }),
    /** PNG data URL for drawn signatures; the typed name for typed ones. */
    signatureData: text("signature_data"),
    consentText: text("consent_text"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    declineReason: text("decline_reason"),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contract_signers_contract_idx").on(t.contractId),
    uniqueIndex("contract_signers_token_idx").on(t.tokenHash),
  ],
);

export const contractEventsTable = pgTable(
  "contract_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contractId: uuid("contract_id").notNull().references(() => contractsTable.id, { onDelete: "cascade" }),
    signerId: uuid("signer_id").references(() => contractSignersTable.id, { onDelete: "set null" }),
    type: text("type").notNull(), // created | edited | contractor_signed | sent | viewed | otp_sent | otp_verified | signed | completed | declined | voided | expired | reminder_sent
    actor: text("actor").notNull(), // contractor | customer | system
    detail: jsonb("detail").$type<Record<string, unknown> | null>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contract_events_contract_idx").on(t.contractId, t.createdAt)],
);

export const contractSequencesTable = pgTable("contract_sequences", {
  userId: text("user_id").primaryKey(),
  next: integer("next").notNull().default(1),
});

export type Contract = typeof contractsTable.$inferSelect;
export type ContractSigner = typeof contractSignersTable.$inferSelect;
export type ContractEvent = typeof contractEventsTable.$inferSelect;
