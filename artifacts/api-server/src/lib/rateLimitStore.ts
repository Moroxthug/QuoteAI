import { MemoryStore, type Options, type Store, type IncrementResponse } from "express-rate-limit";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger.js";

/**
 * Shared rate-limit counters in Postgres (audit B2). On Vercel every function
 * instance has its own memory, so an in-memory limiter of "10 per 15 minutes"
 * is really "10 per 15 minutes per instance". One row per key in
 * `rate_limit_hits`, bumped atomically.
 *
 * If the table is missing (migration 0079 not applied) or the database
 * errors, the store falls back to the in-memory counter for that request and
 * logs once — a limiter outage never blocks sign-in.
 */
export class PostgresRateLimitStore implements Store {
  prefix: string;
  localKeys = false;
  private windowMs = 60_000;
  private readonly fallback = new MemoryStore();
  private static warned = false;

  constructor(prefix: string) {
    this.prefix = `${prefix}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  private warn(err: unknown): void {
    if (PostgresRateLimitStore.warned) return;
    PostgresRateLimitStore.warned = true;
    logger.error({ err }, "Shared rate-limit store unavailable; using per-instance counters");
  }

  async increment(key: string): Promise<IncrementResponse> {
    const k = this.prefix + key;
    try {
      const rows = await db.execute<{ hits: number; reset_at: Date | string }>(sql`
        insert into rate_limit_hits (key, hits, reset_at)
        values (${k}, 1, now() + (${this.windowMs} * interval '1 millisecond'))
        on conflict (key) do update set
          hits = case when rate_limit_hits.reset_at <= now() then 1 else rate_limit_hits.hits + 1 end,
          reset_at = case when rate_limit_hits.reset_at <= now() then excluded.reset_at else rate_limit_hits.reset_at end
        returning hits, reset_at`);
      const row = rows.rows[0];
      if (!row) throw new Error("rate_limit_hits upsert returned no row");
      return { totalHits: Number(row.hits), resetTime: new Date(row.reset_at) };
    } catch (err) {
      this.warn(err);
      return this.fallback.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await db.execute(sql`update rate_limit_hits set hits = greatest(hits - 1, 0) where key = ${this.prefix + key}`);
    } catch (err) {
      this.warn(err);
      this.fallback.decrement(key);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await db.execute(sql`delete from rate_limit_hits where key = ${this.prefix + key}`);
    } catch (err) {
      this.warn(err);
      this.fallback.resetKey(key);
    }
  }
}

/** Cron: drop expired counters. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const res = await db.execute(sql`delete from rate_limit_hits where reset_at < now() - interval '1 hour'`);
  return res.rowCount ?? 0;
}

const budgetStores = new Map<string, PostgresRateLimitStore>();

/**
 * One hit against a named budget, outside express (used by the better-auth
 * hook, where the request body — the email — is already parsed). Returns
 * false once `max` hits have been spent in the window.
 */
export async function consumeBudget(name: string, key: string, opts: { windowMs: number; max: number }): Promise<boolean> {
  let store = budgetStores.get(name);
  if (!store) {
    store = new PostgresRateLimitStore(name);
    store.init({ windowMs: opts.windowMs } as Options);
    budgetStores.set(name, store);
  }
  const { totalHits } = await store.increment(key);
  return totalHits <= opts.max;
}
