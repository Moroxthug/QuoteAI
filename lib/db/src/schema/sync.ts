import { pgTable, bigserial, text, integer, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

// ── Sync (Phase 117, docs/APP-PLAN.md "Sync II") ─────────────────────────────

/**
 * One row per `Idempotency-Key` a mutating request carried. The first request
 * claims the key (response_status NULL while it runs); when it finishes with
 * a status below 500 its answer is stored, and a replay with the same key gets
 * that answer back instead of doing the work twice. A 5xx (or a request that
 * died) releases the key so the retry runs again. Pruned after 7 days.
 */
export const idempotencyKeysTable = pgTable(
  "idempotency_keys",
  {
    key: text("key").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    /** sha256 of the JSON body, so the same key with a different body is refused (422), not replayed. */
    fingerprint: text("fingerprint"),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idempotency_keys_key_idx").on(t.key, t.method, t.path), index("idempotency_keys_created_idx").on(t.createdAt)],
);

/**
 * The per-company change feed. Written by the `qai_log_change()` trigger on
 * the tables the app shows (jobs, milestones, tasks, notes, photos, costs,
 * time, quotes, clients, invoices, contracts, schedule, leads, field reports,
 * change orders) — so a write from anywhere (the app, a crew link, a client
 * accepting a quote, an automation) is in it. Carries ids only, never
 * content: GET /api/changes tells each open app what to refetch. Pruned after
 * 2 days; a cursor older than that gets `reset` (refetch everything shown).
 */
export const changeLogTable = pgTable(
  "change_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** The company (business_profiles.user_id). */
    orgId: text("org_id").notNull(),
    /** job | milestone | task | note | photo | cost | time | quote | client | invoice | contract | schedule | lead | report | change_order */
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    /** The job (or quote) the row hangs off, when it has one. */
    parentId: text("parent_id"),
    /** insert | update | delete */
    op: text("op").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("change_log_org_idx").on(t.orgId, t.id), index("change_log_at_idx").on(t.at)],
);

export type ChangeLogRow = typeof changeLogTable.$inferSelect;
