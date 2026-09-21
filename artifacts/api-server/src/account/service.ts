// Phase 72 — account data export and account deletion (PIPEDA / Québec Law 25).
//
// Export: every tenant-scoped table as JSON plus every file the tenant has in
// the private bucket, zipped, stored under account-exports/<userId>/ and
// emailed as a signed link that lives ACCOUNT_EXPORT_TTL_DAYS.
//
// Deletion: request → grace period (login blocked, sessions revoked, Stripe
// subscription cancelled, integrations disconnected so provider tokens are
// revoked) → the cron purges every row and file, except signed contracts and
// issued invoices which move under a tombstone id for ACCOUNT_RETENTION_YEARS
// (CRA books-and-records rule) → the cron removes those too.

import { createHash, randomBytes } from "node:crypto";
import { zipSync } from "fflate";
import * as schema from "@workspace/db";
import {
  db,
  accountExportsTable,
  accountDeletionsTable,
  authUsersTable,
  authSessionsTable,
  businessProfilesTable,
  organizationMembersTable,
  contractsTable,
  contractSignersTable,
  contractEventsTable,
  invoicesTable,
  invoicePaymentsTable,
  invoiceEventsTable,
  projectsTable,
  projectTasksTable,
  projectAssignmentsTable,
  extraCostsTable,
  costBudgetLinesTable,
  webhookEndpointsTable,
  webhookDeliveriesTable,
  financeitApplicationsTable,
  financeitLoanEventsTable,
  whatsappConnectionsTable,
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_RETENTION_YEARS,
  ACCOUNT_EXPORT_TTL_DAYS,
  tombstoneUserId,
  type AccountDeletion,
  type AccountExport,
} from "@workspace/db";
import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { logger } from "../lib/logger.js";
import { getUncachableStripeClient } from "../stripeClient.js";
import { disconnectCalendar } from "../calendar/service.js";
import { disconnectEmailAccount } from "../emailConnections/service.js";
import { disconnectQuickbooks } from "../quickbooks/service.js";
import { disconnectWave } from "../wave/service.js";
import { disconnectGoogleLsa } from "../googleLsa/service.js";
import { disconnectMetaLeadAds } from "../metaLeadAds/service.js";
import { disconnectFlinks } from "../flinks/service.js";
import { disconnectFinanceit } from "../financeit/service.js";
import { sendAccountExportReadyEmail, sendAccountDeletionScheduledEmail } from "./emails.js";
import { recordSecurityAuditEvent } from "../lib/auditLog.js";

const storage = new ObjectStorageService();

/** Every private-bucket prefix a tenant's files live under (see the `subPath` builders across routes/). */
const TENANT_STORAGE_KINDS = ["contracts", "invoices", "quote-pdfs", "capitolato-pdfs", "quote_attachments", "documents", "receipts", "job-photos", "imports", "logos"] as const;

// ── Table discovery ──────────────────────────────────────────────────────────
// Rather than hand-listing 60 tables (and forgetting the next one), walk the
// schema: anything with a user_id / owner_id column is tenant-scoped. Tables
// that hang off a parent without their own user_id are listed explicitly.

type AnyTable = PgTable;

