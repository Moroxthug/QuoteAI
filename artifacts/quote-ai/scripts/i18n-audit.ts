// Phase 66 — i18n audit (docs/QA-VERIFICATION-PLAN.md).
//
//   pnpm --filter @workspace/quote-ai i18n-audit          # report, exit 1 on hard failures
//   pnpm --filter @workspace/quote-ai i18n-audit --json   # machine-readable
//
// Hard failures (exit 1):
//   1. a `t("…")` key used in src/ that exists in neither `en` nor `fr`
//      (the UI would show the raw key);
//   2. an `en` key with no `fr` entry (French users get English) — and the
//      reverse, which is dead weight;
//   4. (Phase 68) a key present in both translations.ts and
//      translations.dashboard.ts, or a dashboard-only key referenced from a
//      file the public entry (or a public lazy page) can reach — it would
//      render as the raw key there.
// Reported, not failing (the number is recorded in the build log):
//   3. English-looking literal text in JSX outside `t()` under the
//      dashboard / app pages (marketing pages have their own locale routes
//      and are excluded).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { translations } from "../src/i18n/translations.ts";
import { dashboardTranslations } from "../src/i18n/translations.dashboard.ts";

const ROOT = join(import.meta.dirname, "..", "src");
const json = process.argv.includes("--json");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => !/translations(.dashboard)?.ts$/.test(f));
// Phase 68: the dictionary is split (core = public entry bundle, dashboard =
// lazy chunk). Audits run over the union; §4 below checks the split itself.
const en = { ...translations.en, ...dashboardTranslations.en };
const fr = { ...translations.fr, ...dashboardTranslations.fr };

// 1. keys used in code
const used = new Map<string, string[]>(); // key → files
const keyRe = /\bt\(\s*"([^"]+)"\s*[,)]/g;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(keyRe)) {
    const list = used.get(m[1]!) ?? [];
    list.push(relative(ROOT, f));
    used.set(m[1]!, list);
  }
}
const unknownKeys = [...used.entries()].filter(([k]) => !(k in en) && !(k in fr)).map(([k, where]) => ({ key: k, files: [...new Set(where)] }));

// 2. en ↔ fr parity
const missingFr = Object.keys(en).filter((k) => !(k in fr));
const missingEn = Object.keys(fr).filter((k) => !(k in en));
// identical strings are usually untranslated copy (brand names and numbers are fine)
const sameInBoth = Object.keys(en).filter((k) => k in fr && en[k] === fr[k] && /[a-z]{4,}\s[a-z]{3,}/i.test(en[k]!) && !/^(QuoteAI|WhatsApp|Stripe|QuickBooks|Google|Gmail|Outlook|Interac|PDF|CSV)/.test(en[k]!));

