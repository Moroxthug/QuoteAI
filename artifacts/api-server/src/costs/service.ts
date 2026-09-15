import {
  db,
  costEntriesTable,
  timeEntriesTable,
  equipmentUsageTable,
  equipmentTable,
  collaboratorsTable,
  projectsTable,
  milestonesTable,
  COST_CATEGORIES,
  labourCostCents,
  type CostEntry,
  type TimeEntry,
  type EquipmentUsage,
  type Equipment,
  type Collaborator,
  type CostCategory,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { toIsoDate } from "../jobs/dates.js";

// ── Cost entries: serializers + the two materialisations ────────────────────
// Labour and equipment costs are never typed: approving a time entry or
// logging equipment usage writes (or rewrites) the matching cost entry.
// Both functions are idempotent — they upsert on the back-link id.

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function serializeCostEntry(c: CostEntry, extra?: { projectName?: string | null; milestoneTitle?: string | null }) {
  return {
    id: c.id,
    projectId: c.projectId,
    projectName: extra?.projectName ?? null,
    milestoneId: c.milestoneId,
    milestoneTitle: extra?.milestoneTitle ?? null,
    category: c.category,
    vendor: c.vendor,
    description: c.description,
    date: toIsoDate(c.date),
    subtotalCents: c.subtotalCents,
    taxCents: c.taxCents,
    taxBreakdown: c.taxBreakdown,
    totalCents: c.totalCents,
    status: c.status,
    source: c.source,
    createdBy: c.createdBy,
    sourceDocumentId: c.sourceDocumentId,
    timeEntryId: c.timeEntryId,
    equipmentUsageId: c.equipmentUsageId,
    aiExtraction: c.aiExtraction ?? null,
    confirmedAt: iso(c.confirmedAt),
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializeTimeEntry(e: TimeEntry, extra?: { workerName?: string; projectName?: string | null; milestoneTitle?: string | null }) {
  const hours = Number(e.hours);
  const burden = Number(e.burdenPercentSnapshot);
  return {
    id: e.id,
    workerId: e.workerId,
    workerName: extra?.workerName ?? null,
    projectId: e.projectId,
    projectName: extra?.projectName ?? null,
    milestoneId: e.milestoneId,
    milestoneTitle: extra?.milestoneTitle ?? null,
    date: toIsoDate(e.date),
    hours,
    rateCents: e.rateCentsSnapshot,
    burdenPercent: burden,
    costCents: labourCostCents(hours, e.rateCentsSnapshot, burden),
    note: e.note,
    status: e.status,
    enteredBy: e.enteredBy,
    approvedAt: iso(e.approvedAt),
    rejectedReason: e.rejectedReason,
    costEntryId: e.costEntryId,
    clockInAt: iso(e.clockInAt),
    clockOutAt: iso(e.clockOutAt),
    geofenceFlagged: e.geofenceFlagged,
    createdAt: e.createdAt.toISOString(),
  };
}

export function serializeWorker(w: Collaborator, extra?: { hoursThisMonth?: number; pendingCount?: number; hasInvite?: boolean }) {
  return {
    id: w.id,
    name: w.name,
    role: w.role,
    email: w.email,
    phone: w.phone,
    hourlyRateCents: w.hourlyRate,
    workerType: w.workerType,
    burdenPercent: Number(w.burdenPercent),
    active: w.active,
    hasInvite: extra?.hasInvite ?? (!!w.timeTokenHash && (!w.timeTokenExpiresAt || w.timeTokenExpiresAt > new Date())),
    inviteExpiresAt: iso(w.timeTokenExpiresAt),
    lastTimeEntryAt: iso(w.lastTimeEntryAt),
    hoursThisMonth: extra?.hoursThisMonth ?? 0,
    pendingCount: extra?.pendingCount ?? 0,
    createdAt: w.createdAt.toISOString(),
  };
}

export function serializeEquipment(e: Equipment, extra?: { usageCentsThisMonth?: number }) {
  return {
    id: e.id,
    name: e.name,
    ownership: e.ownership,
    purchaseCents: e.purchaseCents,
    financing: e.financing,
    usageRateCents: e.usageRateCents,
    usageUnit: e.usageUnit,
    notes: e.notes,
    active: e.active,
    usageCentsThisMonth: extra?.usageCentsThisMonth ?? 0,
    createdAt: e.createdAt.toISOString(),
  };
}

export function serializeUsage(u: EquipmentUsage, extra?: { equipmentName?: string; projectName?: string | null }) {
  const qty = Number(u.quantity);
  return {
    id: u.id,
    equipmentId: u.equipmentId,
    equipmentName: extra?.equipmentName ?? null,
    projectId: u.projectId,
    projectName: extra?.projectName ?? null,
    milestoneId: u.milestoneId,
    date: toIsoDate(u.date),
    quantity: qty,
    unit: u.unit,
    rateCents: u.rateCentsSnapshot,
    costCents: Math.round(qty * u.rateCentsSnapshot),
    note: u.note,
    costEntryId: u.costEntryId,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Confirmed totals by category + pending count for one job. */
export async function costSummary(projectId: string) {
  const entries = await db.select().from(costEntriesTable).where(eq(costEntriesTable.projectId, projectId)).orderBy(desc(costEntriesTable.date), desc(costEntriesTable.createdAt));
  const byCategory = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, number>;
  let confirmedCents = 0;
  let pendingCents = 0;
  let pendingCount = 0;
  for (const e of entries) {
    if (e.status === "confirmed") {
      confirmedCents += e.totalCents;
      byCategory[e.category] += e.totalCents;
    } else {
      pendingCents += e.totalCents;
      pendingCount += 1;
    }
  }
  return { entries, confirmedCents, pendingCents, pendingCount, byCategory };
}

/**
 * Writes the labour cost entry for an approved time entry (or removes it
 * when the entry is no longer approved). Safe to call repeatedly.
 */
export async function syncLabourCost(entry: TimeEntry, worker: Pick<Collaborator, "name">): Promise<string | null> {
  if (entry.status !== "approved") {
    if (entry.costEntryId) {
      await db.delete(costEntriesTable).where(eq(costEntriesTable.id, entry.costEntryId));
      await db.update(timeEntriesTable).set({ costEntryId: null }).where(eq(timeEntriesTable.id, entry.id));
    }
    return null;
  }
  const hours = Number(entry.hours);
  const burden = Number(entry.burdenPercentSnapshot);
  const base = Math.round(hours * entry.rateCentsSnapshot);
  const total = labourCostCents(hours, entry.rateCentsSnapshot, burden);
  const values = {
    userId: entry.userId,
    projectId: entry.projectId,
    milestoneId: entry.milestoneId,
    category: "labour" as const,
    vendor: worker.name,
    description: `${worker.name} — ${hours.toFixed(2)} h${entry.note ? ` · ${entry.note.slice(0, 120)}` : ""}`,
    date: entry.date,
    subtotalCents: base,
    taxCents: 0,
    taxBreakdown: {},
    totalCents: total,
    status: "confirmed" as const,
    source: "time_entry" as const,
    createdBy: "system" as const,
    timeEntryId: entry.id,
    confirmedAt: entry.approvedAt ?? new Date(),
  };
  if (entry.costEntryId) {
    const [existing] = await db.update(costEntriesTable).set(values).where(eq(costEntriesTable.id, entry.costEntryId)).returning({ id: costEntriesTable.id });
    if (existing) return existing.id;
  }
  const [created] = await db.insert(costEntriesTable).values(values).returning({ id: costEntriesTable.id });
  await db.update(timeEntriesTable).set({ costEntryId: created!.id }).where(eq(timeEntriesTable.id, entry.id));
  return created!.id;
}

/** Writes the equipment cost entry for a usage log. Idempotent. */
export async function syncEquipmentCost(usage: EquipmentUsage, equipment: Pick<Equipment, "name">): Promise<string> {
  const qty = Number(usage.quantity);
  const total = Math.round(qty * usage.rateCentsSnapshot);
  const values = {
    userId: usage.userId,
    projectId: usage.projectId,
    milestoneId: usage.milestoneId,
    category: "equipment" as const,
    vendor: equipment.name,
    description: `${equipment.name} — ${qty} ${usage.unit === "hour" ? "h" : "d"}${usage.note ? ` · ${usage.note.slice(0, 120)}` : ""}`,
    date: usage.date,
    subtotalCents: total,
    taxCents: 0,
    taxBreakdown: {},
    totalCents: total,
    status: "confirmed" as const,
    source: "equipment" as const,
    createdBy: "system" as const,
    equipmentUsageId: usage.id,
    confirmedAt: usage.createdAt,
  };
  if (usage.costEntryId) {
    const [existing] = await db.update(costEntriesTable).set(values).where(eq(costEntriesTable.id, usage.costEntryId)).returning({ id: costEntriesTable.id });
    if (existing) return existing.id;
  }
  const [created] = await db.insert(costEntriesTable).values(values).returning({ id: costEntriesTable.id });
  await db.update(equipmentUsageTable).set({ costEntryId: created!.id }).where(eq(equipmentUsageTable.id, usage.id));
  return created!.id;
}

/** Name lookups used by the list endpoints (one query per table). */
export async function nameMaps(params: { projectIds?: (string | null)[]; milestoneIds?: (string | null)[]; workerIds?: (string | null)[]; equipmentIds?: (string | null)[] }) {
  const uniq = (xs: (string | null | undefined)[] | undefined) => [...new Set((xs ?? []).filter((x): x is string => !!x))];
  const [projects, milestones, workers, equipment] = await Promise.all([
    uniq(params.projectIds).length ? db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(inArray(projectsTable.id, uniq(params.projectIds))) : [],
    uniq(params.milestoneIds).length ? db.select({ id: milestonesTable.id, title: milestonesTable.title }).from(milestonesTable).where(inArray(milestonesTable.id, uniq(params.milestoneIds))) : [],
    uniq(params.workerIds).length ? db.select({ id: collaboratorsTable.id, name: collaboratorsTable.name }).from(collaboratorsTable).where(inArray(collaboratorsTable.id, uniq(params.workerIds))) : [],
    uniq(params.equipmentIds).length ? db.select({ id: equipmentTable.id, name: equipmentTable.name }).from(equipmentTable).where(inArray(equipmentTable.id, uniq(params.equipmentIds))) : [],
  ]);
  return {
    project: new Map(projects.map((p) => [p.id, p.name])),
    milestone: new Map(milestones.map((m) => [m.id, m.title])),
    worker: new Map(workers.map((w) => [w.id, w.name])),
    equipment: new Map(equipment.map((e) => [e.id, e.name])),
  };
}

/** Approved hours per worker in a period (used by the workers list + payroll export). */
export async function approvedHoursByWorker(userId: string, from: Date, to: Date): Promise<Map<string, number>> {
  const rows = await db
    .select({ workerId: timeEntriesTable.workerId, hours: sql<string>`coalesce(sum(${timeEntriesTable.hours}), 0)` })
    .from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "approved"), sql`${timeEntriesTable.date} >= ${from}`, sql`${timeEntriesTable.date} < ${to}`))
    .groupBy(timeEntriesTable.workerId);
  return new Map(rows.map((r) => [r.workerId, Number(r.hours)]));
}
