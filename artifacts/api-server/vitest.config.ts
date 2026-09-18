import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // The e2e suite needs a disposable database + AI key (Phase 63) and is
    // excluded from the default unit run.
    exclude: ["**/node_modules/**", "src/e2e/**"],
  },
});
