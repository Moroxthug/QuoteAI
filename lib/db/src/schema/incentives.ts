import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const incentivesCatalogTable = pgTable("incentives_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"), // null if a system-wide (federal/provincial) program, set if a partner contractor's own custom program
  level: text("level", { enum: ["federal", "provincial", "municipal", "utility"] }).notNull().default("federal"),
  codice: text("codice").notNull(), // e.g. 'CGHAP', 'OHPA', 'ON_HOME_RENO_SAVINGS', 'QC_RENOCLIMAT'
  titolo: text("titolo").notNull(),
  descrizione: text("descrizione").notNull(),
  province: text("province"), // e.g. 'ON', 'QC', or null if federal/nationwide
  city: text("city"), // or null if federal/provincial
  categoriaIntervento: text("categoria_intervento").notNull().default("all"), // 'all' | 'energy_efficiency' | 'heat_pump' | 'insulation' | 'windows_doors' | 'accessibility' | 'general_renovation'
  tipoAgevolazione: text("tipo_agevolazione").notNull().default("rebate"), // 'rebate' | 'direct_grant' | 'tax_credit' | 'no_cost_direct_install' | 'low_interest_loan'
  percentualeMassima: numeric("percentuale_massima", { precision: 5, scale: 2 }), // % of cost covered, if applicable (null if a flat amount instead)
  massimaleSpesa: numeric("massimale_spesa", { precision: 12, scale: 2 }), // eligible-spend cap, if any
  massimaleContributo: numeric("massimale_contributo", { precision: 12, scale: 2 }), // max grant/rebate amount
  requisitiIseeMax: numeric("requisiti_isee_max", { precision: 10, scale: 2 }), // max household income threshold, if income-tested (null otherwise)
  incomeTested: boolean("income_tested").notNull().default(false), // true for programs like CGHAP/OHPA that require low/moderate household income
  scadenza: timestamp("scadenza", { withTimezone: true }), // application-window deadline, or null if ongoing/structural
  stato: text("stato", { enum: ["active", "expiring_soon", "closed"] }).notNull().default("active"),
  fonteUfficialeUrl: text("fonte_ufficiale_url"),
  isVerifiedByAi: boolean("is_verified_by_ai").notNull().default(true), // outcome of the last AI freshness-check cron run (not a legal/eligibility guarantee)
  humanVerified: boolean("human_verified").notNull().default(false), // true only once an admin has manually checked the official source
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIncentivesCatalogSchema = createInsertSchema(incentivesCatalogTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIncentiveCatalogItem = z.infer<typeof insertIncentivesCatalogSchema>;
export type IncentiveCatalogItem = typeof incentivesCatalogTable.$inferSelect;
