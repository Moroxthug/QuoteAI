// Phase 66 — remove everything a walkthrough account created (quotes,
// contracts, jobs, invoices, workers, PDFs in storage) and the account itself.
//
//   pnpm --filter @workspace/api-server walkthrough:cleanup walkthrough.on@example.com
import { bootstrapQaEnv } from "./qaEnv.js";

// harness.ts imports the app, which builds its AI client at import time.
bootstrapQaEnv("cleanup");

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
