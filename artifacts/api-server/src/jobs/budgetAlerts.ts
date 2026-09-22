// Phase 79 — margin alerts. A job's confirmed costs are compared with its
// cost budget every time a cost lands (cost.confirmed automation, labour and
// equipment syncs) and once a day for everything still open. Crossing 90 %
// raises one notification (+ push), crossing 100 % another; the stamps on
// the project keep it to one per crossing and are cleared when costs drop
// back under (an entry deleted, a budget raised) so the next crossing alerts
// again. Jobs without a budget never alert.
import { db, projectsTable, costBudgetLinesTable, costEntriesTable } from "@workspace/db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { budgetAlertLevel, type BudgetAlertLevel } from "../analytics/math.js";
import { createNotification, writeAudit } from "../lib/notifications.js";
import { logger } from "../lib/logger.js";

const cad = (c: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(c / 100);

type Totals = { budgetCents: number; costCents: number };

async function totalsFor(projectIds: string[]): Promise<Map<string, Totals>> {
  const out = new Map<string, Totals>();
  if (projectIds.length === 0) return out;
  const [budget, cost] = await Promise.all([
    db
      .select({ projectId: costBudgetLinesTable.projectId, cents: sql<string>`coalesce(sum(${costBudgetLinesTable.plannedCents}), 0)` })
      .from(costBudgetLinesTable)
      .where(inArray(costBudgetLinesTable.projectId, projectIds))
      .groupBy(costBudgetLinesTable.projectId),
    db
      .select({ projectId: costEntriesTable.projectId, cents: sql<string>`coalesce(sum(${costEntriesTable.totalCents}), 0)` })
      .from(costEntriesTable)
      .where(and(inArray(costEntriesTable.projectId, projectIds), eq(costEntriesTable.status, "confirmed")))
      .groupBy(costEntriesTable.projectId),
  ]);
  for (const id of projectIds) out.set(id, { budgetCents: 0, costCents: 0 });
  for (const b of budget) out.get(b.projectId)!.budgetCents = Number(b.cents);
  for (const c of cost) if (c.projectId) out.get(c.projectId)!.costCents = Number(c.cents);
  return out;
}

export type BudgetCheckResult = { level: BudgetAlertLevel; alerted: 0 | 90 | 100 | null };

async function evaluate(project: typeof projectsTable.$inferSelect, totals: Totals, now: Date): Promise<BudgetCheckResult> {
  const level = budgetAlertLevel(totals.costCents, totals.budgetCents);
  const pct = totals.budgetCents > 0 ? Math.round((totals.costCents / totals.budgetCents) * 100) : 0;
  const leftCents = totals.budgetCents - totals.costCents;
  const link = `/dashboard/jobs/${project.id}`;

  if (level === 100 && !project.budgetAlert100At) {
    await db.update(projectsTable).set({ budgetAlert100At: now, budgetAlert90At: project.budgetAlert90At ?? now }).where(eq(projectsTable.id, project.id));
    await createNotification({
      userId: project.userId,
      type: "budget_exceeded",
      title: `${project.name} is over its cost budget`,
      body: `Confirmed costs ${cad(totals.costCents)} against a ${cad(totals.budgetCents)} budget (${pct} %) — ${cad(-leftCents)} over. Check the actuals, and consider a change order if the scope grew.`,
      link,
      entityType: "project",
      entityId: project.id,
    });
    await writeAudit({ userId: project.userId, actorType: "system", entityType: "project", entityId: project.id, action: "budget_alert", diff: { level: 100, costCents: totals.costCents, budgetCents: totals.budgetCents } });
    return { level, alerted: 100 };
  }
  if (level === 90 && !project.budgetAlert90At) {
    await db.update(projectsTable).set({ budgetAlert90At: now, budgetAlert100At: null }).where(eq(projectsTable.id, project.id));
    await createNotification({
      userId: project.userId,
      type: "budget_alert",
      title: `${project.name}: ${pct} % of the cost budget used`,
      body: `Confirmed costs ${cad(totals.costCents)} of the ${cad(totals.budgetCents)} budget — ${cad(leftCents)} left. Anything still to buy or bill comes out of the margin from here.`,
      link,
      entityType: "project",
      entityId: project.id,
    });
    await writeAudit({ userId: project.userId, actorType: "system", entityType: "project", entityId: project.id, action: "budget_alert", diff: { level: 90, costCents: totals.costCents, budgetCents: totals.budgetCents } });
    return { level, alerted: 90 };
  }
  // Re-arm: costs came back under a threshold (entry removed, budget raised).
  if (level < 100 && project.budgetAlert100At) {
    await db.update(projectsTable).set({ budgetAlert100At: null, ...(level < 90 ? { budgetAlert90At: null } : {}) }).where(eq(projectsTable.id, project.id));
  } else if (level < 90 && project.budgetAlert90At) {
    await db.update(projectsTable).set({ budgetAlert90At: null }).where(eq(projectsTable.id, project.id));
  }
  return { level, alerted: null };
}

/** One job, right after a cost changed. Never throws — a failed alert must not fail the cost write. */
export async function checkJobBudget(projectId: string | null | undefined, now = new Date()): Promise<BudgetCheckResult | null> {
  if (!projectId) return null;
  try {
    const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, projectId), isNull(projectsTable.archivedAt)));
    if (!project) return null;
    const totals = (await totalsFor([project.id])).get(project.id)!;
    return await evaluate(project, totals, now);
  } catch (err) {
    logger.error({ err, projectId }, "Budget alert check failed");
    return null;
  }
}

/** Daily sweep (cron): every open job — catches budget edits and anything the live checks missed. */
export async function runBudgetAlertSweep(now = new Date()): Promise<{ jobsChecked: number; alertsCreated: number }> {
  const projects = await db
    .select()
    .from(projectsTable)
    .where(and(inArray(projectsTable.status, ["planning", "active", "suspended"]), isNull(projectsTable.archivedAt)));
  const totals = await totalsFor(projects.map((p) => p.id));
  let alertsCreated = 0;
  for (const p of projects) {
    const t = totals.get(p.id);
    if (!t || t.budgetCents <= 0) continue;
    try {
      const r = await evaluate(p, t, now);
      if (r.alerted) alertsCreated++;
    } catch (err) {
      logger.error({ err, projectId: p.id }, "Budget alert sweep failed for job");
    }
  }
  return { jobsChecked: projects.length, alertsCreated };
}
