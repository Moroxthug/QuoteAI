import { AsyncLocalStorage } from "node:async_hooks";
import { and, gte, lt, sql } from "drizzle-orm";
import { db, usageEventsTable, usageDailySummaryTable, type UsageEventKind } from "@workspace/db";
import { logger } from "./logger.js";

// ── Phase 8: per-org cost/usage observability ──────────────────────────────
// See docs/GROWTH-PLATFORM-PLAN.md §4a. Every AI call and WhatsApp send is a
// single choke point (this file), so instrumentation doesn't need to sweep
// every call site — callers that already know the userId call
// recordUsageEvent/recordAiUsage directly; the WhatsApp bot (which resolves
// userId once per webhook request, deep inside a long reply tree) instead
// sets an AsyncLocalStorage context so the low-level send helpers can record
// usage without threading userId through 50+ call sites.

const whatsappUserContext = new AsyncLocalStorage<string>();

export function withWhatsappUsageContext<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return whatsappUserContext.run(userId, fn);
}

function currentWhatsappUserId(): string | undefined {
  return whatsappUserContext.getStore();
}

export async function recordUsageEvent(params: {
  userId: string;
  kind: UsageEventKind;
  quantity: number;
  unitCostCents?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Promise<void> {
  try {
    await db.insert(usageEventsTable).values({
      userId: params.userId,
      kind: params.kind,
      quantity: params.quantity.toString(),
      unitCostCents: (params.unitCostCents ?? 0).toString(),
      relatedEntityType: params.relatedEntityType ?? null,
      relatedEntityId: params.relatedEntityId ?? null,
    });
  } catch (err) {
    // Usage tracking must never break the caller's actual work.
    logger.warn({ err, ...params }, "Failed to record usage event");
  }
}

/**
 * Approximate USD-cents-per-1K-tokens for models this app calls, snapshotted
 * at insert time (see usage_events.unit_cost_cents) so a later price change
 * doesn't retroactively rewrite historical cost. Unknown models cost 0 rather
 * than guessing.
 */
const MODEL_COST_PER_1K_TOKENS_CENTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.5, output: 1.5 },
  "gpt-4o-mini": { input: 0.015, output: 0.06 },
  "qwen/qwen3.6-27b": { input: 0.01, output: 0.03 },
  "openai/gpt-oss-120b": { input: 0.01, output: 0.03 },
  "openai/gpt-oss-20b": { input: 0.005, output: 0.015 },
};

export function recordAiUsage(params: {
  userId: string;
  model: string;
  kind: Extract<UsageEventKind, "ai_text" | "ai_vision">;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): void {
  const usage = params.usage;
  const totalTokens = usage?.total_tokens ?? ((usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0));
  if (!totalTokens) return;
  const pricing = MODEL_COST_PER_1K_TOKENS_CENTS[params.model];
  const costCents = pricing
    ? ((usage?.prompt_tokens ?? 0) / 1000) * pricing.input + ((usage?.completion_tokens ?? 0) / 1000) * pricing.output
    : 0;
  void recordUsageEvent({
    userId: params.userId,
    kind: params.kind,
    quantity: totalTokens,
    unitCostCents: totalTokens > 0 ? costCents / totalTokens : 0,
    relatedEntityType: params.relatedEntityType,
    relatedEntityId: params.relatedEntityId,
  });
}

/** Meta bills WhatsApp Business messages per-message; ~US$0.005-0.01, approximated here. */
const WHATSAPP_MESSAGE_COST_CENTS = 0.7;

export function recordWhatsappUsageFromContext(): void {
  const userId = currentWhatsappUserId();
  if (!userId) return;
  void recordUsageEvent({ userId, kind: "whatsapp_message", quantity: 1, unitCostCents: WHATSAPP_MESSAGE_COST_CENTS });
}

export function recordWhatsappUsage(userId: string): void {
  void recordUsageEvent({ userId, kind: "whatsapp_message", quantity: 1, unitCostCents: WHATSAPP_MESSAGE_COST_CENTS });
}

/**
 * Rolls yesterday's raw usage_events into usage_daily_summary (one row per
 * user/date/kind). Idempotent — safe to re-run for the same day, since it
 * always recomputes the summary row from the raw events rather than
 * incrementing it. The raw table stays around for debugging/audits.
 */
export async function rollUpUsageForDate(date: Date): Promise<{ rows: number }> {
  const dayStr = date.toISOString().slice(0, 10);
  const start = new Date(`${dayStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      userId: usageEventsTable.userId,
      kind: usageEventsTable.kind,
      quantity: sql<string>`SUM(${usageEventsTable.quantity})`,
      costCents: sql<string>`SUM(${usageEventsTable.quantity} * ${usageEventsTable.unitCostCents})`,
      eventCount: sql<number>`COUNT(*)::int`,
    })
    .from(usageEventsTable)
    .where(and(gte(usageEventsTable.createdAt, start), lt(usageEventsTable.createdAt, end)))
    .groupBy(usageEventsTable.userId, usageEventsTable.kind);

  for (const row of rows) {
    await db
      .insert(usageDailySummaryTable)
      .values({
        userId: row.userId,
        date: dayStr,
        kind: row.kind,
        quantity: row.quantity,
        costCents: row.costCents,
        eventCount: row.eventCount,
      })
      .onConflictDoUpdate({
        target: [usageDailySummaryTable.userId, usageDailySummaryTable.date, usageDailySummaryTable.kind],
        set: { quantity: row.quantity, costCents: row.costCents, eventCount: row.eventCount },
      });
  }

  return { rows: rows.length };
}