function tenantTables(): { name: string; table: AnyTable; column: "userId" | "ownerId" }[] {
  const out: { name: string; table: AnyTable; column: "userId" | "ownerId" }[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const table = value;
    const cols = getTableColumns(table);
    const name = getTableName(table);
    if (name === "auth_user" || name === "account_exports" || name === "account_deletions") continue;
    if ("userId" in cols) out.push({ name, table, column: "userId" });
    else if ("ownerId" in cols) out.push({ name, table, column: "ownerId" });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Child tables keyed by a parent id instead of user_id: [table, its parent-id column, parent table, parent's user column]. */
const CHILD_TABLES: { table: AnyTable; via: string; parent: AnyTable }[] = [
  { table: contractSignersTable, via: "contractId", parent: contractsTable },
  { table: contractEventsTable, via: "contractId", parent: contractsTable },
  { table: invoiceEventsTable, via: "invoiceId", parent: invoicesTable },
  { table: projectTasksTable, via: "projectId", parent: projectsTable },
  { table: projectAssignmentsTable, via: "projectId", parent: projectsTable },
  { table: extraCostsTable, via: "projectId", parent: projectsTable },
  { table: costBudgetLinesTable, via: "projectId", parent: projectsTable },
  { table: webhookDeliveriesTable, via: "webhookId", parent: webhookEndpointsTable },
  { table: financeitLoanEventsTable, via: "applicationId", parent: financeitApplicationsTable },
];

// Never export credentials, even the user's own: password hashes, session
// tokens, encrypted provider tokens, API-key hashes, TOTP secrets and codes.
const SKIPPED_TABLES = new Set(["auth_session", "auth_account", "two_factor", "whatsapp_otp"]);
const REDACTED_COLUMN = /token|secret|password|hash|backupcodes|apikey|api_key|otp/i;

function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v !== null && v !== undefined && v !== "" && REDACTED_COLUMN.test(k) ? "[redacted]" : v;
  return out;
}

function col(table: AnyTable, key: string) {
  const c = getTableColumns(table)[key];
  if (!c) throw new Error(`Column ${key} missing on ${getTableName(table)}`);
  return c;
}

// ── Export ───────────────────────────────────────────────────────────────────

export async function requestAccountExport(params: { userId: string; requestedByUserId: string; email: string; language: "en" | "fr" }): Promise<{ export: AccountExport | null; retryAfterMs: number }> {
  const since = new Date(Date.now() - 24 * 3_600_000);
  const [recent] = await db
    .select({ createdAt: accountExportsTable.createdAt })
    .from(accountExportsTable)
    .where(and(eq(accountExportsTable.userId, params.userId), gt(accountExportsTable.createdAt, since)))
    .orderBy(desc(accountExportsTable.createdAt))
    .limit(1);
  if (recent) return { export: null, retryAfterMs: recent.createdAt.getTime() + 24 * 3_600_000 - Date.now() };
  const [row] = await db.insert(accountExportsTable).values({ userId: params.userId, requestedByUserId: params.requestedByUserId, email: params.email, language: params.language }).returning();
  return { export: row!, retryAfterMs: 0 };
}

/** Builds the ZIP for one export row. Idempotent: a retry rebuilds and re-uploads to the same path. */
export async function buildAccountExport(exportId: string): Promise<{ tables: number; files: number; bytes: number }> {
  const [row] = await db.select().from(accountExportsTable).where(eq(accountExportsTable.id, exportId));
  if (!row) throw new Error(`Export ${exportId} not found`);
  if (row.status === "ready") return { tables: row.tableCount ?? 0, files: row.fileCount ?? 0, bytes: row.sizeBytes ?? 0 };
  const userId = row.userId;

  try {
    const entries: Record<string, Uint8Array | [Uint8Array, { level: 0 | 6 }]> = {};
    const enc = new TextEncoder();
    const json = (name: string, data: unknown) => {
      entries[name] = [enc.encode(JSON.stringify(data, null, 2)), { level: 6 }];
    };

    const [user] = await db.select({ id: authUsersTable.id, name: authUsersTable.name, email: authUsersTable.email, createdAt: authUsersTable.createdAt }).from(authUsersTable).where(eq(authUsersTable.id, userId));
    const manifest: Record<string, unknown> = { exportedAt: new Date().toISOString(), account: user ?? { id: userId }, tables: {} as Record<string, number>, files: 0 };
    const tableCounts = manifest.tables as Record<string, number>;

    let tables = 0;
    for (const { name, table, column } of tenantTables()) {
      if (SKIPPED_TABLES.has(name)) continue;
      const rows = (await db.select().from(table).where(eq(col(table, column), userId))) as Record<string, unknown>[];
      if (rows.length === 0) continue;
      json(`data/${name}.json`, rows.map(redactRow));
      tableCounts[name] = rows.length;
      tables++;
    }
    for (const { table, via, parent } of CHILD_TABLES) {
      const name = getTableName(table);
      const parentIds = (await db.select({ id: col(parent, "id") }).from(parent).where(eq(col(parent, "userId"), userId))).map((r) => r.id as string);
      if (parentIds.length === 0) continue;
      const rows = (await db.select().from(table).where(inArray(col(table, via), parentIds))) as Record<string, unknown>[];
      if (rows.length === 0) continue;
      json(`data/${name}.json`, rows.map(redactRow));
      tableCounts[name] = rows.length;
      tables++;
    }

    let files = 0;
    for (const kind of TENANT_STORAGE_KINDS) {
      const objects = await storage.listPrivateObjects(`${kind}/${userId}`);
      for (const obj of objects) {
        const buf = await storage.downloadPrivateObjectBuffer(obj.path);
        // Drop the userId segment from the path inside the archive.
        const rel = obj.path.replace(`${kind}/${userId}/`, `${kind}/`);
        entries[`files/${rel}`] = [new Uint8Array(buf), { level: 0 }];
        files++;
      }
    }
    manifest.files = files;
    json("manifest.json", manifest);
    entries["README.txt"] = enc.encode(
      row.language === "fr"
        ? "Export de vos données QuoteAI.\n\ndata/ : une entrée JSON par table (les mots de passe, jetons et clés API sont masqués).\nfiles/ : vos PDF, photos, reçus et pièces jointes tels que stockés.\nmanifest.json : nombre de lignes par table et de fichiers.\n"
        : "Your QuoteAI data export.\n\ndata/: one JSON file per table (passwords, tokens and API keys are redacted).\nfiles/: your PDFs, photos, receipts and attachments as stored.\nmanifest.json: row counts per table and the file count.\n",
    );

    const zipped = zipSync(entries);
    const storagePath = `account-exports/${userId}/${row.id}.zip`;
    await storage.uploadObjectBuffer({ subPath: storagePath, buffer: Buffer.from(zipped), contentType: "application/zip" });
    const expiresAt = new Date(Date.now() + ACCOUNT_EXPORT_TTL_DAYS * 86_400_000);
    const url = await storage.getPresignedGetURL(storagePath, ACCOUNT_EXPORT_TTL_DAYS * 86_400);
    await db
      .update(accountExportsTable)
      .set({ status: "ready", storagePath, sizeBytes: zipped.byteLength, tableCount: tables, fileCount: files, readyAt: new Date(), expiresAt, error: null })
      .where(eq(accountExportsTable.id, row.id));
    await sendAccountExportReadyEmail({ toEmail: row.email, url, expiresAt, language: row.language, sizeBytes: zipped.byteLength });
    return { tables, files, bytes: zipped.byteLength };
  } catch (err) {
    await db.update(accountExportsTable).set({ status: "failed", error: (err instanceof Error ? err.message : String(err)).slice(0, 2000) }).where(eq(accountExportsTable.id, row.id));
    throw err;
  }
}

export async function listAccountExports(userId: string): Promise<(AccountExport & { downloadUrl: string | null })[]> {
  const rows = await db.select().from(accountExportsTable).where(eq(accountExportsTable.userId, userId)).orderBy(desc(accountExportsTable.createdAt)).limit(5);
  const out: (AccountExport & { downloadUrl: string | null })[] = [];
  for (const r of rows) {
    let downloadUrl: string | null = null;
    if (r.status === "ready" && r.storagePath && r.expiresAt && r.expiresAt > new Date()) {
      downloadUrl = await storage.getPresignedGetURL(r.storagePath, 3600).catch(() => null);
    }
    out.push({ ...r, downloadUrl });
  }
  return out;
}

/** Cron: drop ZIPs (and their rows) past their TTL. */
export async function expireAccountExports(now = new Date()): Promise<{ removed: number }> {
  const stale = await db.select().from(accountExportsTable).where(or(and(eq(accountExportsTable.status, "ready"), lte(accountExportsTable.expiresAt, now)), lte(accountExportsTable.createdAt, new Date(now.getTime() - 30 * 86_400_000))));
  for (const r of stale) {
    if (r.storagePath) await storage.removePrivateObjects([r.storagePath]).catch((err: unknown) => logger.warn({ err, path: r.storagePath }, "Could not remove expired export"));
    await db.delete(accountExportsTable).where(eq(accountExportsTable.id, r.id));
  }
  return { removed: stale.length };
}

// ── Deletion ─────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function findPendingDeletion(userId: string): Promise<AccountDeletion | null> {
  const [row] = await db
    .select()
    .from(accountDeletionsTable)
    .where(and(eq(accountDeletionsTable.userId, userId), isNull(accountDeletionsTable.cancelledAt), isNull(accountDeletionsTable.purgedAt)))
    .limit(1);
  return row ?? null;
}

async function cancelStripeSubscription(userId: string): Promise<boolean> {
  const [profile] = await db.select({ stripeCustomerId: businessProfilesTable.stripeCustomerId }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (!profile?.stripeCustomerId || !process.env.STRIPE_SECRET_KEY) return false;
  const stripe = await getUncachableStripeClient();
  const subs = await stripe.subscriptions.list({ customer: profile.stripeCustomerId, status: "active", limit: 10 });
  const trialing = await stripe.subscriptions.list({ customer: profile.stripeCustomerId, status: "trialing", limit: 10 });
  let cancelled = false;
  for (const sub of [...subs.data, ...trialing.data]) {
    await stripe.subscriptions.cancel(sub.id, { prorate: false });
    cancelled = true;
  }
  if (cancelled) await db.update(businessProfilesTable).set({ subscriptionStatus: "cancelled", subscriptionPlan: null }).where(eq(businessProfilesTable.userId, userId));
  return cancelled;
}

/** Revokes every provider token we hold for the org (each disconnect calls the provider's revoke endpoint where one exists) and drops the rows. */
async function disconnectAllIntegrations(userId: string): Promise<string[]> {
  const done: string[] = [];
  const attempt = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      done.push(name);
    } catch (err) {
      logger.warn({ err, userId, integration: name }, "Integration disconnect failed during account deletion (rows will still be purged)");
    }
  };
  await attempt("calendar:google", () => disconnectCalendar(userId, "google"));
  await attempt("calendar:outlook", () => disconnectCalendar(userId, "outlook"));
  await attempt("email:google", () => disconnectEmailAccount(userId, "google"));
  await attempt("quickbooks", () => disconnectQuickbooks(userId));
  await attempt("wave", () => disconnectWave(userId));
  await attempt("google-lsa", () => disconnectGoogleLsa(userId));
  await attempt("meta-lead-ads", () => disconnectMetaLeadAds(userId));
  await attempt("flinks", () => disconnectFlinks(userId));
  await attempt("financeit", () => disconnectFinanceit(userId));
  await attempt("whatsapp", async () => {
    await db.delete(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.userId, userId));
  });
  return done;
}

