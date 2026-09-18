// Flat ESLint config for the whole workspace (Phase 61).
// Scope: TypeScript sources of both apps plus the hand-written lib/ code.
// Generated clients (orval output), build output and the pixel mockups are ignored.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.vercel/**",
      "**/*.d.ts",
      "lib/api-client-react/src/generated/**",
      "lib/api-zod/src/generated/**",
      "artifacts/quote-ai/public/**",
      "artifacts/quote-ai/server/**",
      "docs/**",
      "supabase/**",
      "api/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.es2023 },
    },
    rules: {
      // Unused code is the main thing this config exists to catch.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // The codebase leans on `any` at the API/DB edges; keep it a warning so the
      // count is visible without blocking CI.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": "allow-with-description" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-constant-condition": ["error", { checkLoops: false }],
      "prefer-const": ["error", { destructuring: "all" }],
    },
  },
  {
    files: ["artifacts/quote-ai/src/**/*.{ts,tsx}", "lib/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // AudioWorklet processors run in the worklet global scope.
    files: ["**/audio-playback-worklet.js"],
    languageOptions: { globals: { AudioWorkletProcessor: "readonly", registerProcessor: "readonly", sampleRate: "readonly" } },
  },
  {
    // Test files: allow `any`-heavy fixtures.
    files: ["**/*.test.{ts,tsx}", "**/e2e/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  }
);
