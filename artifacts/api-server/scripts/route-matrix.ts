// Phase 62 (docs/QA-VERIFICATION-PLAN.md): the backend route matrix.
//
// Statically parses every Express route registration in src/routes/** and
// src/app.ts and derives, per route, the middleware chain plus a handful of
// facts about the handler body (tenant scoping, feature gating, archived
// filtering, token comparison, webhook signature checks). No module is
// executed — this is pure TypeScript AST work, so it runs anywhere `tsc` does.
//
//   pnpm --filter @workspace/api-server route-matrix          # regenerate docs/ROUTE-MATRIX.md
//   pnpm --filter @workspace/api-server test scripts/route-matrix  # the regression guard
//
// The rules that must hold are asserted in route-matrix.test.ts; this file
// only *describes* the routes. Heuristics are deliberately conservative (a
// route is "unscoped" until proven otherwise) so the test errs on the side
// of asking a human to allowlist rather than silently passing.

import ts from "typescript";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const API_SERVER_ROOT = path.resolve(HERE, "..");
export const REPO_ROOT = path.resolve(API_SERVER_ROOT, "../..");
export const MATRIX_PATH = path.join(REPO_ROOT, "docs/ROUTE-MATRIX.md");

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "all"]);

/** Tables that carry Phase 47's soft-archive column. List endpoints must exclude archived rows. */
export const ARCHIVABLE_TABLES = ["quotesTable", "contractsTable", "projectsTable", "invoicesTable", "clientsTable"] as const;

export type AuthKind = "session" | "apiKey" | "admin" | "none";
export type TenantScope = "predicate" | "post-check" | "helper" | "n/a" | "NONE";

export interface RouteRow {
  /** Repo-relative source file. */
  file: string;
  line: number;
  method: string;
  /** Full path as served, including the /api mount. */
  path: string;
  /** Middleware expressions between the path and the handler, in order (prefix `router.use` middleware included). */
  chain: string[];
  auth: AuthKind;
  /** `area:action` from requirePermission, or the name of a custom access middleware. */
  permission: string | null;
  /** Rate limiter identifier(s) in the chain. */
  rateLimit: string | null;
  validation: "zod" | "manual" | "none";
  /** What the handler (or a same-file helper it calls) does to gate on plan/feature. */
  featureGate: string | null;
  tenantScope: TenantScope;
  /** List endpoints over an archivable table: whether archivedAt is filtered (Phase 47). */
  archived: { table: string; status: "ok" | "MISSING" | "delegated" } | null;
  /** For public token routes: how the secret is compared. */
  tokenCompare: "hash-lookup" | "db-lookup" | "timing-safe" | "PLAIN" | null;
  /** For inbound webhooks: signature verification evidence. */
  webhookVerify: string | null;
  hasParams: boolean;
  mutating: boolean;
}

// ── File discovery ───────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/** Mount prefix for a route file, mirroring routes/index.ts + app.ts. */
function mountPrefix(absFile: string): string {
  const rel = path.relative(API_SERVER_ROOT, absFile).replace(/\\/g, "/");
  if (rel === "src/app.ts") return "";
  if (rel.startsWith("src/routes/public-v1/")) return "/api/v1/public";
  if (rel.startsWith("src/routes/")) return "/api";
  throw new Error(`No mount prefix known for ${rel}`);
}

// ── AST helpers ──────────────────────────────────────────────────────────────

interface FileIndex {
  sf: ts.SourceFile;
  text: string;
  /** Top-level function declarations / const arrow functions by name. */
  fns: Map<string, ts.Node>;
  /** Names imported from relative modules (services, helpers) — not middleware/logging. */
  serviceImports: Set<string>;
  usesZod: boolean;
}

const NON_SCOPING_IMPORT_MODULES = /(middlewares\/|lib\/logger|lib\/notifications|lib\/automation|lib\/posthog|lib\/email|lib\/rateLimit|lib\/usage|lib\/audit)/;

function indexFile(absFile: string): FileIndex {
  const text = readFileSync(absFile, "utf8");
  const sf = ts.createSourceFile(absFile, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const fns = new Map<string, ts.Node>();
  const serviceImports = new Set<string>();
  let usesZod = false;
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) fns.set(stmt.name.text, stmt);
    else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) fns.set(d.name.text, d);
      }
    } else if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const mod = stmt.moduleSpecifier.text;
      if (mod === "zod") usesZod = true;
      if (mod.startsWith(".") && !NON_SCOPING_IMPORT_MODULES.test(mod) && stmt.importClause?.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
        for (const el of stmt.importClause.namedBindings.elements) serviceImports.add(el.name.text);
      }
    }
  }
  return { sf, text, fns, serviceImports, usesZod };
}

