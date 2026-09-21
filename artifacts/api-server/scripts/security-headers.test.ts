// Phase 64 (docs/QA-VERIFICATION-PLAN.md): the page CSP in vercel.json uses
// hashes for the three inline scripts in artifacts/quote-ai/index.html
// instead of 'unsafe-inline'. Editing one of those scripts silently breaks
// it in production (the script stops running, the console fills with CSP
// violations) — so this test recomputes the hashes from the source template
// and fails when vercel.json is stale. Regenerate with:
//
//   pnpm --filter @workspace/api-server csp-hashes
//
// It also pins the rest of the header set so a future vercel.json edit
// cannot quietly drop one.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { inlineScriptHashes } from "./csp.js";

const ROOT = resolve(__dirname, "../../..");
const VERCEL_JSON = join(ROOT, "vercel.json");
const INDEX_HTML = join(ROOT, "artifacts/quote-ai/index.html");
const DIST_HTML = join(ROOT, "artifacts/quote-ai/dist/public");

type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };

function pageRule(): HeaderRule {
  const cfg = JSON.parse(readFileSync(VERCEL_JSON, "utf8")) as { headers?: HeaderRule[] };
  const rule = cfg.headers?.find((h) => h.source === "/((?!api/).*)");
  if (!rule) throw new Error("vercel.json has no header rule for the non-API pages");
  return rule;
}

function header(rule: HeaderRule, key: string): string | undefined {
  return rule.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;
}

function directive(csp: string, name: string): string[] {
  const part = csp.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name} `) || s === name);
  return part ? part.split(/\s+/).slice(1) : [];
}

function walkHtml(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

describe("security headers (vercel.json)", () => {
  const rule = pageRule();
  const csp = header(rule, "Content-Security-Policy") ?? "";

  test("the CSP script hashes match the inline scripts in index.html", () => {
    const expected = inlineScriptHashes(readFileSync(INDEX_HTML, "utf8"));
    const actual = directive(csp, "script-src").filter((s) => s.startsWith("'sha256-"));
    expect(expected.length).toBeGreaterThan(0);
    expect(actual.sort()).toEqual([...expected].sort());
  });

  test("the CSP never falls back to 'unsafe-inline' or 'unsafe-eval' for scripts", () => {
    const scriptSrc = directive(csp, "script-src");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'self'"]);
    expect(directive(csp, "frame-ancestors").length).toBeGreaterThan(0);
  });

  test("every prerendered page (if built) only carries the hashed inline scripts", () => {
    if (!existsSync(DIST_HTML)) return; // not built locally / in CI before the build step
    const allowed = new Set(inlineScriptHashes(readFileSync(INDEX_HTML, "utf8")));
    const offenders: string[] = [];
    for (const file of walkHtml(DIST_HTML)) {
      for (const h of inlineScriptHashes(readFileSync(file, "utf8"))) if (!allowed.has(h)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  test("the rest of the header set is present", () => {
    expect(header(rule, "Strict-Transport-Security")).toMatch(/max-age=\d{7,}/);
    expect(header(rule, "X-Content-Type-Options")).toBe("nosniff");
    expect(header(rule, "X-Frame-Options")).toMatch(/^(DENY|SAMEORIGIN)$/);
    expect(header(rule, "Referrer-Policy")).toBeTruthy();
    // Worker clock-in (geofence), voice notes and job photos need these on
    // our own origin — the policy must delegate to self, not disable them.
    const pp = header(rule, "Permissions-Policy") ?? "";
    for (const feature of ["geolocation", "microphone", "camera"]) expect(pp).toContain(`${feature}=(self)`);
  });
});
