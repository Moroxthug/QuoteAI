import { db, notificationsTable, auditLogTable } from "@workspace/db";
import { currentActorId } from "./requestContext.js";
import { pushForNotification } from "./push";

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? "",
    link: params.link ?? null,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
  });
  // Phase 77: the phone gets the ones worth interrupting for (lib/push.ts decides). Never blocks or fails the caller.
  void pushForNotification(params);
}

export async function writeAudit(params: {
  userId: string;
  actorType: "user" | "customer" | "system" | "ai";
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  diff?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await db.insert(auditLogTable).values({
    userId: params.userId,
    actorType: params.actorType,
    // Phase 91: many callers pass the company id as the actor (all they had); inside a signed-in request the real person is known.
    actorId: params.actorType === "user" && (!params.actorId || params.actorId === params.userId) ? (currentActorId() ?? params.actorId ?? null) : (params.actorId ?? null),
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    diff: params.diff ?? null,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
  });
}
