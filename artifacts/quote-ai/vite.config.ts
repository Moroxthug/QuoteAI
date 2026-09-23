import { defineConfig, transformWithEsbuild, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { readFile } from "node:fs/promises";

// Phase 92: /widget.js, the snippet contractors paste on their own sites.
// One self-contained file compiled on its own to an IIFE — no React, no
// chunks, nothing shared with the app bundle — served live in dev and
// emitted at the root of dist/public in the client build.
const WIDGET_SRC = path.resolve(import.meta.dirname, "src/widget/widget.ts");
async function compileWidget(minify: boolean): Promise<string> {
  const source = await readFile(WIDGET_SRC, "utf8");
  const out = await transformWithEsbuild(source, WIDGET_SRC, { loader: "ts", format: "iife", target: "es2019", minify, legalComments: "none" });
  return out.code;
}
function widgetPlugin(): Plugin {
  return {
    name: "quoteai-widget",
    configureServer(server) {
      server.middlewares.use("/widget.js", (_req, res, next) => {
        compileWidget(false).then((code) => {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.end(code);
        }, next);
      });
    },
    async generateBundle() {
      this.emitFile({ type: "asset", fileName: "widget.js", source: await compileWidget(true) });
    },
  };
}
const port = Number(process.env.PORT ?? "5173");
const basePath = process.env.BASE_PATH ?? "/";

// Phase 69: the commit becomes the Sentry release (VERCEL_GIT_COMMIT_SHA is
// set at build time on Vercel), and source maps are emitted only when a
// SENTRY_AUTH_TOKEN is present to upload them — scripts/sentry-sourcemaps.mjs
// deletes them from dist/public after the upload so they are never served.
const release = process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "";
const emitSourcemaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default defineConfig(({ isSsrBuild }) => ({
  base: basePath,
  define: {
    "import.meta.env.VITE_RELEASE": JSON.stringify(release),
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(isSsrBuild ? [] : [widgetPlugin()]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  ssr: {
    // CommonJS packages whose named exports tsx (which runs the prerender script) cannot resolve: bundle them into dist/server.
    noExternal: ["react-helmet-async"],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Phase 77: scripts/build-sw.ts reads the chunk graph to precache the app shell.
    manifest: !isSsrBuild,
    chunkSizeWarningLimit: 500,
    sourcemap: emitSourcemaps && !isSsrBuild ? "hidden" : false,
    rollupOptions: {
      output: {
        // Not for the SSR build of entry-server.tsx (one Node file; Rollup rejects manual chunks there).
        manualChunks: isSsrBuild ? undefined : (id) => {
          // Only long-lived vendor libraries are grouped by hand (cache stability).
          // recharts is deliberately NOT grouped: a manual chunk drags its whole
          // dependency tree in and every page chunk ended up importing it. Grouping app pages into a
          // manual chunk made Rollup pull every shared module those pages touch
          // (ui/*, hooks, the auth client) into that chunk, so the public entry
          // ended up statically importing — and modulepreloading — the whole
          // 1.5 MB dashboard bundle on the marketing homepage (Phase 61).
          // Lazy routes now split naturally, one chunk per page.
          // @radix-ui used to be grouped too: a grouped chunk holds every
          // primitive used anywhere, and the public entry (which needs only
          // Tooltip/Toast) had to load all 136 kB of it on the homepage.
          // Rollup now splits it by usage (Phase 68). lucide-react stays
          // grouped — split by usage it became ~150 one-icon chunks.
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          if (
            id.includes("node_modules/react-helmet-async") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/wouter")
          ) {
            return "vendor-react";
          }
          if (
            id.includes("node_modules/@tanstack/react-query") ||
            id.includes("node_modules/@tanstack/query-core")
          ) {
            return "vendor-query";
          }
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // In produzione frontend e API condividono lo stesso dominio (un solo
    // deploy Vercel); in dev locale girano su porte separate, quindi le
    // fetch relative a /api/* servono questo proxy per raggiungere l'api-server.
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
}));