// 4. the core/dashboard split (Phase 68). A dashboard key is only safe when
//    every file that references it is reachable solely from the dashboard
//    roots (dashboard pages, admin page, dashboard layout). Walk the static
//    import graph from the public entry plus the public lazy pages; anything
//    those files can reach must find its keys in translations.ts.
const rel = (f: string) => relative(ROOT, f).split(sep).join("/");
const byRel = new Map(files.map((f) => [rel(f), f]));
function resolveImport(fromRel: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? spec.slice(2) : spec.startsWith(".") ? join(fromRel, "..", spec).split(sep).join("/") : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (byRel.has(c)) return c;
  return null;
}
function reachable(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(byRel.get(f)!, "utf8");
    for (const m of src.matchAll(/\bimport(?:\s[^;]*?\sfrom)?\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const r = resolveImport(f, (m[1] ?? m[2])!);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return seen;
}
const PUBLIC_LAZY_ROOTS = [...byRel.keys()].filter((f) => /^pages\/(seo|blog|p|i|sign|t|team-invite)\//.test(f));
// main.tsx/App.tsx reach the dashboard only through dynamic import(); strip those so the entry graph stays public.
const entryGraph = (() => {
  const seen = new Set<string>();
  const stack = ["main.tsx", "App.tsx"];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(byRel.get(f)!, "utf8");
    for (const m of src.matchAll(/^\s*import(?:\s[^;]*?\sfrom)?\s+["']([^"']+)["']/gm)) {
      const r = resolveImport(f, m[1]!);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return seen;
})();
const publicFiles = new Set([...entryGraph, ...reachable(PUBLIC_LAZY_ROOTS)]);
const duplicateKeys = Object.keys(dashboardTranslations.en).filter((k) => k in translations.en);
const dashboardKeyOnPublicPage = [...used.entries()]
  .filter(([k]) => k in dashboardTranslations.en && !(k in translations.en))
  .map(([k, where]) => ({ key: k, files: [...new Set(where.map((w) => w.split(sep).join("/")))].filter((w) => publicFiles.has(w)) }))
  .filter((x) => x.files.length > 0);

// 3. hardcoded English in JSX (app surfaces only)
const APP_DIRS = ["pages/dashboard/", "pages/sign/", "pages/t/", "pages/i/", "pages/p/", "pages/team-invite/", "pages/onboarding.tsx", "pages/sign-in.tsx", "pages/sign-up.tsx", "components/jobs", "components/invoices", "components/contracts", "components/layout", "components/ui"];
const isApp = (f: string) => APP_DIRS.some((d) => relative(ROOT, f).split(sep).join("/").startsWith(d));
// text node between tags: at least two words, starts with a letter, not an expression
const textRe = />\s*([A-Za-z][A-Za-z'’,.!?&-]*(?:\s+[A-Za-z0-9'’,.!?&%$()-]+){1,})\s*</g;
const attrRe = /\b(placeholder|title|aria-label|alt)="([A-Za-z][^"{}]{3,})"/g;
const IGNORE_TEXT = /^(QuoteAI|quoteAI|Stripe|WhatsApp|Interac e-Transfer|Google|Gmail|Outlook|Meta|QuickBooks|Wave|Financeit|Flinks|CAD|HST|GST|QST|PST|N\/A|OK|—|·|Inc\.?|Ltd\.?|Sam Worker)$/;
const hardcoded: { file: string; line: number; text: string }[] = [];
for (const f of files) {
  if (!isApp(f) || !f.endsWith(".tsx")) continue;
  const src = readFileSync(f, "utf8");
  const lineOf = (idx: number) => src.slice(0, idx).split("\n").length;
  for (const m of src.matchAll(textRe)) {
    const text = m[1]!.trim();
    if (IGNORE_TEXT.test(text) || /^[\d\s$%.,:/+-]+$/.test(text)) continue;
    // skip pure code-like fragments: "=> x", template pieces, css
    if (/=>|\bconst\b|\breturn\b|className=/.test(text)) continue;
    hardcoded.push({ file: relative(ROOT, f), line: lineOf(m.index!), text });
  }
  for (const m of src.matchAll(attrRe)) {
    const text = m[2]!.trim();
    if (IGNORE_TEXT.test(text) || /^[\d\s$%.,:/+@-]+$/.test(text) || /example\.com|@/.test(text)) continue;
    hardcoded.push({ file: relative(ROOT, f), line: lineOf(m.index!), text: `${m[1]}="${text}"` });
  }
}

const report = {
  keys: { en: Object.keys(en).length, fr: Object.keys(fr).length, used: used.size },
  unknownKeys,
  missingFr,
  missingEn,
  sameInBoth: sameInBoth.length,
  sameInBothSample: sameInBoth.slice(0, 40),
  duplicateKeys,
  dashboardKeyOnPublicPage,
  hardcoded,
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`translations: en=${report.keys.en} fr=${report.keys.fr} · keys referenced in code: ${report.keys.used}`);
  console.log(`\n1. t("…") keys that exist in neither locale: ${unknownKeys.length}`);
  for (const u of unknownKeys) console.log(`   ${u.key}  ← ${u.files.join(", ")}`);
  console.log(`\n2. en keys without fr: ${missingFr.length}`);
  for (const k of missingFr) console.log(`   ${k}`);
  console.log(`   fr keys without en: ${missingEn.length}`);
  for (const k of missingEn) console.log(`   ${k}`);
  console.log(`   identical in both (probably untranslated): ${sameInBoth.length}`);
  for (const k of sameInBoth.slice(0, 40)) console.log(`   ${k} = ${JSON.stringify(en[k])}`);
  console.log(`\n4. split: keys in both dictionaries: ${duplicateKeys.length}`);
  for (const k of duplicateKeys) console.log(`   ${k}`);
  console.log(`   dashboard-only keys used from a public file: ${dashboardKeyOnPublicPage.length}`);
  for (const u of dashboardKeyOnPublicPage) console.log(`   ${u.key}  ← ${u.files.join(", ")}`);
  console.log(`\n3. English-looking literals in app JSX (outside t()): ${hardcoded.length}`);
  const byFile = new Map<string, number>();
  for (const h of hardcoded) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);
  for (const [f, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}  ${f}`);
  if (process.argv.includes("--verbose")) for (const h of hardcoded) console.log(`   ${h.file}:${h.line}  ${h.text}`);
}

const hard = unknownKeys.length + missingFr.length + missingEn.length + duplicateKeys.length + dashboardKeyOnPublicPage.length;
process.exit(hard > 0 ? 1 : 0);