export async function requestAccountDeletion(params: { userId: string; email: string; language: "en" | "fr"; ip?: string | null; userAgent?: string | null }): Promise<{ deletion: AccountDeletion; alreadyPending: boolean }> {
  const existing = await findPendingDeletion(params.userId);
  if (existing) return { deletion: existing, alreadyPending: true };

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, params.userId));
  const cancelToken = randomBytes(32).toString("base64url");
  const scheduledFor = new Date(Date.now() + ACCOUNT_DELETION_GRACE_DAYS * 86_400_000);
  const [deletion] = await db
    .insert(accountDeletionsTable)
    .values({
      userId: params.userId,
      email: params.email,
      emailHash: sha256(params.email.trim().toLowerCase()),
      language: params.language,
      companyName: profile?.companyName ?? null,
      province: profile?.province ?? null,
      gstHstNumber: profile?.gstHstNumber ?? null,
      qstNumber: profile?.qstNumber ?? null,
      ownsProfile: Boolean(profile),
      cancelTokenHash: sha256(cancelToken),
      scheduledFor,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    })
    .returning();

  // Everything below is best-effort: the request is recorded first so the
  // cron purge happens regardless, and each step is idempotent for a retry.
  let stripeCancelled = false;
  try {
    stripeCancelled = await cancelStripeSubscription(params.userId);
  } catch (err) {
    logger.error({ err, userId: params.userId }, "Stripe subscription cancel failed during account deletion");
  }
  if (profile) await disconnectAllIntegrations(params.userId);
  // Log the requester out everywhere; requireAuth + the sign-in hook keep them out until the purge or a cancel.
  await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, params.userId));
  await db.update(accountDeletionsTable).set({ stripeSubscriptionCancelled: stripeCancelled }).where(eq(accountDeletionsTable.id, deletion!.id));

  await recordSecurityAuditEvent({ orgId: params.userId, actorUserId: params.userId, action: "account.deletion_requested", entityType: "security", entityId: deletion!.id, ipAddress: params.ip, userAgent: params.userAgent });
  try {
    await sendAccountDeletionScheduledEmail({ toEmail: params.email, scheduledFor, cancelToken, language: params.language, companyName: profile?.companyName ?? null });
  } catch (err) {
    logger.error({ err, userId: params.userId }, "Deletion-scheduled email failed");
  }
  return { deletion: { ...deletion!, stripeSubscriptionCancelled: stripeCancelled }, alreadyPending: false };
}

