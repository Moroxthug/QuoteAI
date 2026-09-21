// Phase 66 — remove everything a walkthrough account created (quotes,
// contracts, jobs, invoices, workers, PDFs in storage) and the account itself.
//
//   pnpm --filter @workspace/api-server walkthrough:cleanup walkthrough.on@example.com
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of (() => { try { return readFileSync(resolve(import.meta.dirname, "../../../../.env.staging"), "utf8").split(/\r?\n/); } catch { return []; } })()) {
  const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (!m) continue;
  let value = m[2]!;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (value !== "") process.env[m[1]!] ??= value;
}

// harness.ts imports the app, which builds its AI client at import time.
process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??= "cleanup-no-ai";
process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ??= "http://127.0.0.1:9/v1";
process.env.BETTER_AUTH_SECRET ??= "cleanup-secret-not-for-production-0000";
process.env.TOKEN_ENCRYPTION_KEY ??= "0".repeat(64);
process.env.LOG_LEVEL ??= "warn";

const emails = process.argv.slice(2).map((e) => e.toLowerCase());
if (emails.length === 0) {
  console.error("usage: walkthrough:cleanup <email> [<email>…]");
  process.exit(2);
}
const { db, authUsersTable } = await import("@workspace/db");
const { inArray } = await import("drizzle-orm");
const { cleanupUsers } = await import("./harness.js");
const users = await db.select({ id: authUsersTable.id, email: authUsersTable.email }).from(authUsersTable).where(inArray(authUsersTable.email, emails));
if (users.length === 0) {
  console.log("no matching users");
  process.exit(0);
}
await cleanupUsers(users.map((u) => u.id));
console.log(`removed ${users.map((u) => u.email).join(", ")}`);
process.exit(0);
