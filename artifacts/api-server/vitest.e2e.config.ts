import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Phase 63 (docs/QA-VERIFICATION-PLAN.md): the e2e suite runs against a real
// database. Locally the credentials come from `.env.staging` at the repo root
// (gitignored — `vercel env pull .env.staging --environment production`); in
// CI they come from GitHub secrets. Never point this at data you care about:
// every test creates and deletes real users, quotes, contracts, invoices and
// storage objects.
//
//   pnpm --filter @workspace/api-server test:e2e
//   E2E_REAL_AI=1 pnpm --filter @workspace/api-server test:e2e   # keep the AI keys

function loadDotenv(path: string) {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2]!;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    // Vercel marks secrets "Sensitive" and pulls them as empty strings —
    // leave those unset so vitest.e2e.setup.ts can apply its defaults.
    if (value !== "") process.env[m[1]!] ??= value;
  }
}

loadDotenv(resolve(__dirname, "../../.env.staging"));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/e2e/**/*.e2e.test.ts"],
    setupFiles: ["./vitest.e2e.setup.ts"],
    // Every file shares one database and one in-process server; run them one
    // at a time so per-user rate limiters and sequence counters stay predictable.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
