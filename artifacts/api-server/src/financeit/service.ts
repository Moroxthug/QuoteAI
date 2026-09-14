import {
  db,
  financeitConnectionsTable,
  financeitApplicationsTable,
  financeitLoanEventsTable,
  type FinanceitConnection,
  type FinanceitApplication,
  type FinanceitApplicationStatus,
  type FinanceitLoanEventType,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export async function getFinanceitConnection(userId: string): Promise<FinanceitConnection | null> {
  const [conn] = await db.select().from(financeitConnectionsTable).where(eq(financeitConnectionsTable.userId, userId));
  return conn ?? null;
}

export async function setFinanceitDealerId(userId: string, dealerId: string): Promise<FinanceitConnection> {
  const [conn] = await db
    .insert(financeitConnectionsTable)
    .values({ userId, dealerId, isEnabled: true })
    .onConflictDoUpdate({
      target: financeitConnectionsTable.userId,
      set: { dealerId, isEnabled: true, connectedAt: new Date() },
    })
    .returning();
  return conn!;
}

export async function setFinanceitEnabled(userId: string, isEnabled: boolean): Promise<void> {
  await db.update(financeitConnectionsTable).set({ isEnabled }).where(eq(financeitConnectionsTable.userId, userId));
}

export async function disconnectFinanceit(userId: string): Promise<void> {
  await db.delete(financeitConnectionsTable).where(eq(financeitConnectionsTable.userId, userId));
}

export async function markFinanceitApplied(userId: string): Promise<void> {
  await db.update(financeitConnectionsTable).set({ lastAppliedAt: new Date() }).where(eq(financeitConnectionsTable.userId, userId));
}

export async function recordFinanceitApplication(params: {
  userId: string;
  quoteId: string;
  dealerId: string;
  financeitApplicationId: string;
  applicationLink: string;
}): Promise<FinanceitApplication> {
  const [app] = await db
    .insert(financeitApplicationsTable)
    .values({
      userId: params.userId,
      quoteId: params.quoteId,
      dealerId: params.dealerId,
      financeitApplicationId: params.financeitApplicationId,
      applicationLink: params.applicationLink,
      status: "sent",
    })
    .returning();
  return app!;
}

export async function getLatestFinanceitApplicationForQuote(quoteId: string): Promise<FinanceitApplication | null> {
  const [app] = await db
    .select()
    .from(financeitApplicationsTable)
    .where(eq(financeitApplicationsTable.quoteId, quoteId))
    .orderBy(desc(financeitApplicationsTable.createdAt))
    .limit(1);
  return app ?? null;
}

export async function getFinanceitApplicationByFinanceitId(financeitApplicationId: string): Promise<FinanceitApplication | null> {
  const [app] = await db
    .select()
    .from(financeitApplicationsTable)
    .where(eq(financeitApplicationsTable.financeitApplicationId, financeitApplicationId));
  return app ?? null;
}

/** Records a webhook event and, for a recognized terminal/near-terminal loan state, updates the application's status badge. */
export async function recordFinanceitLoanEvent(params: {
  applicationId: string;
  eventType: FinanceitLoanEventType;
  loanState: string | null;
  raw: Record<string, unknown>;
}): Promise<void> {
  await db.insert(financeitLoanEventsTable).values({
    applicationId: params.applicationId,
    eventType: params.eventType,
    loanState: params.loanState,
    raw: params.raw,
  });

  const nextStatus = statusFromLoanEvent(params.eventType, params.loanState);
  if (nextStatus) {
    await db.update(financeitApplicationsTable).set({ status: nextStatus }).where(eq(financeitApplicationsTable.id, params.applicationId));
  }
}

function statusFromLoanEvent(eventType: FinanceitLoanEventType, loanState: string | null): FinanceitApplicationStatus | null {
  if (eventType === "funds_released") return "funded";
  if (!loanState) return null;
  const normalized = loanState.toLowerCase();
  if (normalized.includes("approve")) return "approved";
  if (normalized.includes("declin") || normalized.includes("reject")) return "declined";
  if (normalized.includes("progress") || normalized.includes("submit") || normalized.includes("pending")) return "in_progress";
  return null;
}
