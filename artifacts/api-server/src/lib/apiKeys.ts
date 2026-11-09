import { randomBytes, createHash } from "crypto";
import { db, apiKeysTable, organizationMembersTable, type ApiKey, type TeamMemberRole } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";

// Same recipe as contracts/invoices tokenHash: high-entropy random value,
// only its SHA-256 hash is ever stored, the raw value is shown once.
const KEY_PREFIX = "qak";

function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function shortPrefix(raw: string): string {
  return raw.slice(0, KEY_PREFIX.length + 5); // "qak_" + 4 chars, enough to tell keys apart in a list
}

export async function createApiKey(userId: string, createdByUserId: string, role: TeamMemberRole, name: string): Promise<{ key: ApiKey; rawKey: string }> {
  const rawKey = `${KEY_PREFIX}_${randomBytes(24).toString("hex")}`;
  const [key] = await db
    .insert(apiKeysTable)
    .values({
      userId,
      createdByUserId,
      name,
      keyPrefix: shortPrefix(rawKey),
      keyHash: hashApiKey(rawKey),
      role,
    })
    .returning();
  return { key: key!, rawKey };
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  return db.select().from(apiKeysTable).where(eq(apiKeysTable.userId, userId)).orderBy(desc(apiKeysTable.createdAt));
}

export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const [revoked] = await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeysTable.id, keyId), eq(apiKeysTable.userId, userId), isNull(apiKeysTable.revokedAt)))
    .returning();
  return !!revoked;
}

export async function findActiveApiKeyByRawKey(rawKey: string): Promise<ApiKey | null> {
  const [key] = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, hashApiKey(rawKey)), isNull(apiKeysTable.revokedAt)));
  if (!key) return null;
  // Fire-and-forget — never block the request on this write.
  db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, key.id)).catch(() => {});
  return key;
}

/**
 * Audit B4: a key acts with its creator's authority, so it lives only as long
 * as that authority. A key made by a teammate stops working — and is revoked
 * for good — once they leave the company or their role changes. The owner's
 * own keys are tied to the company itself.
 */
export async function creatorStillEntitled(key: ApiKey): Promise<boolean> {
  if (key.createdByUserId === key.userId) return true;
  const [member] = await db
    .select({ role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.ownerId, key.userId), eq(organizationMembersTable.userId, key.createdByUserId), eq(organizationMembersTable.status, "active")))
    .limit(1);
  if (member && member.role === key.role) return true;
  await db.update(apiKeysTable).set({ revokedAt: new Date() }).where(and(eq(apiKeysTable.id, key.id), isNull(apiKeysTable.revokedAt)));
  return false;
}
