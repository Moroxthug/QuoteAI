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
  userId: text("user_id"), // null se globale (statale/regionale di sistema), valorizzato se bando custom di una specifica impresa partner
  level: text("level", { enum: ["statale", "regionale", "comunale"] }).notNull().default("statale"),
  codice: text("codice").notNull(), // es. 'BONUS_CASA_50', 'ECOBONUS_65', 'LOMBARDIA_EFF_2026', 'MILANO_FACCIATE'
  titolo: text("titolo").notNull(),
  descrizione: text("descrizione").notNull(),
  province: text("province"), // es. 'ON', 'QC', o null se statale
  city: text("city"), // es. 'Toronto', 'Montreal', o null se statale/regionale
  categoriaIntervento: text("categoria_intervento").notNull().default("tutti"), // 'tutti' | 'ristrutturazione' | 'bagno' | 'elettrico' | 'idraulico' | 'completa' | 'cartongesso' | 'pavimenti' | 'tinteggiatura'
  tipoAgevolazione: text("tipo_agevolazione").notNull().default("detrazione_10_anni"), // 'detrazione_10_anni' | 'conto_termico_gse' | 'fondo_perduto' | 'sconto_fattura' | 'iva_agevolata'
  percentualeMassima: numeric("percentuale_massima", { precision: 5, scale: 2 }).notNull().default("50.00"), // es. 50.00, 65.00, 75.00
  massimaleSpesa: numeric("massimale_spesa", { precision: 12, scale: 2 }), // es. 96000.00
  massimaleContributo: numeric("massimale_contributo", { precision: 12, scale: 2 }), // es. 5000.00 (per fondo perduto)
  requisitiIseeMax: numeric("requisiti_isee_max", { precision: 10, scale: 2 }), // es. 30000.00 o null
  scadenza: timestamp("scadenza", { withTimezone: true }), // data o null se bonus strutturale
  stato: text("stato", { enum: ["active", "expiring_soon", "closed"] }).notNull().default("active"),
  fonteUfficialeUrl: text("fonte_ufficiale_url"),
  isVerifiedByAi: boolean("is_verified_by_ai").notNull().default(true), // esito dell'ultimo controllo euristico del cron AI (non è una validazione legale)
  humanVerified: boolean("human_verified").notNull().default(false), // true solo se un admin ha controllato la fonte ufficiale a mano
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
