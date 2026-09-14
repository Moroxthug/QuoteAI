import { db, auditLogTable, authUsersTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { writeAudit } from "./notifications";
import { logger } from "./logger";

// Thin security-specific wrapper over the existing `writeAudit` (lib/notifications.ts,
// audit_log table from schema/automation.ts) — reuses the same tenant-scoped
// table the contract/invoice routes already write to, rather than adding a
// second audit table. `orgId` here is that table's `userId` (tenant) column.
export async function recordSecurityAuditEvent(entry: {
  orgId: string;
  actorUserId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await writeAudit({
      userId: entry.orgId,
      actorType: entry.actorUserId ? "user" : "system",
      actorId: entry.actorUserId ?? null,
      entityType: entry.entityType ?? "security",
      entityId: entry.entityId ?? entry.actorUserId ?? entry.orgId,
      action: entry.action,
      ip: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (err) {
    logger.error({ err, action: entry.action }, "Failed to record security audit event");
  }
}

export async function listSecurityAuditEvents(orgId: string, opts: { limit?: number } = {}) {
  return db
    .select({
      id: auditLogTable.id,
      action: auditLogTable.action,
      actorId: auditLogTable.actorId,
      actorName: authUsersTable.name,
      actorEmail: authUsersTable.email,
      entityType: auditLogTable.entityType,
      entityId: auditLogTable.entityId,
      ip: auditLogTable.ip,
      userAgent: auditLogTable.userAgent,
      createdAt: auditLogTable.createdAt,
    })
    .from(auditLogTable)
    .leftJoin(authUsersTable, eq(authUsersTable.id, auditLogTable.actorId))
    .where(and(eq(auditLogTable.userId, orgId), eq(auditLogTable.entityType, "security")))
    .orderBy(desc(auditLogTable.createdAt))
    .limit(opts.limit ?? 100);
}
