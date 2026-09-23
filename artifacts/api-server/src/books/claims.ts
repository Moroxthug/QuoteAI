import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db, costEntriesTable, fieldReportsTable, flinksTransactionsTable, projectsTable, quickbooksSyncLogTable, waveSyncLogTable } from "@workspace/db";
import { writeAudit } from "../lib/notifications.js";
import { ReconcileError } from "./reconcile.js";

// ── Phase 88: a crew's materials claim ↔ the receipt that proves it ─────────
// Phase 86 made "materials: $212" from the site a pending cost entry, and said
// so: a number typed on a ladder is a claim. When the receipt is scanned it
// becomes a second cost entry — the same money twice. "These are the same
// thing" keeps the receipt (it has the vendor, the date and the tax split),
// points the field report and any bank match at it, and removes the claim.

const DAY = 86_400_000;

/** A claim is a materials report whose cost entry is still the one typed on site — no document behind it. */
async function openClaims(userId: string, limit: number) {
  return db
    .select({
      reportId: fieldReportsTable.id,
      costEntryId: costEntriesTable.id,
      authorName: fieldReportsTable.authorName,
      body: fieldReportsTable.body,
      reportedAt: fieldReportsTable.createdAt,
      projectId: costEntriesTable.projectId,
      projectName: projectsTable.name,
      date: costEntriesTable.date,
      totalCents: costEntriesTable.totalCents,
      status: costEntriesTable.status,
    })
    .from(fieldReportsTable)
    .innerJoin(costEntriesTable, eq(costEntriesTable.id, fieldReportsTable.costEntryId))
    .leftJoin(projectsTable, eq(projectsTable.id, costEntriesTable.projectId))
    .where(and(eq(fieldReportsTable.userId, userId), eq(fieldReportsTable.kind, "materials"), isNull(costEntriesTable.sourceDocumentId)))
    .orderBy(desc(fieldReportsTable.createdAt))
    .limit(limit);
}

/** Receipts already standing behind some report cannot prove a second one. */
const receiptFree = sql`not exists (select 1 from ${fieldReportsTable} fr where fr.cost_entry_id = ${costEntriesTable.id})`;

export async function listClaims(userId: string) {
  const claims = await openClaims(userId, 100);
  const out = [];
  for (const c of claims) {
    const from = new Date(c.date.getTime() - 14 * DAY);
    const to = new Date(c.date.getTime() + 30 * DAY);
    const receipts = await db
      .select({ id: costEntriesTable.id, vendor: costEntriesTable.vendor, description: costEntriesTable.description, date: costEntriesTable.date, totalCents: costEntriesTable.totalCents, taxCents: costEntriesTable.taxCents, status: costEntriesTable.status, projectId: costEntriesTable.projectId })
      .from(costEntriesTable)
      .where(
        and(
          eq(costEntriesTable.userId, userId),
          isNotNull(costEntriesTable.sourceDocumentId),
          ne(costEntriesTable.id, c.costEntryId),
          c.projectId ? or(eq(costEntriesTable.projectId, c.projectId), isNull(costEntriesTable.projectId)) : undefined,
          gte(costEntriesTable.date, from),
          lte(costEntriesTable.date, to),
          receiptFree,
        ),
      )
      .limit(20);
    // Closest amount first (a receipt is rarely the exact number typed on site), then closest date.
    receipts.sort((a, b) => Math.abs(a.totalCents - c.totalCents) - Math.abs(b.totalCents - c.totalCents) || Math.abs(a.date.getTime() - c.date.getTime()) - Math.abs(b.date.getTime() - c.date.getTime()));
    out.push({
      reportId: c.reportId,
      costEntryId: c.costEntryId,
      authorName: c.authorName,
      body: c.body,
      reportedAt: c.reportedAt.toISOString(),
      projectId: c.projectId,
      projectName: c.projectName ?? null,
      date: c.date.toISOString(),
      totalCents: c.totalCents,
      status: c.status,
      receipts: receipts.slice(0, 5).map((r) => ({ ...r, date: r.date.toISOString() })),
    });
  }
  return out;
}

/** Counted by the month-end close. */
async function openClaimCostIds(userId: string): Promise<string[]> {
  return (await openClaims(userId, 1000)).map((c) => c.costEntryId);
}