export async function cancelAccountDeletion(token: string): Promise<{ ok: boolean; language: "en" | "fr" }> {
  const [row] = await db
    .select()
    .from(accountDeletionsTable)
    .where(and(eq(accountDeletionsTable.cancelTokenHash, sha256(token)), isNull(accountDeletionsTable.cancelledAt), isNull(accountDeletionsTable.purgedAt)))
    .limit(1);
  if (!row) return { ok: false, language: "en" };
  await db.update(accountDeletionsTable).set({ cancelledAt: new Date(), cancelTokenHash: null }).where(eq(accountDeletionsTable.id, row.id));
  await recordSecurityAuditEvent({ orgId: row.userId, actorUserId: row.userId, action: "account.deletion_cancelled", entityType: "security", entityId: row.id });
  return { ok: true, language: row.language };
}

const RETAINED_INVOICE_STATUSES = ["sent", "viewed", "pending_confirmation", "partially_paid", "paid", "overdue"] as const;

/**
 * The hard delete. Moves signed contracts and issued invoices (with their
 * signers, events, payments and PDFs) under the tombstone id, then removes
 * every other row and file the account owns, then the auth user itself.
 */
async function purgeAccount(deletion: AccountDeletion): Promise<{ retainedContracts: number; retainedInvoices: number; filesRemoved: number }> {
  const userId = deletion.userId;
  const tomb = tombstoneUserId(deletion.id);
  const retainUntil = new Date(deletion.scheduledFor);
  retainUntil.setFullYear(retainUntil.getFullYear() + ACCOUNT_RETENTION_YEARS);

  // 1. Tombstone the CRA-retained records. Their FKs to quotes/clients/jobs are
  //    `set null`, so deleting the rest of the account afterwards leaves them intact.
  const retainedContracts = await db.update(contractsTable).set({ userId: tomb }).where(and(eq(contractsTable.userId, userId), eq(contractsTable.status, "signed"))).returning({ id: contractsTable.id });
  const retainedInvoices = await db.update(invoicesTable).set({ userId: tomb }).where(and(eq(invoicesTable.userId, userId), inArray(invoicesTable.status, [...RETAINED_INVOICE_STATUSES]))).returning({ id: invoicesTable.id });
  if (retainedInvoices.length) {
    await db.update(invoicePaymentsTable).set({ userId: tomb }).where(and(eq(invoicePaymentsTable.userId, userId), inArray(invoicePaymentsTable.invoiceId, retainedInvoices.map((r) => r.id))));
  }
  const keepPaths = new Set<string>();
  if (retainedContracts.length) {
    for (const obj of await storage.listPrivateObjects(`contracts/${userId}`)) {
      if (retainedContracts.some((c) => obj.path.startsWith(`contracts/${userId}/${c.id}/`))) keepPaths.add(obj.path);
    }
  }
  if (retainedInvoices.length) {
    for (const obj of await storage.listPrivateObjects(`invoices/${userId}`)) {
      if (retainedInvoices.some((i) => obj.path.startsWith(`invoices/${userId}/${i.id}/`))) keepPaths.add(obj.path);
    }
  }

  // 2. Files. Retained PDFs stay where they are (their URLs are stored on the rows).
  let filesRemoved = 0;
  for (const kind of [...TENANT_STORAGE_KINDS, "account-exports"]) {
    const objects = await storage.listPrivateObjects(`${kind}/${userId}`);
    const paths = objects.map((o) => o.path).filter((p) => !keepPaths.has(p));
    await storage.removePrivateObjects(paths);
    filesRemoved += paths.length;
  }

  // 3. Rows. Tenant tables first (children cascade), then memberships in both
  //    directions, then the auth user (sessions/accounts/2FA cascade from it).
  //    Retained contracts/invoices/payments already carry the tombstone id, so
  //    the plain user_id match here only removes the drafts and voids.
  for (const { table, column } of tenantTables()) {
    await db.delete(table).where(eq(col(table, column), userId));
  }
  await db.delete(organizationMembersTable).where(or(eq(organizationMembersTable.ownerId, userId), eq(organizationMembersTable.userId, userId)));
  await db.delete(authUsersTable).where(eq(authUsersTable.id, userId));

  await db
    .update(accountDeletionsTable)
    .set({ purgedAt: new Date(), email: null, cancelTokenHash: null, ip: null, userAgent: null, retainUntil, retainedContracts: retainedContracts.length, retainedInvoices: retainedInvoices.length, error: null })
    .where(eq(accountDeletionsTable.id, deletion.id));
  return { retainedContracts: retainedContracts.length, retainedInvoices: retainedInvoices.length, filesRemoved };
}

