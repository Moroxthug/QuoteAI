import { defineConfig, transformWithEsbuild, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { readFile, stat } from "node:fs/promises";

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
// Phase 115: one dictionary chunk per language. The strings are authored as
// { en, fr } in one file (translations.ts, translations.dashboard.ts — the
// i18n audit and every phase edit them that way), but a visitor only ever
// needs one language: shipping both was ~half of the App and dashboard
// chunks. `virtual:i18n/<pack>/<lang>` evaluates the source file at build
// time and emits just that language as JSON.parse(...) (parsed faster than an
// object literal of the same size); src/i18n/registry.ts loads the one it needs.
const I18N_PACKS = {
  core: { file: path.resolve(import.meta.dirname, "src/i18n/translations.ts"), exportName: "translations" },
  dashboard: { file: path.resolve(import.meta.dirname, "src/i18n/translations.dashboard.ts"), exportName: "dashboardTranslations" },
} as const;
const I18N_ID = /^virtual:i18n\/(core|dashboard)\/(en|fr)$/;
const i18nCache = new Map<string, { mtimeMs: number; mod: Record<string, Record<string, Record<string, string>>> }>();
async function loadDictionaries(file: string) {
  const { mtimeMs } = await stat(file);
  const hit = i18nCache.get(file);
  if (hit && hit.mtimeMs === mtimeMs) return hit.mod;
  // Pure data plus `import type` (erased by esbuild), so it runs on its own.
  const { code } = await transformWithEsbuild(await readFile(file, "utf8"), file, { loader: "ts", format: "esm" });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  i18nCache.set(file, { mtimeMs, mod });
  return mod;
}
function i18nSplitPlugin(): Plugin {
  return {
    name: "quoteai-i18n-split",
    resolveId(id) {
      return I18N_ID.test(id) ? `\0${id}` : undefined;
    },
    async load(id) {
      const m = I18N_ID.exec(id.replace(/^\0/, ""));
      if (!m || !id.startsWith("\0")) return;
      const pack = I18N_PACKS[m[1] as keyof typeof I18N_PACKS];
      this.addWatchFile(pack.file);
      const dict = (await loadDictionaries(pack.file))[pack.exportName]?.[m[2]!];
      if (!dict) throw new Error(`[i18n-split] ${pack.exportName}.${m[2]} not found in ${pack.file}`);
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(dict))});`;
    },
    handleHotUpdate({ file, server }) {
      if (!Object.values(I18N_PACKS).some((p) => path.resolve(file) === p.file)) return;
      for (const mod of server.moduleGraph.idToModuleMap.values()) {
        if (mod.id && I18N_ID.test(mod.id.replace(/^\0/, ""))) server.moduleGraph.invalidateModule(mod);
      }
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}

// Phase 115: which chunk each lazy module landed in. Vite's manifest keys some
// dynamic entries by their output name instead of their source (App.tsx,
// pages/dashboard/settings/index.tsx), so scripts/bundle-budget.ts reads this
// map — source path → chunk file — to find a screen's chunk from its source.
function chunkMapPlugin(): Plugin {
  return {
    name: "quoteai-chunk-map",
    generateBundle(_options, bundle) {
      const map: Record<string, string> = {};
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        // Every module, not just the facade: a lazy module that Rollup merged
        // into a shared chunk has no facade of its own.
        for (const moduleId of chunk.moduleIds) {
          const id = moduleId.replace(/^\0/, "");
          if (id.includes("node_modules")) continue;
          map[id.startsWith("virtual:") ? id : path.relative(import.meta.dirname, id).split(path.sep).join("/")] = chunk.fileName;
        }
      }
      this.emitFile({ type: "asset", fileName: ".vite/chunk-map.json", source: JSON.stringify(map, null, 1) });
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

// Phase 118: `vite build --mode native` is the phone app's bundle (artifacts/mobile
// copies it into the Capacitor project). The flag is a build-time constant, so
// every native-only branch is dropped from the website's bundle; the app talks
// to the API at VITE_API_ORIGIN (the live site unless a dev build says otherwise).
const NATIVE_API_ORIGIN = process.env.VITE_API_ORIGIN ?? "https://quoteai.ca";

export default defineConfig(({ isSsrBuild, mode }) => {
  const native = mode === "native";
  return {
  base: native ? "/" : basePath,
  define: {
    "import.meta.env.VITE_RELEASE": JSON.stringify(release),
    "import.meta.env.VITE_NATIVE": JSON.stringify(native ? "1" : ""),
    "import.meta.env.VITE_API_ORIGIN": JSON.stringify(native ? NATIVE_API_ORIGIN : ""),
    // Phase 119: set by artifacts/mobile/scripts/build-web.ts when the Android project has its google-services.json.
    "import.meta.env.VITE_APP_PUSH": JSON.stringify(native && process.env.VITE_APP_PUSH === "1" ? "1" : ""),
  },
  plugins: [
    react(),
    tailwindcss(),
    i18nSplitPlugin(),
    ...(isSsrBuild || native ? [] : [widgetPlugin(), chunkMapPlugin()]),
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
    outDir: native ? path.resolve(import.meta.dirname, process.env.NATIVE_OUT_DIR ?? "dist/native") : path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Phase 77: scripts/build-sw.ts reads the chunk graph to precache the app shell.
    manifest: !isSsrBuild && !native,
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
          // Phase 115: name the string packs (strings-core-en, strings-dashboard-fr…).
          const pack = I18N_ID.exec(id.replace(/^\0/, ""));
          if (pack) return `strings-${pack[1]}-${pack[2]}`;
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
};
});