async function syncedAnywhere(userId: string, costEntryId: string): Promise<boolean> {
  const [qbo] = await db.select({ id: quickbooksSyncLogTable.id }).from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, userId), eq(quickbooksSyncLogTable.entityType, "cost_entry"), eq(quickbooksSyncLogTable.entityId, costEntryId), eq(quickbooksSyncLogTable.status, "synced")));
  if (qbo) return true;
  const [wave] = await db.select({ id: waveSyncLogTable.id }).from(waveSyncLogTable).where(and(eq(waveSyncLogTable.userId, userId), eq(waveSyncLogTable.entityType, "cost_entry"), eq(waveSyncLogTable.entityId, costEntryId), eq(waveSyncLogTable.status, "synced")));
  return !!wave;
}

export async function mergeClaim(userId: string, claimCostId: string, receiptId: string, actor: { id: string | null; ip?: string | null }): Promise<{ costEntryId: string }> {
  if (claimCostId === receiptId) throw new ReconcileError("INVALID", "Pick the receipt, not the claim itself");
  const [claim] = await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.id, claimCostId), eq(costEntriesTable.userId, userId)));
  const reports = claim ? await db.select({ id: fieldReportsTable.id }).from(fieldReportsTable).where(and(eq(fieldReportsTable.userId, userId), eq(fieldReportsTable.costEntryId, claimCostId), eq(fieldReportsTable.kind, "materials"))) : [];
  if (!claim || reports.length === 0 || claim.sourceDocumentId) throw new ReconcileError("NOT_FOUND", "Materials claim not found");
  const [receipt] = await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.id, receiptId), eq(costEntriesTable.userId, userId)));
  if (!receipt || !receipt.sourceDocumentId) throw new ReconcileError("NOT_FOUND", "Receipt not found");
  const [taken] = await db.select({ id: fieldReportsTable.id }).from(fieldReportsTable).where(eq(fieldReportsTable.costEntryId, receiptId));
  if (taken) throw new ReconcileError("ALREADY_MATCHED", "That receipt already stands behind another report");
  // The claim was confirmed and sent to the books: removing it here would leave it there. A person fixes that.
  if (await syncedAnywhere(userId, claimCostId)) throw new ReconcileError("INVALID", "CLAIM_SYNCED");

  await db.transaction(async (tx) => {
    await tx.update(fieldReportsTable).set({ costEntryId: receiptId }).where(and(eq(fieldReportsTable.userId, userId), eq(fieldReportsTable.costEntryId, claimCostId)));
    // A bank line matched to the claim now points at the receipt — unless the receipt already has its own line.
    const [receiptLine] = await tx.select({ id: flinksTransactionsTable.id }).from(flinksTransactionsTable).where(eq(flinksTransactionsTable.matchedCostEntryId, receiptId));
    if (receiptLine) {
      await tx.update(flinksTransactionsTable).set({ matchedCostEntryId: null, matchStatus: "unmatched", autoMatched: false }).where(and(eq(flinksTransactionsTable.userId, userId), eq(flinksTransactionsTable.matchedCostEntryId, claimCostId)));
    } else {
      await tx.update(flinksTransactionsTable).set({ matchedCostEntryId: receiptId }).where(and(eq(flinksTransactionsTable.userId, userId), eq(flinksTransactionsTable.matchedCostEntryId, claimCostId)));
    }
    if (!receipt.projectId && claim.projectId) {
      await tx.update(costEntriesTable).set({ projectId: claim.projectId, milestoneId: claim.milestoneId }).where(eq(costEntriesTable.id, receiptId));
    }
    await tx.delete(costEntriesTable).where(and(eq(costEntriesTable.id, claimCostId), eq(costEntriesTable.userId, userId)));
  });
  await writeAudit({
    userId,
    actorType: "user",
    actorId: actor.id,
    entityType: "cost_entry",
    entityId: receiptId,
    action: "claim_merged",
    diff: { claimCostEntryId: claimCostId, claimCents: claim.totalCents, receiptCents: receipt.totalCents, fieldReportIds: reports.map((r) => r.id) },
    ip: actor.ip ?? null,
  });
  return { costEntryId: receiptId };
}

/** Months with claims, for the close: claim cost entries dated in [from, to]. */
export async function claimsInRange(userId: string, from: Date, to: Date) {
  const ids = await openClaimCostIds(userId);
  if (ids.length === 0) return [];
  return db
    .select({ id: costEntriesTable.id, date: costEntriesTable.date, totalCents: costEntriesTable.totalCents, description: costEntriesTable.description, projectId: costEntriesTable.projectId })
    .from(costEntriesTable)
    .where(and(inArray(costEntriesTable.id, ids), gte(costEntriesTable.date, from), lte(costEntriesTable.date, to)));
}