/** Removes the tombstoned records of a deletion whose retention period has ended. */
async function purgeRetainedRecords(deletion: AccountDeletion): Promise<{ contracts: number; invoices: number; files: number }> {
  const tomb = tombstoneUserId(deletion.id);
  const userId = deletion.userId;
  const contracts = await db.delete(contractsTable).where(eq(contractsTable.userId, tomb)).returning({ id: contractsTable.id });
  const invoices = await db.delete(invoicesTable).where(eq(invoicesTable.userId, tomb)).returning({ id: invoicesTable.id });
  await db.delete(invoicePaymentsTable).where(eq(invoicePaymentsTable.userId, tomb));
  let files = 0;
  for (const kind of ["contracts", "invoices"]) {
    const paths = (await storage.listPrivateObjects(`${kind}/${userId}`)).map((o) => o.path);
    await storage.removePrivateObjects(paths);
    files += paths.length;
  }
  await db.update(accountDeletionsTable).set({ retentionPurgedAt: new Date(), companyName: null, gstHstNumber: null, qstNumber: null }).where(eq(accountDeletionsTable.id, deletion.id));
  return { contracts: contracts.length, invoices: invoices.length, files };
}

/** Cron: run every due purge (grace period over) and every due retention purge (7 years over). */
export async function runAccountDeletionMaintenance(now = new Date()): Promise<{ purged: number; retentionPurged: number; failed: number }> {
  let purged = 0;
  let retentionPurged = 0;
  let failed = 0;

  const due = await db
    .select()
    .from(accountDeletionsTable)
    .where(and(isNull(accountDeletionsTable.cancelledAt), isNull(accountDeletionsTable.purgedAt), lte(accountDeletionsTable.scheduledFor, now)))
    .limit(20);
  for (const d of due) {
    try {
      const result = await purgeAccount(d);
      logger.info({ deletionId: d.id, ...result }, "Account purged");
      purged++;
    } catch (err) {
      failed++;
      logger.error({ err, deletionId: d.id }, "Account purge failed");
      await db.update(accountDeletionsTable).set({ error: (err instanceof Error ? err.message : String(err)).slice(0, 2000) }).where(eq(accountDeletionsTable.id, d.id));
    }
  }

  const expired = await db
    .select()
    .from(accountDeletionsTable)
    .where(and(isNull(accountDeletionsTable.retentionPurgedAt), lte(accountDeletionsTable.retainUntil, now)))
    .limit(20);
  for (const d of expired) {
    try {
      await purgeRetainedRecords(d);
      retentionPurged++;
    } catch (err) {
      failed++;
      logger.error({ err, deletionId: d.id }, "Retention purge failed");
    }
  }
  return { purged, retentionPurged, failed };
}

/** Days left in the grace period, for the UI and the sign-in error. */
export function daysUntil(date: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 86_400_000));
}