/** The handler's own source plus every same-file function it (transitively) references. */
function reachText(idx: FileIndex, root: ts.Node): string {
  const seen = new Set<ts.Node>();
  const parts: string[] = [];
  const visit = (node: ts.Node) => {
    if (seen.has(node)) return;
    seen.add(node);
    parts.push(node.getText(idx.sf));
    const walkIds = (n: ts.Node) => {
      if (ts.isIdentifier(n)) {
        const target = idx.fns.get(n.text);
        if (target && !seen.has(target)) visit(target);
      }
      ts.forEachChild(n, walkIds);
    };
    walkIds(node);
  };
  visit(root);
  return parts.join("\n");
}

function exprText(idx: FileIndex, n: ts.Node): string {
  return n.getText(idx.sf).replace(/\s+/g, " ");
}

// ── Classification ───────────────────────────────────────────────────────────

function classifyAuth(chain: string[]): AuthKind {
  if (chain.some((c) => /^requireAuth\b/.test(c))) return "session";
  if (chain.some((c) => /^requireApiKey\b/.test(c))) return "apiKey";
  if (chain.some((c) => /^requireAdmin\b/.test(c))) return "admin";
  return "none";
}

function classifyPermission(chain: string[]): string | null {
  for (const c of chain) {
    const m = c.match(/^requirePermission\(\s*"(\w+)"\s*,\s*"(\w+)"\s*\)/);
    if (m) return `${m[1]}:${m[2]}`;
  }
  const custom = chain.find((c) => /^require(?!Auth\b|ApiKey\b|Admin\b|Permission\b)\w+Access\b/.test(c));
  return custom ?? null;
}

