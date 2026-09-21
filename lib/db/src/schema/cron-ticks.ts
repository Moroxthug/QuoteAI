import { pgTable, uuid, timestamp, boolean, jsonb, text, integer, index } from "drizzle-orm/pg-core";

// ── Cron ticks (Phase 69) ────────────────────────────────────────────────────
// One row per /api/cron/tick invocation. `ok` stays NULL while a tick is
// running (or if the function died mid-tick). /api/healthz/ops reads the last
// successful row to decide whether the scheduler is stale.

export const cronTicksTable = pgTable(
  "cron_ticks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ok: boolean("ok"),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    error: text("error"),
    tookMs: integer("took_ms"),
  },
  (t) => [index("cron_ticks_started_idx").on(t.startedAt)],
);

export type CronTick = typeof cronTicksTable.$inferSelect;
