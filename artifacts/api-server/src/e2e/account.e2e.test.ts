// Phase 72 — account export + deletion (docs/PILOT-LAUNCH-PLAN.md).
//
// Export: an owner with one of everything asks for a ZIP; it is built inline,
// stored, emailed as a signed link, downloadable, and holds the rows and PDFs
// with credentials redacted. A second request the same day is refused.
// Deletion: password re-auth, every session dies, sign-in is refused during
// the grace period with a dated message, the emailed cancel link reopens the
// account, and the cron purge removes everything except the signed contract
// and the issued invoices, which survive under the tombstone id with their
// PDFs until the 7-year purge removes them too.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { unzipSync } from "fflate";
import { db, authUsersTable, authAccountsTable, authSessionsTable, businessProfilesTable, quotesTable, contractsTable, invoicesTable, accountDeletionsTable, accountExportsTable, clientsTable, organizationMembersTable, tombstoneUserId, INVOICE_STATUSES } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import "../automations/index.js";
import { auth } from "../lib/auth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { runAccountDeletionMaintenance, expireAccountExports } from "../account/service.js";
import { startServer, stopServer, api, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";
import { seedShowcase, type Showcase } from "./fixtures.js";
import { emailsTo, linksIn } from "./mailbox.js";

const storage = new ObjectStorageService();
const PASSWORD = "E2e-Del3te-Me!!";
let baseUrl = "";
let owner: TestUser & { province: "ON" | "QC" };
let showcase: Showcase;

async function givePassword(user: TestUser): Promise<void> {
  const ctx = await auth.$context;
  await db.insert(authAccountsTable).values({ id: randomUUID(), accountId: user.userId, providerId: "credential", userId: user.userId, password: await ctx.password.hash(PASSWORD) });
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const body = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
  return { status: res.status, body, token: res.headers.get("set-auth-token") };
}

function onTestServer(url: string): string {
  const u = new URL(url);
  const b = new URL(baseUrl);
  u.protocol = b.protocol;
  u.host = b.host;
  return u.toString();
}

beforeAll(async () => {
  baseUrl = await startServer();
  owner = await createOrg({ province: "QC", companyName: "E2E Delete Co" });
  await givePassword(owner);
  showcase = await seedShowcase(owner);
}, 180_000);

afterAll(async () => {
  // Tombstoned rows carry `tombstone:<id>` as user_id, which the harness sweep would miss.
  const deletions = await db.select().from(accountDeletionsTable).where(eq(accountDeletionsTable.userId, owner.userId));
  for (const d of deletions) {
    await db.delete(contractsTable).where(eq(contractsTable.userId, tombstoneUserId(d.id)));
    await db.delete(invoicesTable).where(eq(invoicesTable.userId, tombstoneUserId(d.id)));
  }
  await cleanupAll();
  await stopServer();
});

describe("data export", () => {
  test("a member without a company of their own cannot export", async () => {
    const member = await createUser();
    await db.insert(organizationMembersTable).values({ ownerId: owner.userId, userId: member.userId, role: "admin", status: "active", invitedEmail: member.email, invitedByUserId: owner.userId, joinedAt: new Date() });
    const res = await member.api("/api/account/export", { method: "POST", body: {} });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("OWNER_ONLY");
    const status = await member.api("/api/account");
    expect(status.status).toBe(200);
    expect(status.body.ownsProfile).toBe(false);
    expect(status.body.canExport).toBe(false);
    expect(status.body.canDelete).toBe(true);
  });

  test("the owner gets a ZIP: every table as JSON, every PDF, credentials redacted, link emailed; one per day", async () => {
    const res = await owner.api("/api/account/export", { method: "POST", body: { language: "fr" } });
    expect(res.status, JSON.stringify(res.body)).toBe(202);
    expect(res.body.status).toBe("ready");

    const status = await owner.api("/api/account");
    expect(status.status).toBe(200);
    const [exp] = status.body.exports as { id: string; status: string; downloadUrl: string | null; tableCount: number; fileCount: number; sizeBytes: number }[];
    expect(exp!.status).toBe("ready");
    expect(exp!.downloadUrl).toMatch(/^https?:\/\//);
    expect(exp!.tableCount).toBeGreaterThan(10);
    expect(exp!.fileCount).toBeGreaterThan(0);

    const mail = emailsTo(owner.email).find((m) => /export/i.test(m.subject));
    expect(mail, "export email").toBeTruthy();
    expect(mail!.subject).toContain("prêt");
    expect(linksIn(mail!).some((l) => l.includes("account-exports"))).toBe(true);

    const zipRes = await fetch(exp!.downloadUrl!);
    expect(zipRes.status).toBe(200);
    const files = unzipSync(new Uint8Array(await zipRes.arrayBuffer()));
    const names = Object.keys(files);
    const read = (n: string) => new TextDecoder().decode(files[n]!);
    expect(names).toContain("manifest.json");
    expect(names).toContain("README.txt");
    expect(read("README.txt")).toContain("Export de vos données");
    expect(names).toContain("data/quotes.json");
    expect(names).toContain("data/contracts.json");
    expect(names).toContain("data/contract_signers.json");
    expect(names).toContain("data/invoices.json");
    expect(names).toContain("data/business_profiles.json");
    expect(names.some((n) => n.startsWith("files/contracts/") && n.endsWith(".pdf"))).toBe(true);
    expect(names.some((n) => n.startsWith("files/invoices/") && n.endsWith(".pdf"))).toBe(true);
    // Never credentials.
    expect(names).not.toContain("data/auth_account.json");
    expect(names).not.toContain("data/auth_session.json");
    expect(names).not.toContain("data/two_factor.json");
    const quotes = JSON.parse(read("data/quotes.json")) as { id: string }[];
    expect(quotes.map((q) => q.id)).toContain(showcase.quoteId);
    const signers = JSON.parse(read("data/contract_signers.json")) as Record<string, unknown>[];
    expect(signers.length).toBeGreaterThan(0);
    for (const s of signers) for (const [k, v] of Object.entries(s)) if (/token/i.test(k) && v !== null) expect(v).toBe("[redacted]");
    const manifest = JSON.parse(read("manifest.json")) as { tables: Record<string, number>; files: number };
    expect(manifest.tables.quotes).toBe(quotes.length);
    expect(manifest.files).toBe(exp!.fileCount);

    const again = await owner.api("/api/account/export", { method: "POST", body: {} });
    expect(again.status).toBe(429);
    expect(again.body.code).toBe("EXPORT_RATE_LIMITED");
    expect(again.headers.get("retry-after")).toBeTruthy();
  });

  test("expired exports are removed from storage and the table by the cron", async () => {
    const [row] = await db.select().from(accountExportsTable).where(eq(accountExportsTable.userId, owner.userId));
    expect(row?.storagePath).toBeTruthy();
    const before = await storage.listPrivateObjects(`account-exports/${owner.userId}`);
    expect(before.map((o) => o.path)).toContain(row!.storagePath);
    const result = await expireAccountExports(new Date(Date.now() + 8 * 86_400_000));
    expect(result.removed).toBeGreaterThanOrEqual(1);
    const after = await storage.listPrivateObjects(`account-exports/${owner.userId}`);
    expect(after.map((o) => o.path)).not.toContain(row!.storagePath);
    expect((await db.select().from(accountExportsTable).where(eq(accountExportsTable.id, row!.id))).length).toBe(0);
  });
});

describe("account deletion", () => {
  let cancelLink = "";

  test("needs the right password; then every session is revoked and the grace period starts", async () => {
    const bad = await owner.api("/api/account", { method: "DELETE", body: { password: "nope" } });
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe("INVALID_PASSWORD");
    const none = await owner.api("/api/account", { method: "DELETE", body: {} });
    expect(none.status).toBe(400);

    const res = await owner.api("/api/account", { method: "DELETE", body: { password: PASSWORD, language: "en" } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.alreadyPending).toBe(false);
    const scheduled = new Date(res.body.scheduledFor).getTime() - Date.now();
    expect(scheduled).toBeGreaterThan(6.9 * 86_400_000);
    expect(scheduled).toBeLessThanOrEqual(7 * 86_400_000);

    // The bearer session that made the request is gone with the rest.
    expect((await db.select().from(authSessionsTable).where(eq(authSessionsTable.userId, owner.userId))).length).toBe(0);
    expect((await owner.api("/api/account")).status).toBe(401);

    const [d] = await db.select().from(accountDeletionsTable).where(eq(accountDeletionsTable.userId, owner.userId));
    expect(d?.ownsProfile).toBe(true);
    expect(d?.companyName).toBe("E2E Delete Co");
    expect(d?.qstNumber).toBeTruthy();
    expect(d?.cancelTokenHash).toBeTruthy();

    const mail = emailsTo(owner.email).find((m) => /deletion|suppression/i.test(m.subject));
    expect(mail, "deletion email").toBeTruthy();
    expect(mail!.subject).toContain("deletion is scheduled");
    cancelLink = linksIn(mail!).find((l) => l.includes("/api/account/deletion/cancel/"))!;
    expect(cancelLink).toBeTruthy();
  });

  test("sign-in during the grace period is refused with the date; the cancel link reopens the account", async () => {
    const blocked = await signIn(owner.email, PASSWORD);
    expect(blocked.status).toBe(403);
    expect(blocked.body?.code).toBe("ACCOUNT_DELETION_PENDING");
    expect(blocked.body?.message).toMatch(/scheduled for deletion on \w+ \d+, 2026/);
    expect(blocked.token).toBeNull();
    expect((await db.select().from(authSessionsTable).where(eq(authSessionsTable.userId, owner.userId))).length).toBe(0);
    const wrong = await signIn(owner.email, "definitely-wrong");
    expect(wrong.status).toBe(401);

    const bogus = await fetch(`${baseUrl}/api/account/deletion/cancel/${"x".repeat(43)}`, { redirect: "manual" });
    expect(bogus.status).toBe(302);
    expect(bogus.headers.get("location")).toContain("deletion=invalid");

    const cancel = await fetch(onTestServer(cancelLink), { redirect: "manual" });
    expect(cancel.status).toBe(302);
    expect(cancel.headers.get("location")).toContain("/sign-in/?deletion=cancelled");
    const replay = await fetch(onTestServer(cancelLink), { redirect: "manual" });
    expect(replay.headers.get("location")).toContain("deletion=invalid");

    const ok = await signIn(owner.email, PASSWORD);
    expect(ok.status).toBe(200);
    expect(ok.token).toBeTruthy();
    // The rest of the suite uses the harness bearer; put one back.
    owner = { ...owner, token: ok.token!, api: (path, o = {}) => api(path, { ...o, token: ok.token! }) };
    const status = await owner.api("/api/account");
    expect(status.body.pendingDeletion).toBeNull();
  });

  test("the cron purge erases the account but keeps the signed contract and issued invoices (with PDFs) under the tombstone", async () => {
    const res = await owner.api("/api/account", { method: "DELETE", body: { password: PASSWORD } });
    expect(res.status).toBe(200);
    const pending = (await db.select().from(accountDeletionsTable).where(eq(accountDeletionsTable.userId, owner.userId))).find((x) => !x.cancelledAt && !x.purgedAt)!;
    expect(pending).toBeTruthy();

    // Nothing happens before the date…
    expect((await runAccountDeletionMaintenance(new Date())).purged).toBe(0);
    expect((await db.select().from(authUsersTable).where(eq(authUsersTable.id, owner.userId))).length).toBe(1);

    const signedBefore = await db.select().from(contractsTable).where(and(eq(contractsTable.userId, owner.userId), eq(contractsTable.status, "signed")));
    expect(signedBefore.length).toBeGreaterThanOrEqual(1);
    const issuedBefore = await db.select().from(invoicesTable).where(and(eq(invoicesTable.userId, owner.userId), inArray(invoicesTable.status, INVOICE_STATUSES.filter((s) => s !== "draft" && s !== "void"))));
    expect(issuedBefore.length).toBeGreaterThanOrEqual(2);
    const contractPdfs = (await storage.listPrivateObjects(`contracts/${owner.userId}`)).map((o) => o.path);
    const signedPdf = contractPdfs.find((p) => p.includes(`/${signedBefore[0]!.id}/`) && p.includes("signed-"));
    expect(signedPdf, "signed contract PDF in storage").toBeTruthy();
    const quotePdfs = (await storage.listPrivateObjects(`quote-pdfs/${owner.userId}`)).length + (await storage.listPrivateObjects(`invoices/${owner.userId}`)).length;
    expect(quotePdfs).toBeGreaterThan(0);

    // …and on the date the account is gone.
    const result = await runAccountDeletionMaintenance(new Date(pending.scheduledFor.getTime() + 1000));
    expect(result).toMatchObject({ purged: 1, failed: 0 });
    expect((await db.select().from(authUsersTable).where(eq(authUsersTable.id, owner.userId))).length).toBe(0);
    expect((await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, owner.userId))).length).toBe(0);
    expect((await db.select().from(quotesTable).where(eq(quotesTable.userId, owner.userId))).length).toBe(0);
    expect((await db.select().from(clientsTable).where(eq(clientsTable.userId, owner.userId))).length).toBe(0);
    expect((await db.select().from(contractsTable).where(eq(contractsTable.userId, owner.userId))).length).toBe(0);
    expect((await db.select().from(invoicesTable).where(eq(invoicesTable.userId, owner.userId))).length).toBe(0);
    expect((await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.ownerId, owner.userId))).length).toBe(0);
    expect(await storage.listPrivateObjects(`quote-pdfs/${owner.userId}`)).toEqual([]);
    expect(await storage.listPrivateObjects(`documents/${owner.userId}`)).toEqual([]);

    const tomb = tombstoneUserId(pending.id);
    const kept = await db.select().from(contractsTable).where(eq(contractsTable.userId, tomb));
    expect(kept.map((c) => c.id).sort()).toEqual(signedBefore.map((c) => c.id).sort());
    expect(kept.every((c) => c.status === "signed")).toBe(true);
    const keptInvoices = await db.select().from(invoicesTable).where(eq(invoicesTable.userId, tomb));
    expect(keptInvoices.map((i) => i.id).sort()).toEqual(issuedBefore.map((i) => i.id).sort());
    const pdfsAfter = (await storage.listPrivateObjects(`contracts/${owner.userId}`)).map((o) => o.path);
    expect(pdfsAfter).toContain(signedPdf);
    expect(pdfsAfter.every((p) => kept.some((c) => p.includes(`/${c.id}/`)))).toBe(true);

    const [after] = await db.select().from(accountDeletionsTable).where(eq(accountDeletionsTable.id, pending.id));
    expect(after!.purgedAt).toBeTruthy();
    expect(after!.email).toBeNull();
    expect(after!.retainedContracts).toBe(kept.length);
    expect(after!.retainedInvoices).toBe(keptInvoices.length);
    expect(after!.retainUntil!.getFullYear()).toBe(pending.scheduledFor.getFullYear() + 7);
    // A tombstoned email can no longer sign in — the user row is gone.
    expect((await signIn(owner.email, PASSWORD)).status).toBe(401);
  });

  test("the 7-year purge removes the tombstoned records and their PDFs", async () => {
    const rows = await db.select().from(accountDeletionsTable).where(eq(accountDeletionsTable.userId, owner.userId));
    const purged = rows.find((r) => r.purgedAt)!;
    expect((await runAccountDeletionMaintenance(new Date())).retentionPurged).toBe(0);
    const result = await runAccountDeletionMaintenance(new Date(purged.retainUntil!.getTime() + 1000));
    expect(result.retentionPurged).toBe(1);
    expect((await db.select().from(contractsTable).where(eq(contractsTable.userId, tombstoneUserId(purged.id)))).length).toBe(0);
    expect((await db.select().from(invoicesTable).where(eq(invoicesTable.userId, tombstoneUserId(purged.id)))).length).toBe(0);
    expect(await storage.listPrivateObjects(`contracts/${owner.userId}`)).toEqual([]);
    expect(await storage.listPrivateObjects(`invoices/${owner.userId}`)).toEqual([]);
    const [final] = await db.select().from(accountDeletionsTable).where(eq(accountDeletionsTable.id, purged.id));
    expect(final!.retentionPurgedAt).toBeTruthy();
    expect(final!.companyName).toBeNull();
    expect(final!.emailHash).toBeTruthy();
  });
});
