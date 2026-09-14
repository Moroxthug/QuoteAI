import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // A few `*.test.ts` files predate this vitest setup and are plain
    // `node:assert` scripts meant to be run manually (`npx tsx <file>`, per
    // their own header comment), not vitest suites — e.g.
    // src/analytics/math.test.ts, src/invoices/math.test.ts. The e2e suite
    // needs a live AI API key and is excluded from the default unit run too.
    exclude: ["**/node_modules/**", "src/analytics/math.test.ts", "src/invoices/math.test.ts", "src/e2e/**"],
  },
});
