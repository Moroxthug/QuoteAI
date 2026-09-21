import { db, automationRunsTable, type AutomationEvent, type AutomationRun } from "@workspace/db";
import { and, eq, lte, or, isNull, sql } from "drizzle-orm";
import { logger } from "./logger";
import { captureException } from "./errorTracking";

// ── Automation runner ────────────────────────────────────────────────────────
// Vercel gives us no queue, so every side effect of a domain event is
// recorded as an `automation_runs` row keyed by an idempotency key, executed
// inline, and retried by the cron tick if it fails. Handlers MUST be
// idempotent: a retry may re-run a handler whose previous attempt partially
// succeeded.

export type AutomationHandler = (run: AutomationRun) => Promise<Record<string, unknown> | void>;

// Multiple handlers can share one event (e.g. Phase 19's webhook dispatcher
// runs alongside each event's existing domain handler) — all run in
// registration order on every attempt, so each MUST be idempotent, same as
// the single-handler case already was.
const handlers = new Map<AutomationEvent, AutomationHandler[]>();

export function registerAutomation(event: AutomationEvent, handler: AutomationHandler): void {
  const list = handlers.get(event) ?? [];
  list.push(handler);
  handlers.set(event, list);
}

const BACKOFF_MINUTES = [5, 15, 60, 240, 1440];

function nextAttemptDate(attempts: number): Date {
  const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1] ?? 1440;
  return new Date(Date.now() + minutes * 60_000);
}

/**
 * Records the event (no-op if the idempotency key already exists) and runs
 * its handler right away. Never throws: a failing handler is left for the
 * cron retry so the user-facing request that raised the event still succeeds.
 */
export async function raiseAutomation(params: {
  event: AutomationEvent;
  userId: string;
  entityType: string;
  entityId: string;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
}): Promise<AutomationRun | null> {
  const idempotencyKey = params.idempotencyKey ?? `${params.event}:${params.entityType}:${params.entityId}`;

  const [inserted] = await db
    .insert(automationRunsTable)
    .values({
      userId: params.userId,
      event: params.event,
      entityType: params.entityType,
      entityId: params.entityId,
      idempotencyKey,
      payload: params.payload ?? {},
      status: "pending",
      nextAttemptAt: new Date(),
    })
    .onConflictDoNothing({ target: automationRunsTable.idempotencyKey })
    .returning();

  if (!inserted) {
    logger.info({ idempotencyKey }, "Automation already recorded, skipping");
    return null;
  }

  await executeRun(inserted);
  return inserted;
}

async function executeRun(run: AutomationRun): Promise<void> {
  const eventHandlers = handlers.get(run.event as AutomationEvent);
  if (!eventHandlers || eventHandlers.length === 0) {
    logger.warn({ event: run.event, runId: run.id }, "No automation handler registered");
    await db
      .update(automationRunsTable)
      .set({ status: "dead", lastError: "No handler registered", finishedAt: new Date() })
      .where(eq(automationRunsTable.id, run.id));
    return;
  }

  // Claim the run atomically so two overlapping cron ticks never execute it twice.
  const [claimed] = await db
    .update(automationRunsTable)
    .set({ status: "running", startedAt: new Date(), attempts: sql`${automationRunsTable.attempts} + 1` })
    .where(and(eq(automationRunsTable.id, run.id), or(eq(automationRunsTable.status, "pending"), eq(automationRunsTable.status, "failed"))))
    .returning();
  if (!claimed) return;

  try {
    const combinedResult: Record<string, unknown> = {};
    for (const handler of eventHandlers) {
      const result = await handler(claimed);
      if (result) Object.assign(combinedResult, result);
    }
    await db
      .update(automationRunsTable)
      .set({ status: "succeeded", result: Object.keys(combinedResult).length ? combinedResult : null, lastError: null, finishedAt: new Date() })
      .where(eq(automationRunsTable.id, run.id));
    logger.info({ event: run.event, runId: run.id }, "Automation succeeded");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const exhausted = claimed.attempts >= claimed.maxAttempts;
    await db
      .update(automationRunsTable)
      .set({
        status: exhausted ? "dead" : "failed",
        lastError: message.slice(0, 2000),
        nextAttemptAt: exhausted ? null : nextAttemptDate(claimed.attempts),
        finishedAt: exhausted ? new Date() : null,
      })
      .where(eq(automationRunsTable.id, run.id));
    logger.error({ err, event: run.event, runId: run.id, attempts: claimed.attempts, exhausted }, "Automation failed");
    // Phase 69: every failed attempt is an issue in error tracking (grouped by
    // event + error); a dead run is fatal because nothing will retry it.
    await captureException(err, {
      level: exhausted ? "fatal" : "error",
      mechanism: "automation",
      tags: { automation_event: run.event, automation_status: exhausted ? "dead" : "failed", attempt: claimed.attempts },
      extra: { runId: run.id, idempotencyKey: run.idempotencyKey, entityType: run.entityType, entityId: run.entityId },
      user: { id: run.userId },
    });
  }
}

/** Manual retry (e.g. from a "retry sync" button): re-runs a specific run right away, bypassing backoff. */
export async function retryAutomationNow(idempotencyKey: string): Promise<{ ok: boolean }> {
  const [run] = await db.select().from(automationRunsTable).where(eq(automationRunsTable.idempotencyKey, idempotencyKey));
  if (!run) return { ok: false };
  await db
    .update(automationRunsTable)
    .set({ status: "failed", nextAttemptAt: new Date() })
    .where(eq(automationRunsTable.id, run.id));
  const [reloaded] = await db.select().from(automationRunsTable).where(eq(automationRunsTable.id, run.id));
  await executeRun(reloaded!);
  return { ok: true };
}

/** Called by the cron tick: retries failed runs whose backoff has elapsed. */
export async function retryDueAutomations(limit = 25): Promise<{ retried: number }> {
  const due = await db
    .select()
    .from(automationRunsTable)
    .where(
      and(
        or(eq(automationRunsTable.status, "failed"), eq(automationRunsTable.status, "pending")),
        or(isNull(automationRunsTable.nextAttemptAt), lte(automationRunsTable.nextAttemptAt, new Date())),
      ),
    )
    .limit(limit);

  for (const run of due) {
    await executeRun(run);
  }
  return { retried: due.length };
}