function classifyRateLimit(chain: string[]): string | null {
  const hits = chain.filter((c) => /Limiter\b|RateLimiter\(/.test(c));
  return hits.length ? hits.join(", ") : null;
}

const FEATURE_GATE_PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/hasFeature\(\s*[\w.!?]+\s*,\s*"(\w+)"\s*\)/, (m) => `hasFeature(${m[1]})`],
  [/\brequire(\w+)Feature\(/, (m) => `require${m[1]}Feature`],
  [/\bassert(\w+)Feature\(/, (m) => `assert${m[1]}Feature`],
  [/minimumPlanFor\(\s*"(\w+)"\s*\)/, (m) => `minimumPlanFor(${m[1]})`],
  [/\bisProUser\b|PRO_REQUIRED|subscriptionPlan\s*===\s*"monthly_(pro|elite)"/, () => "plan-check"],
  [/PLAN_REQUIRED|requiredPlan/, () => "plan-check"],
  [/quotaPerMonth/, () => "quota-check"],
];

function classifyFeatureGate(reach: string, auth: AuthKind): string | null {
  for (const [re, fmt] of FEATURE_GATE_PATTERNS) {
    const m = reach.match(re);
    if (m) return fmt(m);
  }
  if (auth === "apiKey") return "requireApiKey(public_api)";
  return null;
}

const TENANT_COLS = "(userId|ownerId|actorUserId|organizationId|companyId)";
const TENANT_VARS = "(?:userId|orgId|ownerId|actorUserId|actorId|res\\.locals\\.userId|getUserId\\(res\\)|getActorUserId\\(res\\))(?!\\w)";

function classifyTenantScope(idx: FileIndex, reach: string, row: Pick<RouteRow, "auth" | "hasParams">): TenantScope {
  if (row.auth === "none" || row.auth === "admin") return "n/a";
  if (!row.hasParams) return "n/a";
  if (new RegExp(`\\beq\\(\\s*\\w+\\.${TENANT_COLS}\\s*,`).test(reach)) return "predicate";
  if (new RegExp(`(?:\\.|\\b)${TENANT_COLS}\\s*(!==|===|!=|==)\\s*${TENANT_VARS}`).test(reach)) return "post-check";
  if (new RegExp(`\\b${TENANT_VARS}\\s*(!==|===|!=|==)\\s*(?:\\w+\\.)?${TENANT_COLS}\\b`).test(reach)) return "post-check";
  // A call to an imported service/helper that receives the tenant id — e.g. `invoicesForProject(userId, id)`.
  for (const name of idx.serviceImports) {
    const re = new RegExp(`\\b${name}\\((?:[^()]|\\([^()]*\\))*\\b${TENANT_VARS}`);
    if (re.test(reach)) return "helper";
  }
  return "NONE";
}

/** Last path segment of a list endpoint → the archivable table it lists. */
const LIST_SEGMENT_TABLE: Record<string, (typeof ARCHIVABLE_TABLES)[number]> = {
  quotes: "quotesTable",
  contracts: "contractsTable",
  jobs: "projectsTable",
  invoices: "invoicesTable",
  clients: "clientsTable",
};

/**
 * Phase 47 rule: a *list* endpoint (GET, no params) over an archivable table
 * must exclude archived rows. `delegated` = the handler never touches the
 * table itself (a service does the query — checked by hand once, see the
 * test's allowlist), `ok` = `archivedAt` appears in the handler's reach.
 */
function classifyArchived(reach: string, method: string, routePath: string, hasParams: boolean): RouteRow["archived"] {
  if (method !== "get" || hasParams) return null;
  const seg = routePath.split("/").pop() ?? "";
  const table = LIST_SEGMENT_TABLE[seg];
  if (!table) return null;
  if (!new RegExp(`\\.from\\(\\s*${table}\\s*\\)`).test(reach)) return { table, status: "delegated" };
  const filtered = new RegExp(`${table}\\.archivedAt`).test(reach);
  return { table, status: filtered ? "ok" : "MISSING" };
}

const PUBLIC_TOKEN_PATH = /\/(p|i|sign|t)\/:|:token\b|\/public[-/]|\/unsubscribe/;

function classifyTokenCompare(reach: string, routePath: string): RouteRow["tokenCompare"] {
  if (!PUBLIC_TOKEN_PATH.test(routePath)) return null;
  // A JS-side `===` against anything named *hash/*token/*code/*otp leaks timing.
  if (/(===|!==)\s*[\w.]*(Hash|hash|Token|token|Otp|otp|Code|code)\b|\b[\w.]*(Hash|hash|Token|token|Otp|otp)\s*(===|!==)/.test(reach)) return "PLAIN";
  if (/timingSafeEqual/.test(reach)) return "timing-safe";
  if (/hashToken\(|createHash\(/.test(reach)) return "hash-lookup";
  if (/\beq\(\s*\w+\.\w*[Tt]oken\w*\s*,/.test(reach)) return "db-lookup";
  if (/\beq\(\s*\w+\.id\s*,/.test(reach)) return "db-lookup";
  return null;
}

/** Inbound provider webhooks only — `/developer/webhooks` is our *outbound* webhook management API. */
const INBOUND_WEBHOOK_PATH = /webhook$|\/webhooks\/\w+$/;

function classifyWebhook(reach: string, method: string, routePath: string): string | null {
  if (method !== "post" || !INBOUND_WEBHOOK_PATH.test(routePath)) return null;
  const hits = ["constructEvent", "timingSafeEqual", "createHmac", "x-hub-signature", "verifySignature", "svix", "hub.verify_token"].filter((k) => reach.includes(k));
  return hits.length ? hits.join(", ") : "NONE";
}

function classifyValidation(idx: FileIndex, reach: string): RouteRow["validation"] {
  if (idx.usesZod && /\.(safeParse|parse)\(/.test(reach)) return "zod";
  if (/insert\w+Schema|\w+Schema\.(safeParse|parse)/.test(reach)) return "zod";
  if (/req\.body/.test(reach)) return "manual";
  return "none";
}

// ── Extraction ───────────────────────────────────────────────────────────────

function extractRoutes(absFile: string): RouteRow[] {
  const idx = indexFile(absFile);
  const rel = path.relative(REPO_ROOT, absFile).replace(/\\/g, "/");
  const prefix = mountPrefix(absFile);
  const rows: RouteRow[] = [];
  /** `router.use("/prefix", mw)` registrations, applied to later routes under that prefix. */
  const prefixMiddleware: { prefix: string; mw: string[] }[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression.getText(idx.sf);
      const method = node.expression.name.text;
      const [first, ...rest] = node.arguments;
      if ((receiver === "router" || receiver === "app") && first && ts.isStringLiteral(first)) {
        if (method === "use") {
          prefixMiddleware.push({ prefix: first.text, mw: rest.map((a) => exprText(idx, a)) });
        } else if (HTTP_METHODS.has(method) && rest.length) {
          const handler = rest[rest.length - 1];
          const chain = [
            ...prefixMiddleware.filter((p) => first.text === p.prefix || first.text.startsWith(p.prefix + "/")).flatMap((p) => p.mw),
            ...rest.slice(0, -1).map((a) => exprText(idx, a)),
          ];
          // A named-function handler contributes to the chain too when it's a known middleware name.
          const reach = reachText(idx, handler);
          const routePath = prefix + first.text;
          const auth = classifyAuth(chain);
          const hasParams = /:\w+|\*/.test(first.text);
          const line = idx.sf.getLineAndCharacterOfPosition(node.getStart(idx.sf)).line + 1;
          rows.push({
            file: rel,
            line,
            method: method.toUpperCase(),
            path: routePath,
            chain,
            auth,
            permission: classifyPermission(chain),
            rateLimit: classifyRateLimit(chain),
            validation: classifyValidation(idx, reach),
            featureGate: classifyFeatureGate(reach, auth),
            tenantScope: classifyTenantScope(idx, reach, { auth, hasParams }),
            archived: classifyArchived(reach, method, routePath, hasParams),
            tokenCompare: classifyTokenCompare(reach, routePath),
            webhookVerify: classifyWebhook(reach, method, routePath),
            hasParams,
            mutating: method !== "get",
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(idx.sf);
  return rows;
}

export function buildRouteMatrix(): RouteRow[] {
  const files = [path.join(API_SERVER_ROOT, "src/app.ts"), ...walk(path.join(API_SERVER_ROOT, "src/routes")).filter((f) => !/routes[\\/](index|public-v1[\\/]index)\.ts$/.test(f))];
  const rows = files.flatMap(extractRoutes);
  rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return rows;
}

// ── Markdown ─────────────────────────────────────────────────────────────────

function cell(v: string | null | undefined): string {
  return (v ?? "—").replace(/\|/g, "\\|");
}

export function renderMarkdown(rows: RouteRow[]): string {
  const byFile = new Map<string, RouteRow[]>();
  for (const r of rows) byFile.set(r.file, [...(byFile.get(r.file) ?? []), r]);
  const lines: string[] = [
    "# API route matrix",
    "",
    "Generated by `artifacts/api-server/scripts/route-matrix.ts` — **do not edit by hand**; run `pnpm --filter @workspace/api-server route-matrix`.",
    "`scripts/route-matrix.test.ts` asserts the Phase 62 rules against this data and fails CI when a new route breaks one or when this file is stale.",
    "",
    `${rows.length} routes across ${byFile.size} files.`,
    "",
    "Columns — **Auth**: session (`requireAuth`), apiKey (`requireApiKey`), admin (`requireAdmin`), none. **Perm**: `requirePermission(area, action)`. **RL**: rate limiter in the chain.",
    "**Val**: zod / manual `req.body` handling / none. **Gate**: plan or feature check found in the handler (or a same-file helper it calls). **Scope**: how a `:param` handler ties the row to the acting org —",
    "`predicate` (`eq(t.userId, userId)` in the query), `post-check` (`row.userId !== userId` after fetch), `helper` (an imported service receives `userId`), `n/a` (no params / public / admin), **NONE** (nothing found — must be allowlisted with a reason in the test).",
    "**Archived**: archivable tables the handler reads and whether `archivedAt` is filtered. **Token**: how a public-token route compares its secret. **Webhook**: signature-verification evidence.",
    "",
  ];
  for (const [file, group] of byFile) {
    lines.push(`## ${file}`, "", "| Line | Method | Path | Auth | Perm | RL | Val | Gate | Scope | Archived | Token | Webhook |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const r of group) {
      const archived = r.archived ? `${r.archived.table.replace(/Table$/, "")}:${r.archived.status}` : "—";
      lines.push(`| ${r.line} | ${r.method} | \`${r.path}\` | ${r.auth} | ${cell(r.permission)} | ${cell(r.rateLimit)} | ${r.validation} | ${cell(r.featureGate)} | ${r.tenantScope} | ${archived} | ${cell(r.tokenCompare)} | ${cell(r.webhookVerify)} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const rows = buildRouteMatrix();
  const md = renderMarkdown(rows);
  if (process.argv.includes("--write")) {
    writeFileSync(MATRIX_PATH, md);
    console.log(`Wrote ${rows.length} routes to ${path.relative(process.cwd(), MATRIX_PATH)}`);
  } else {
    process.stdout.write(md);
  }
}
