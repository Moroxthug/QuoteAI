// Rewrites the 'sha256-…' entries of the page CSP's script-src in vercel.json
// from the inline scripts currently in artifacts/quote-ai/index.html.
// Run after editing any inline <script> in index.html; scripts/security-headers.test.ts
// fails CI until this has been run.
//
//   pnpm --filter @workspace/api-server csp-hashes

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inlineScriptHashes } from "./csp.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const VERCEL_JSON = join(ROOT, "vercel.json");
const INDEX_HTML = join(ROOT, "artifacts/quote-ai/index.html");

type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };

const cfg = JSON.parse(readFileSync(VERCEL_JSON, "utf8")) as { headers?: HeaderRule[] };
const rule = cfg.headers?.find((h) => h.source === "/((?!api/).*)");
const csp = rule?.headers.find((h) => h.key === "Content-Security-Policy");
if (!rule || !csp) throw new Error("vercel.json: no Content-Security-Policy on the page header rule");

const hashes = inlineScriptHashes(readFileSync(INDEX_HTML, "utf8"));
const directives = csp.value.split(";").map((s) => s.trim()).filter(Boolean);
const i = directives.findIndex((d) => d.startsWith("script-src "));
if (i === -1) throw new Error("CSP has no script-src directive");
const kept = directives[i]!.split(/\s+/).slice(1).filter((s) => !s.startsWith("'sha256-"));
// 'self' stays first, hashes next, host sources after — purely cosmetic, but stable.
const self = kept.filter((s) => s === "'self'");
const rest = kept.filter((s) => s !== "'self'");
directives[i] = ["script-src", ...self, ...hashes, ...rest].join(" ");
csp.value = directives.join("; ");

writeFileSync(VERCEL_JSON, JSON.stringify(cfg, null, 2) + "\n");
console.log(`vercel.json: script-src now carries ${hashes.length} inline-script hash(es)`);
