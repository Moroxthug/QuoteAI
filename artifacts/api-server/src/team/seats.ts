import { db, businessProfilesTable, organizationMembersTable, effectivePlan, seatLimit, seatsIncluded } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";

// ── Phase 91: seats ──────────────────────────────────────────────────────────
// A seat is a login that can act in the company: the owner, every member who
// is not suspended, and every open invitation (an emailed link or an
// access code). An access code nobody used before it expired gives its seat
// back; an emailed invite keeps holding it until it is revoked, as before.

export type SeatCount = { used: number; limit: number; included: number; extra: number };

export async function seatCount(orgId: string, now = new Date()): Promise<SeatCount> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
  const rows = await db
    .select({ status: organizationMembersTable.status, code: organizationMembersTable.accessCodeHash, expiresAt: organizationMembersTable.inviteTokenExpiresAt })
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.ownerId, orgId), ne(organizationMembersTable.status, "suspended")));
  const held = rows.filter((r) => !(r.status === "invited" && r.code && r.expiresAt && r.expiresAt < now)).length;
  return { used: held + 1, limit: seatLimit(profile), included: seatsIncluded(effectivePlan(profile)), extra: profile?.extraSeats ?? 0 };
}
