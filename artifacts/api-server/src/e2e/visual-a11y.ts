// Phase 67 — visual + accessibility sweep of every route.
//
// Boots the real API (harness, ephemeral port, .env.staging), spawns the
// quote-ai Vite dev server proxied at it, seeds a showcase account
// (fixtures.ts) and drives the installed Chrome through playwright-core.
// For every route × language × viewport width it records:
//   • a full-page screenshot        → .qa/visual/<lang>/<width>/<route>.png
//   • horizontal overflow           (scrollWidth > clientWidth, with the widest offenders)
//   • axe-core violations           (serious/critical are the exit criterion; moderate listed)
//   • console errors + failed /api requests + React error-boundary text
// and writes .qa/visual/report.{json,md}. Since Phase 113 it is a gate: it
// exits 1 on any overflow, gutter, serious/critical axe node, blocking
// screen-reader finding, raw key, error page or phone rule (height budgets
// included) — `--gate=false` reports without failing. Nothing leaves the machine: email
// is captured at the fetch boundary, other vendors are stubbed, AI falls back.
//
//   pnpm --filter @workspace/api-server qa:visual                  # EN at 5 widths, FR at 1280/375
//   pnpm --filter @workspace/api-server qa:visual -- --lang=fr --widths=375 --routes=quotes,jobs
//   pnpm --filter @workspace/api-server qa:visual -- --keep        # leave the account + servers up and print the token
//   pnpm --filter @workspace/api-server qa:visual -- --screenshots=false --widths=1280,375   # axe-only pass
//   E2E_NO_PURGE=1 pnpm … qa:visual -- --port=5198 --out=visual-quick --routes=…            # alongside a running sweep
//   pnpm … qa:visual -- --lang=fr --widths=375 --text --out=visual-text                      # Phase 120: labels at the phone's largest text size
//
// Requires Google Chrome (playwright-core `channel: "chrome"`; set
// QA_CHROME_PATH to point at another Chromium build).

import { bootstrapQaEnv, captureResend } from "./qaEnv.js";

process.env.LOG_LEVEL ??= "warn";
bootstrapQaEnv("qa-visual");
process.env.NODE_ENV = "development";

import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { screenReaderAudit, modalAudit, SR_BLOCKING, type SrFinding } from "./screen-reader.js";
import { startVite, stopVite } from "./viteServer.js";

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core/axe.min.js");
const ROOT = resolve(import.meta.dirname, "../../../..");

// Phase 68: the translation dictionary is split (core vs lazy dashboard chunk).
// A key that ends up in the wrong half renders as its raw id ("jobs.tab.costs"),
// so every page's text is scanned for known key ids.
const TRANSLATION_KEYS: Set<string> = new Set(
  ["translations.ts", "translations.dashboard.ts"].flatMap((name) =>
    [...readFileSync(resolve(ROOT, "artifacts/quote-ai/src/i18n", name), "utf8").matchAll(/^\s*"([a-zA-Z0-9_.-]+)":/gm)].map((m) => m[1]!),
  ),
);

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1]!, m[2] ?? "true");
}
const LANGS = (args.get("lang") ?? "en,fr").split(",").filter(Boolean) as Array<"en" | "fr">;
const WIDTHS_EN = (args.get("widths") ?? "1280,980,768,640,375").split(",").map(Number);
const WIDTHS_FR = args.has("widths") ? WIDTHS_EN : [1280, 375];
const ROUTE_FILTER = (args.get("routes") ?? "").split(",").filter(Boolean);
const RUN_AXE = args.get("axe") !== "false";
// Phase 83: the behavioural half (tab order, focus rings, "you are here",
// off-canvas drawers, the modal trap). Static per page, so it runs once per
// route × language at each width that changes the layout answer — the drawer
// checks only exist below the mobile breakpoint.
const RUN_SR = args.get("sr") !== "false";
const SCREENSHOTS = args.get("screenshots") !== "false";
const KEEP = args.has("keep");
// Phase 113: findings fail the run (exit 1); --gate=false only reports them (a baseline before a phase).
const GATE = args.get("gate") !== "false";
// Phase 120: "text that fits" — every font size on the page scaled as the phone's
// largest standard text setting does (Android 130 %, iOS xxxLarge ~135 %;
// `--text=2` for the accessibility sizes, Phase 122), then every label
// (button, chip, pill, tab, field label, tab bar) checked for being cut off.
const TEXT_SCALE = args.has("text") ? Number(args.get("text")) || 1.35 : 1;
const PROVINCE = (args.get("province") ?? "ON") as "ON" | "QC";
const VITE_PORT = Number(args.get("port") ?? 5197);
// A second run alongside a full sweep needs its own port AND its own output dir (the run starts by wiping it).
const OUT = resolve(import.meta.dirname, "../../.qa", args.get("out") ?? "visual");

// ── Routes ───────────────────────────────────────────────────────────────────
/**
 * `session`: who is signed in — nobody, the owner, (Phase 86b) a foreman member of the same company, or
 * (Phase 93) a newcomer: freshly signed up, no company yet, the person onboarding is for — and an invitee
 * who signed up without their link.
 */
type Session = "public" | "owner" | "foreman" | "newcomer" | "invitee" | "pro";
/** `drive`: clicks from the loaded page to the state being checked (onboarding's steps have no URL of their own). */
type RouteSpec = { path: string; session: Session; name?: string; drive?: (page: Page) => Promise<void> };

// Phase 93: onboarding's steps 2-4 are only reachable by filling the steps before them, as a customer does.
async function onboardTo(page: Page, step: 2 | 3 | 4) {
  await page.fill("#companyName", "Sweep Renovations Ltd.");
  await page.click(".card-foot .btn-navy");
  await page.waitForSelector('[data-step="2"]');
  if (step === 2) return;
  await page.locator("fieldset").first().locator(".pill").first().click();
  await page.fill("#setup-seats", "4");
  await page.locator("fieldset").nth(1).locator(".pill").first().click();
  await page.click(".card-foot .btn-navy");
  await page.waitForSelector('[data-step="3"]');
  if (step === 3) return;
  await page.selectOption("#province", "ON");
  await page.click(".card-foot .btn-navy");
  await page.waitForSelector('[data-step="4"]', { timeout: 15_000 });
}
// Phase 101: opens a phone sheet when its trigger is on screen (the tab bar exists at 980 px and below).
async function openPhoneSheet(page: Page, trigger: string, sheet: string) {
  const b = page.locator(trigger).first();
  if (!(await b.isVisible().catch(() => false))) return;
  await b.click();
  await page.waitForSelector(sheet);
}
/** Phase 109: on the phone agenda, pick tomorrow in the week strip (the next week's Monday on a Sunday). False wider, where there is no strip. */
async function scheduleTomorrow(page: Page): Promise<boolean> {
  const days = page.locator(".ag-strip .ag-d");
  if (!(await days.first().isVisible().catch(() => false))) return false;
  const all = await days.evaluateAll((els) => els.map((e) => e.classList.contains("today")));
  const i = all.indexOf(true);
  if (i === 6) {
    await page.locator(".ag-nav .ic-btn").last().click();
    await page.waitForFunction(() => !document.querySelector(".ag-strip .ag-d.today"));
    await days.first().click();
  } else {
    await days.nth(i + 1).click();
  }
  await page.waitForSelector(".ag-group, .ag-empty");
  return true;
}
// Phase 102: every section of pages/dashboard/settings (the owner sees them all).
const SETTINGS_SECTIONS = ["profile", "security", "company", "taxes", "invoicing", "followups", "widget", "email", "sms", "whatsapp", "apps", "plan"];
// Phase 103: every app in the directory that opens a panel (the other three open their settings section, swept above).
const APP_PANELS = ["quickbooks", "wave", "google_calendar", "outlook_calendar", "ics", "gmail", "stripe", "financeit", "flinks", "meta_leads", "google_lsa", "api"];
// Phase 95: set once the foreman has joined, so the teammate page can be swept.
let sweepForemanId: string | null = null;
// Phase 111: the showcase client's portal link and a session from its emailed code (set once seeded).
let sweepPortal: { token: string; session: string } | null = null;
/**
 * Phase 111: the pending contract's customer back to "not verified" (or straight to verified, for the
 * signature sheet — the code request is rate-limited per IP, so only the code step asks for one), then the
 * page again, then the docked primary: every /sign route starts from the same place.
 */
async function signFrom(page: Page, contractId: string, step: "review" | "code" | "signature") {
  const { db, contractSignersTable } = await import("@workspace/db");
  const { and, eq } = await import("drizzle-orm");
  const verified = step === "signature";
  await db.update(contractSignersTable)
    .set({ otpVerifiedAt: verified ? new Date() : null, otpHash: null, otpAttempts: 0, status: verified ? "verified" : "viewed" })
    .where(and(eq(contractSignersTable.contractId, contractId), eq(contractSignersTable.role, "customer")));
  await page.reload();
  await page.waitForSelector(".doc-head");
  if (step === "review") return;
  const primary = page.locator("[data-primary-action]").first();
  if (!(await primary.isVisible().catch(() => false))) return;
  await primary.click();
  await page.waitForSelector(verified ? "[role=dialog] #sign-full-name" : '[role=dialog] input[autocomplete="one-time-code"]');
}
/** Phase 111: the portal signed out (the gate) or signed in on one section (by tab position: home, quotes, contracts, invoices, photos, messages). */
async function portalAt(page: Page, p: { token: string; session: string }, section: number | null) {
  const key = `qai_portal_session:${p.token.slice(0, 16)}`;
  await page.evaluate(([k, v]) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch {} }, [key, section === null ? "" : p.session] as const);
  await page.reload();
  if (section === null) { await page.waitForSelector("main .card"); return; }
  const tabs = page.locator("[data-portal-tabs] button, .pills.scroll button");
  await tabs.first().waitFor();
  if (section > 0) await tabs.nth(section).click();
  await page.waitForTimeout(150);
}
function routes(s: import("./fixtures.js").Showcase): RouteSpec[] {
  const pub = (path: string): RouteSpec => ({ path, session: "public" });
  const dash = (path: string): RouteSpec => ({ path, session: "owner" });
  // Phase 86b: a foreman lands on a different /dashboard (the crew's day) and
  // sees the job and team pages with the owner-only parts gone — layouts no
  // owner sweep ever rendered.
  const foreman = (path: string): RouteSpec => ({ path, session: "foreman", name: `${path} (foreman)` });
  const list: RouteSpec[] = [
    pub("/"), pub("/fr"), pub("/whatsapp"), pub("/blog"), pub("/blog/categoria/advice"),
    pub("/blog/how-much-does-it-cost-to-paint-an-apartment-in-canada-2026"),
    pub("/quotes/painter"), pub("/quotes/painter/toronto"), pub("/fr/soumissions/peintre"), pub("/fr/soumissions/peintre/montreal"),
    pub("/chi-siamo"), pub("/contatti"), pub("/privacy-policy"), pub("/terms"), pub("/mappa-sito"),
    // Phase 95: the legal pages in French.
    pub("/fr/confidentialite"), pub("/fr/conditions"),
    // Phase 82: the pages Phases 70/81 added were never in this sweep.
    pub("/pricing"), pub("/fr/tarifs"), pub("/pilot"), pub("/fr/pilote"),
    pub("/provinces/british-columbia"), pub("/provinces/quebec"), pub("/fr/provinces/quebec"),
    pub("/help"), pub("/help/getting-started"),
    pub("/sign-in"), pub("/sign-up"), pub("/this-route-does-not-exist"),
    pub(`/p/${s.longQuoteId}`), pub(`/i/${s.invoiceToken}`),
    // Phase 111: the client's side on a phone — the accept sheet, a quote with tiers, the signing steps, the portal.
    { path: `/p/${s.longQuoteId}`, session: "public", name: "/p accept sheet", drive: (p) => openPhoneSheet(p, ".action-bar [data-primary-action]", "[role=dialog] #nomeConferma") },
    pub(`/p/${s.tieredQuoteId}`),
    ...(s.signToken
      ? [
          { path: `/sign/${s.signToken}`, session: "public" as const, drive: (p: Page) => signFrom(p, s.pendingContractId, "review") },
          { path: `/sign/${s.signToken}`, session: "public" as const, name: "/sign code sheet", drive: (p: Page) => signFrom(p, s.pendingContractId, "code") },
          { path: `/sign/${s.signToken}`, session: "public" as const, name: "/sign signature sheet", drive: (p: Page) => signFrom(p, s.pendingContractId, "signature") },
        ]
      : []),
    ...(sweepPortal
      ? ((pt) => [
          { path: `/portal/${pt.token}`, session: "public" as const, name: "/portal gate", drive: (p: Page) => portalAt(p, pt, null) },
          { path: `/portal/${pt.token}`, session: "public" as const, name: "/portal home", drive: (p: Page) => portalAt(p, pt, 0) },
          { path: `/portal/${pt.token}`, session: "public" as const, name: "/portal quotes", drive: (p: Page) => portalAt(p, pt, 1) },
          { path: `/portal/${pt.token}`, session: "public" as const, name: "/portal contracts", drive: (p: Page) => portalAt(p, pt, 2) },
          { path: `/portal/${pt.token}`, session: "public" as const, name: "/portal invoices", drive: (p: Page) => portalAt(p, pt, 3) },
          { path: `/portal/${pt.token}`, session: "public" as const, name: "/portal messages", drive: (p: Page) => portalAt(p, pt, 5) },
        ])(sweepPortal)
      : []),
    ...(s.workerToken ? [pub(`/t/${s.workerToken}`)] : []),
    // Phase 108: the crew app's sheets — Report (the docked primary), the changes chip, ⋯ (then hours by hand), the company switch.
    ...(s.workerToken
      ? [
          { path: `/t/${s.workerToken}`, session: "public" as const, name: "/t report sheet", drive: (p: Page) => openPhoneSheet(p, ".action-bar [data-primary-action]", "[role=dialog] #report-body") },
          { path: `/t/${s.workerToken}`, session: "public" as const, name: "/t changes sheet", drive: (p: Page) => openPhoneSheet(p, ".w-chip", "[role=dialog] ul") },
          { path: `/t/${s.workerToken}`, session: "public" as const, name: "/t hours sheet", drive: async (p: Page) => {
            await p.locator(".action-bar .more-btn").first().click();
            await p.waitForSelector("[role=dialog] .asheet-list, [role=menu]");
            await p.getByText(/Log hours by hand|Saisir des heures/).first().click();
            await p.waitForSelector("[role=dialog] #worker-hours");
          } },
          { path: `/t/${s.workerToken}`, session: "public" as const, name: "/t company switch", drive: (p: Page) => openPhoneSheet(p, ".w-company", "[role=dialog] .asheet-list, [role=menu]") },
        ]
      : []),
    ...(s.teamInviteToken ? [pub(`/team-invite/${s.teamInviteToken}`)] : []),
    // Phase 91: the access-code page, empty and with a code filled in.
    pub("/join"), ...(s.joinCode ? [pub(`/join?code=${s.joinCode}`)] : []),
    // Phase 92: the widget on its sample contractor page (the form lives in a shadow root; axe walks into it).
    ...(s.widgetKey ? [{ path: `/widget-test.html?key=${s.widgetKey}`, session: "public" as const, name: "/widget-test.html" }] : []),
    dash("/onboarding"),
    // Phase 93: every onboarding step, as the person it is for sees it.
    { path: "/onboarding", session: "newcomer", name: "/onboarding step 1 (newcomer)" },
    { path: "/onboarding", session: "newcomer", name: "/onboarding step 2 (newcomer)", drive: (p) => onboardTo(p, 2) },
    { path: "/onboarding", session: "newcomer", name: "/onboarding step 3 (newcomer)", drive: (p) => onboardTo(p, 3) },
    { path: "/onboarding", session: "newcomer", name: "/onboarding step 4 (newcomer)", drive: (p) => onboardTo(p, 4) },
    { path: "/onboarding?plan=monthly_pro", session: "newcomer", name: "/onboarding step 4 plan (newcomer)", drive: (p) => onboardTo(p, 4) },
    { path: "/onboarding", session: "invitee", name: "/onboarding invitation (invitee)" },
    dash("/dashboard"), dash("/dashboard/new"), dash("/dashboard/quotes"), dash(`/dashboard/quotes/${s.longQuoteId}`), dash(`/dashboard/quotes/${s.quoteId}`),
    dash("/dashboard/analytics"), dash("/dashboard/billing"),
    // Phase 102: Settings is one page per section. /dashboard/settings is the
    // section list on a phone (a wide screen opens the first section); the
    // apps section holds the calendar connections, .ics subscriptions and feed.
    dash("/dashboard/settings"),
    ...SETTINGS_SECTIONS.map((id) => dash(`/dashboard/settings/${id}`)),
    foreman("/dashboard/settings"), foreman("/dashboard/settings/plan"),
    // The save bar (a field edited), then the "leave without saving?" prompt (a link followed with the edit pending).
    { path: "/dashboard/settings/company", session: "owner", name: "/dashboard/settings/company unsaved", drive: async (p) => {
      await p.locator("#s-company-phone").fill("604 555 0199");
      await p.waitForSelector(".savebar");
    } },
    { path: "/dashboard/settings/company", session: "owner", name: "/dashboard/settings/company leave prompt", drive: async (p) => {
      await p.locator("#s-company-phone").fill("604 555 0199");
      await p.waitForSelector(".savebar");
      await p.locator('.snav-item[href$="/taxes"]:visible, .tb-back:visible, .settings-back:visible').first().click();
      await p.waitForSelector('[role="alertdialog"]');
    } },
    // Phase 103: each app's detail (a side panel wide, a page on a phone); a Pro owner sees Elite/Business apps locked.
    ...APP_PANELS.map((id) => dash(`/dashboard/settings/apps?app=${id}`)),
    { path: "/dashboard/settings/apps", session: "pro", name: "/dashboard/settings/apps (pro)" },
    { path: "/dashboard/settings/apps?app=quickbooks", session: "pro", name: "/dashboard/settings/apps?app=quickbooks (pro)" },
    // Phase 96: the calendar picker open on the connected Google calendar (the list is stubbed in fixtures.ts).
    { path: "/dashboard/settings/apps?app=google_calendar", session: "owner", name: "/dashboard/settings/apps?app=google_calendar calendar picker", drive: async (p) => {
      await p.locator('[data-testid="calendar-target-google"] button', { hasText: /Change|Changer/ }).click();
      await p.waitForSelector("#calendar-target-google");
    } },
    dash("/dashboard/catalog"), dash("/dashboard/clients"), ...(s.clientId ? [dash(`/dashboard/clients/${s.clientId}`)] : []),
    dash("/dashboard/leads"), dash("/dashboard/imports"),
    dash("/dashboard/contracts"), dash(`/dashboard/contracts/${s.contractId}`), dash(`/dashboard/contracts/${s.pendingContractId}`),
    dash("/dashboard/invoices"), dash(`/dashboard/invoices/${s.invoiceId}`),
    // Phase 107: the money-and-people phone states — list filters, the invoice's and the contract's menu,
    // the agreement unfolded, a new invoice's line in a sheet, a client's tabs, a lead's Move menu, one chart at a time.
    { path: "/dashboard/invoices", session: "owner", name: "/dashboard/invoices filter", drive: (p) => openPhoneSheet(p, ".qlist-bar .more-btn", "[role=dialog] .asheet-list") },
    { path: `/dashboard/invoices/${s.invoiceId}`, session: "owner", name: `/dashboard/invoices/${s.invoiceId} more`, drive: async (p) => {
      await p.locator(".i-hero .more-btn").first().click();
      await p.waitForSelector("[role=dialog] .asheet-list, [role=menu]");
    } },
    { path: "/dashboard/invoices?new=1", session: "owner", name: "/dashboard/invoices new invoice line", drive: async (p) => {
      await p.waitForSelector("[role=dialog] .li-body");
      await openPhoneSheet(p, "[role=dialog] .li-phone .qline.add", "[role=dialog] .line-sheet");
    } },
    { path: "/dashboard/contracts", session: "owner", name: "/dashboard/contracts filter", drive: (p) => openPhoneSheet(p, ".qlist-bar .more-btn", "[role=dialog] .asheet-list") },
    { path: `/dashboard/contracts/${s.pendingContractId}`, session: "owner", name: `/dashboard/contracts/${s.pendingContractId} more`, drive: async (p) => {
      await p.locator(".k-hero .more-btn").first().click();
      await p.waitForSelector("[role=dialog] .asheet-list, [role=menu]");
    } },
    { path: `/dashboard/contracts/${s.contractId}`, session: "owner", name: `/dashboard/contracts/${s.contractId} agreement`, drive: async (p) => {
      const b = p.locator(".k-doc-toggle").first();
      if (await b.isVisible().catch(() => false)) { await b.click(); await p.waitForSelector(".doc-view"); }
    } },
    ...(s.clientId ? ["jobs", "invoices", "messages"].map((tab) => dash(`/dashboard/clients/${s.clientId}?tab=${tab}`)) : []),
    { path: "/dashboard/leads", session: "owner", name: "/dashboard/leads move", drive: async (p) => {
      await p.locator(".kan-move").first().click();
      await p.waitForSelector("[role=dialog] .asheet-list, [role=menu]");
    } },
    ...["aging", "margins"].map((chart, i): RouteSpec => ({ path: "/dashboard/analytics", session: "owner", name: `/dashboard/analytics ${chart}`, drive: async (p) => {
      const pill = p.locator(".a-charts .pill").nth(i === 0 ? 1 : 4);
      if (await pill.isVisible().catch(() => false)) await pill.click();
    } })),
    // Phase 94: the quote form's client fields (a new client with a bad email; a picked client's contact details) and the completion dialog.
    { path: "/dashboard/new", session: "owner", name: "/dashboard/new new client (bad email)", drive: async (p) => {
      await p.locator(".pick-row .pill.dashed, .add-dashed").first().click();
      await p.locator('input[type="email"]').fill("dana@");
      await p.waitForSelector(".field-err");
    } },
    { path: "/dashboard/new", session: "owner", name: "/dashboard/new picked client", drive: async (p) => {
      await p.locator(".pick-row .pill:not(.dashed)").first().click();
      await p.waitForSelector('.form-grid input[type="email"]');
    } },
    // Phase 105: the quote screens' sheets — the new quote's Options, the manual
    // tab and one of its lines, the list's filter, a quote's ⋯, its edit mode and
    // one line of it (the line sheets exist on a phone only; wider, the drive stops
    // at the editor), a locked quote, and the foreman's read-only quote.
    { path: "/dashboard/new", session: "owner", name: "/dashboard/new options", drive: async (p) => {
      await p.locator(".qopts").first().click();
      await p.waitForSelector("[role=dialog] .qopts-set");
    } },
    { path: "/dashboard/new", session: "owner", name: "/dashboard/new manual", drive: async (p) => {
      await p.locator(".stabs .pill").nth(1).click();
      await p.waitForSelector(".li-body");
    } },
    { path: "/dashboard/new", session: "owner", name: "/dashboard/new manual line", drive: async (p) => {
      await p.locator(".stabs .pill").nth(1).click();
      await p.waitForSelector(".li-body");
      await openPhoneSheet(p, ".li-body .qline", "[role=dialog] .line-sheet");
    } },
    { path: "/dashboard/quotes", session: "owner", name: "/dashboard/quotes filter", drive: (p) => openPhoneSheet(p, ".qlist-bar .more-btn", "[role=dialog] .asheet-list") },
    { path: `/dashboard/quotes/${s.longQuoteId}`, session: "owner", name: `/dashboard/quotes/${s.longQuoteId} more`, drive: async (p) => {
      await p.locator(".q-hero .more-btn").first().click();
      await p.waitForSelector("[role=dialog] .asheet-list, [role=menu]");
    } },
    { path: `/dashboard/quotes/${s.longQuoteId}`, session: "owner", name: `/dashboard/quotes/${s.longQuoteId} edit`, drive: async (p) => {
      await p.locator(".q-hero .more-btn").first().click();
      await p.locator("[role=dialog] .asheet-item, [role=menuitem]").first().click();
      await p.waitForSelector(".edit-bar");
    } },
    { path: `/dashboard/quotes/${s.longQuoteId}`, session: "owner", name: `/dashboard/quotes/${s.longQuoteId} edit line`, drive: async (p) => {
      await p.locator(".q-hero .more-btn").first().click();
      await p.locator("[role=dialog] .asheet-item, [role=menuitem]").first().click();
      await p.waitForSelector(".edit-bar");
      await openPhoneSheet(p, ".chap-block .qline", "[role=dialog] .line-sheet");
    } },
    dash(`/dashboard/quotes/${s.pendingQuoteId}`), foreman(`/dashboard/quotes/${s.quoteId}`),
    // Phase 106: Mark complete lives in the job's ⋯ (a sheet on a phone, a menu wider).
    { path: `/dashboard/jobs/${s.jobId}`, session: "owner", name: `/dashboard/jobs/${s.jobId} complete dialog`, drive: async (p) => {
      await p.locator(".j-hero .more-btn").first().click();
      await p.locator("[role=dialog] .asheet-item, [role=menuitem]", { hasText: /Mark complete|Marquer terminé/ }).click();
      await p.waitForSelector('[role="alertdialog"]');
    } },
    { path: `/dashboard/jobs/${s.jobId}`, session: "owner", name: `/dashboard/jobs/${s.jobId} more`, drive: async (p) => {
      await p.locator(".j-hero .more-btn").first().click();
      await p.waitForSelector("[role=dialog] .asheet-list, [role=menu]");
    } },
    dash("/dashboard/jobs"), dash(`/dashboard/jobs/${s.jobId}`), dash(`/dashboard/jobs/${s.jobId}/setup`),
    { path: "/dashboard/jobs", session: "owner", name: "/dashboard/jobs receipts", drive: (p) => openPhoneSheet(p, ".rq-phone .lrow", "[role=dialog] .lrows") },
    // Phase 106: every tab of the job page is its own page state.
    ...["schedule", "changes", "costs", "invoices", "team", "photos", "messages", "documents"].map((tab) => dash(`/dashboard/jobs/${s.jobId}?tab=${tab}`)),
    // Phase 109: the schedule's Add block sheet (docked on a phone, the header button wider), and on a
    // phone tomorrow's agenda (the showcase's double-booking) by person, by job, and its clashing block opened.
    { path: "/dashboard/schedule", session: "owner", name: "/dashboard/schedule add block", drive: (p) => openPhoneSheet(p, ".action-bar [data-primary-action], .head-actions .btn-navy", "[role=dialog] #blk-worker") },
    { path: "/dashboard/schedule", session: "owner", name: "/dashboard/schedule tomorrow", drive: async (p) => { await scheduleTomorrow(p); } },
    { path: "/dashboard/schedule", session: "owner", name: "/dashboard/schedule tomorrow by job", drive: async (p) => {
      if (!(await scheduleTomorrow(p))) return;
      await p.locator(".ag-day-head [role=tab]").nth(1).click();
      await p.waitForSelector(".ag-day-head [role=tab][aria-selected=true]:nth-of-type(2)");
    } },
    { path: "/dashboard/schedule", session: "owner", name: "/dashboard/schedule tomorrow clash", drive: async (p) => {
      if (!(await scheduleTomorrow(p))) return;
      await p.locator(".ag-row.clash").first().click();
      await p.waitForSelector("[role=dialog] #blk-worker");
    } },
    // Phase 101: the phone navigation's sheets (no-ops above 980 px, where the sidebar is the navigation).
    { path: "/dashboard", session: "owner", name: "/dashboard More sheet", drive: (p) => openPhoneSheet(p, ".tabbar button.tabbar-link", ".more-sheet") },
    { path: "/dashboard", session: "owner", name: "/dashboard New sheet", drive: (p) => openPhoneSheet(p, ".tb-new", "[role=dialog] .asheet-list") },
    { path: "/dashboard", session: "foreman", name: "/dashboard More sheet (foreman)", drive: (p) => openPhoneSheet(p, ".tabbar button.tabbar-link", ".more-sheet") },
    // Phase 104: Today's period switch (a sheet on a phone, a menu wider), and the home a Pro owner sees (no crew tier: no blockers or hours).
    { path: "/dashboard", session: "owner", name: "/dashboard period switch", drive: async (p) => {
      await p.locator(".today-stats .more-btn").first().click();
      await p.waitForSelector("[role=dialog] .asheet-list, [role=menu]");
    } },
    { path: "/dashboard", session: "pro", name: "/dashboard (pro)" },
    // Phase 100: the calm-mobile primitives on fake data (dev-server route).
    dash("/dashboard/__preview"),
    // Phase 120: every state (empty, loading, error, offline, no permission, plan-locked) and the gestures (dev-server route).
    dash("/dashboard/__states"),
    dash("/dashboard/schedule"), dash("/dashboard/assistant"), dash("/dashboard/team"), dash("/dashboard/documents"), dash("/dashboard/archive"), dash("/dashboard/notifications"),
    // Phase 87: every tab of the Compliance page is its own page state.
    dash("/dashboard/compliance"), dash("/dashboard/compliance?tab=salesTax"), dash("/dashboard/compliance?tab=t5018"), dash("/dashboard/compliance?tab=reminders"),
    // Phase 88: the three tabs of Books.
    dash("/dashboard/books"), dash("/dashboard/books?tab=bank"), dash("/dashboard/books?tab=claims"),
    // Phase 89: the three tabs of Pay.
    dash("/dashboard/pay"), dash("/dashboard/pay?tab=jobs"), dash("/dashboard/pay?tab=settings"),
    // Phase 90: the three tabs of Group (the showcase owner also administers a sister company).
    dash("/dashboard/group"), dash("/dashboard/group?tab=companies"), dash("/dashboard/group?tab=crew"),
    // Phase 91: the person's own page (owner and a foreman, whose first visit is the setup form), and the members tab with seats and codes.
    dash("/dashboard/me"), dash("/dashboard/team?tab=members"), foreman("/dashboard/me"),
    // Phase 110: the owner's hours and equipment tabs, a worker's row ⋯ and the members ⋯ on a phone (no-ops wider: no .row-more there).
    dash("/dashboard/team?tab=time"), dash("/dashboard/team?tab=equipment"),
    { path: "/dashboard/team", session: "owner", name: "/dashboard/team row sheet", drive: (p) => openPhoneSheet(p, ".lrow-split .row-more button", "[role=dialog] .asheet-list") },
    { path: "/dashboard/catalog", session: "owner", name: "/dashboard/catalog more sheet", drive: (p) => openPhoneSheet(p, ".action-bar .more-btn", "[role=dialog] .asheet-list") },
    // Phase 95: a teammate's page as the owner sees it (sent / won), next to the leaderboard on the members tab.
    ...(sweepForemanId ? [dash(`/dashboard/people/${sweepForemanId}`)] : []),
    foreman("/dashboard"), foreman("/dashboard/jobs"), foreman(`/dashboard/jobs/${s.jobId}`), foreman("/dashboard/schedule"), foreman("/dashboard/team"), foreman("/dashboard/team?tab=time"), foreman("/dashboard/team?tab=equipment"), foreman("/dashboard/books"), foreman("/dashboard/pay"), foreman("/dashboard/group"),
  ];
  // `--routes=jobs,pricing` is a substring match; `--routes==/,=/dashboard`
  // pins an exact path (there is no substring that means the homepage alone).
  return list.filter((r) => ROUTE_FILTER.length === 0 || ROUTE_FILTER.some((f) => (f.startsWith("=") ? r.path === f.slice(1) : r.path.includes(f))));
}

const slug = (path: string) => (path === "/" ? "home" : path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "").slice(0, 60)) || "home";

// ── Per-page checks ──────────────────────────────────────────────────────────
type AxeNode = { target: string[]; html: string; any: Array<{ data?: Record<string, unknown> }> };
type AxeViolation = { id: string; impact: "minor" | "moderate" | "serious" | "critical" | null; help: string; helpUrl: string; nodes: AxeNode[] };
type PageResult = {
  lang: string; width: number; path: string; session: Session;
  title: string; screenshot: string;
  overflow: { scrollWidth: number; clientWidth: number; offenders: string[] } | null;
  gutter: { clientWidth: number; offenders: string[] } | null;
  /** Phase 100: calm-mobile rule breaks at phone width — errors since Phase 113. */
  phone: PhoneWarning[];
  /** Phase 113: the page's height in phone screens (at phone widths only). */
  screens: number | null;
  axe: Array<{ id: string; impact: string; help: string; count: number; targets: string[]; detail: string[] }>;
  sr: SrFinding[];
  consoleErrors: string[]; failedRequests: string[]; boundary: string | null; rawKeys: string[]; error?: string;
};

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // Lazy routes + query loaders: wait for skeletons / spinners to clear.
  await page.waitForFunction(() => !document.querySelector(".skeleton, .animate-pulse, .animate-spin, [aria-busy='true']"), null, { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth + 1) return null;
    const cw = doc.clientWidth;
    const offenders: Array<[number, string]> = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= cw + 1) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.visibility === "hidden") continue;
      // Phase 82: an element inside a deliberate sideways scroller (a wide
      // comparison table in its .cmp-wrap) sticks out of the viewport without
      // widening the page — and, being the widest thing on the page, it used
      // to fill the whole offender list and hide whatever actually did.
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== "visible" && p.getBoundingClientRect().right <= cw + 1) { clipped = true; break; }
      }
      if (clipped) continue;
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      offenders.push([r.right - cw, `${el.tagName.toLowerCase()}${id}${cls}`]);
    }
    offenders.sort((a, b) => b[0] - a[0]);
    return { scrollWidth: doc.scrollWidth, clientWidth: cw, offenders: offenders.slice(0, 4).map(([px, sel]) => `${sel} (+${Math.round(px)}px)`) };
  });
}

// Phase 82 — the phone gutter. `.wrap` gives every public page a
// clamp(20px, 4vw, 40px) side gutter, but any later rule using the `padding`
// shorthand with a `0` horizontal component on the same element silently wins
// and the copy ends up flush against the glass. Nothing else here sees it: the
// page does not overflow, axe does not care, and a full-page screenshot at
// 375 px looks plausible until you hold a phone. So below GUTTER_WIDTH every
// element with its own visible text must keep GUTTER_MIN px from both edges.
// Opt out with `data-bleed` on the element or an ancestor (marquees and other
// deliberately full-bleed strips).
const GUTTER_WIDTH = 640;
const GUTTER_MIN = 12;

async function gutter(page: Page, width: number): Promise<PageResult["gutter"]> {
  if (width > GUTTER_WIDTH) return null;
  return page.evaluate((min) => {
    const cw = document.documentElement.clientWidth;
    const offenders: Array<[number, string]> = [];
    const range = document.createRange();
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? "").join("").trim();
      if (!own) continue;
      if (el.closest("[data-bleed]")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.position === "fixed" || Number(cs.opacity) === 0) continue;
      if (el.getBoundingClientRect().width <= 1) continue; // .sr-only: heard, never painted
      // Measure the glyphs, not the box: a full-bleed band whose text is inset
      // by its own padding is exactly what we want, and the box says otherwise.
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType !== Node.TEXT_NODE || !(n.textContent ?? "").trim()) continue;
        range.selectNodeContents(n);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.width === 0 || rect.height === 0) continue;
          left = Math.min(left, rect.left);
          right = Math.max(right, rect.right);
          top = Math.min(top, rect.top + window.scrollY);
        }
      }
      if (left === Infinity) continue;
      if (top < -1000) continue; // recharts' hidden measurement span and friends
      // …and only where it is actually painted: the element itself or an
      // ancestor that clips or scrolls sideways (a `truncate` row, a wide
      // table, a chip rail) hides the overhang, so intersect with every such
      // box — starting with the element's own, which is what puts the ellipsis
      // on a long job name.
      for (let p: HTMLElement | null = el; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX === "visible") continue;
        const pr = p.getBoundingClientRect();
        left = Math.max(left, pr.left);
        right = Math.min(right, pr.right);
      }
      if (right - left <= 0) continue; // clipped away entirely
      if (right <= 0 || left >= cw) continue; // off-canvas drawer, closed menu
      const worst = Math.min(left, cw - right);
      if (worst >= min) continue;
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      offenders.push([worst, `${el.tagName.toLowerCase()}${id}${cls} ${Math.round(worst)}px — ${JSON.stringify(own.slice(0, 40))}`]);
    }
    if (!offenders.length) return null;
    offenders.sort((a, b) => a[0] - b[0]);
    return { clientWidth: cw, offenders: offenders.slice(0, 5).map(([, sel]) => sel) };
  }, GUTTER_MIN);
}

// Phase 100 — the calm-mobile rules (docs/MOBILE-RULES.md) that a machine can
// see, at phone width only. Phase 113 made them the gate: any of them fails
// the run (exit 1), and every page has a height budget. Each names what it
// found so the fix is obvious from the report alone.
type PhoneRule = "stacked-buttons" | "full-width-stat" | "wide-table" | "wrapping-tabs" | "tall-page" | "primary-offscreen" | "under-tabbar" | "clipped-label";
type PhoneWarning = { rule: PhoneRule; detail: string };
const PHONE_WIDTH = 640;

// Phase 113 — how many phone screens (812 px) a page may be. The defaults are
// the calm-mobile target; the exceptions are long on purpose (a document the
// client reads, long-form help and SEO articles) and each says why. A page
// that grows past its budget fails the sweep: fold something, don't raise it.
const PHONE_BUDGET_APP = 6;
const PHONE_BUDGET_PUBLIC = 10;
const PHONE_BUDGETS: Array<{ match: RegExp; screens: number; why: string }> = [
  // Baseline 2026-09-27 (.qa/p113-pre, EN + FR at 375) in brackets.
  { match: /^\/dashboard\/contracts\/.+ agreement$/, screens: 10, why: "the contract's full agreement, unfolded on purpose [9.2]" },
  { match: /^\/dashboard\/quotes\/.+ edit/, screens: 8, why: "the 30-line showcase quote being edited, one row per line [7.0]" },
  { match: /^\/dashboard\/pay/, screens: 7, why: "the pay rules form [6.1 FR]" },
  { match: /^\/dashboard\/__states$/, screens: 9, why: "Phase 120 dev gallery: every state and gesture, one after another [6.4]" },
  { match: /^\/(quotes\/[a-z-]+(\/[a-z-]+)?|fr\/soumissions\/[a-z-]+(\/[a-z-]+)?)\/?$/, screens: 17, why: "a long-form SEO trade article [16.3]" },
  { match: /^\/(mappa-sito|site-?map|plan-du-site)/, screens: 16, why: "the sitemap: one link per page [15.2]" },
  { match: /^\/(fr\/)?blog\/?$/, screens: 14, why: "the article index [12.9]" },
];
function phoneBudget(path: string, session: Session): { screens: number; why: string } {
  const hit = PHONE_BUDGETS.find((b) => b.match.test(path));
  if (hit) return hit;
  return session === "public" ? { screens: PHONE_BUDGET_PUBLIC, why: "public page" } : { screens: PHONE_BUDGET_APP, why: "app page" };
}

async function phoneRules(page: Page, width: number, r: RouteSpec): Promise<{ warnings: PhoneWarning[]; screens: number | null }> {
  if (width > PHONE_WIDTH) return { warnings: [], screens: null };
  const budget = phoneBudget(r.name ?? r.path, r.session);
  // tsx wraps the named helpers below in `__name(…)` (see screen-reader.ts).
  await page.evaluate("globalThis.__name = globalThis.__name || function (f) { return f }").catch(() => {});
  const { out: found, screens } = await page.evaluate(({ budget, why }) => {
    const out: Array<{ rule: string; detail: string }> = [];
    const cw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const label = (el: Element) => {
      const cls = typeof (el as HTMLElement).className === "string" && (el as HTMLElement).className ? "." + (el as HTMLElement).className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      const text = ((el as HTMLElement).innerText ?? "").trim().replace(/\s+/g, " ").slice(0, 28);
      return `${el.tagName.toLowerCase()}${cls}${text ? ` "${text}"` : ""}`;
    };
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("[inert], [aria-hidden='true'], [role='dialog']");
    };
    const inFixed = (el: Element) => {
      for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
        const pos = getComputedStyle(p).position;
        if (pos === "fixed" || pos === "sticky") return true;
      }
      return false;
    };

    // 1. More than two full-width buttons stacked on top of each other.
    // (Phase 102: a settings switch row is a <button role="switch"> the width of its card — a list row, not an action.
    // Phase 105: the same for a section header that opens and closes ([aria-expanded]) and a row of a list (li > button).)
    const btns = Array.from(document.querySelectorAll(".btn, button:not([role='switch']), a[role='button']"))
      .filter((b) => !(b.matches("button[aria-expanded]:not(.btn)") || b.matches("li > button:not(.btn)")))
      .filter((b) => shown(b) && !inFixed(b) && b.getBoundingClientRect().width >= cw * 0.7)
      .map((b) => ({ el: b, r: b.getBoundingClientRect() }))
      .sort((a, b) => a.r.top - b.r.top);
    let run: typeof btns = [];
    const flush = () => {
      if (run.length > 2) out.push({ rule: "stacked-buttons", detail: `${run.length} full-width buttons in a column: ${run.slice(0, 4).map((x) => label(x.el)).join(", ")}` });
      run = [];
    };
    for (const b of btns) {
      const prev = run[run.length - 1];
      if (prev && b.r.top - prev.r.bottom > 24) flush();
      if (!prev || b.r.top >= prev.r.bottom - 2) run.push(b);
    }
    flush();

    // 2. A stat card holding one number across the whole width (an `.editable` one holds a field, not a number — Phase 106).
    const stats = Array.from(document.querySelectorAll(".stat-card:not(.editable)")).filter((s) => shown(s) && s.getBoundingClientRect().width >= cw * 0.8);
    if (stats.length) out.push({ rule: "full-width-stat", detail: `${stats.length} full-width .stat-card: ${stats.slice(0, 3).map(label).join(", ")}` });

    // 3. A data table wider than its box (sideways scrolling for data).
    for (const t of Array.from(document.querySelectorAll("table"))) {
      if (!shown(t) || !t.parentElement) continue;
      const box = t.parentElement.clientWidth;
      if (t.scrollWidth > box + 1) out.push({ rule: "wide-table", detail: `${label(t)} is ${t.scrollWidth}px in a ${box}px box` });
    }

    // 4. Tabs / pill rows wrapping to a second line.
    for (const row of Array.from(document.querySelectorAll(".pills:not(.choices), .stabs, [role='tablist'], .seg"))) {
      if (!shown(row)) continue;
      const tops = new Set(Array.from(row.children).filter(shown).map((c) => Math.round(c.getBoundingClientRect().top / 6)));
      if (tops.size > 1) out.push({ rule: "wrapping-tabs", detail: `${label(row)} wraps to ${tops.size} lines` });
    }

    // 5. Taller than the page's budget (Phase 113: every page has one).
    const screens = document.documentElement.scrollHeight / vh;
    if (screens > budget) out.push({ rule: "tall-page", detail: `${screens.toFixed(1)} phone screens, budget ${budget} (${why})` });

    // 6. The page's marked primary action is neither on screen one nor in a docked bar.
    const primary = Array.from(document.querySelectorAll("[data-primary-action]")).find(shown);
    if (primary && !inFixed(primary) && primary.getBoundingClientRect().top + window.scrollY > vh) {
      out.push({ rule: "primary-offscreen", detail: `${label(primary)} starts ${Math.round(primary.getBoundingClientRect().top + window.scrollY)}px down` });
    }
    return { out, screens };
  }, { budget: budget.screens, why: budget.why });

  // 7. With a bottom tab bar, the end of the page must clear it.
  const covered = await page.evaluate(async () => {
    const bar = document.querySelector(".tabbar");
    if (!bar || getComputedStyle(bar).display === "none") return null;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const top = bar.getBoundingClientRect().top;
    let bottom = 0;
    for (const el of Array.from(document.querySelectorAll("#main *"))) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.height === 0 || cs.position === "fixed" || cs.visibility === "hidden") continue;
      // Docked things (the bar itself, the action bar, sheets) are over the page, not the end of it.
      if (el.closest("[role='dialog'], .action-bar, .tabbar")) continue;
      bottom = Math.max(bottom, r.bottom);
    }
    window.scrollTo(0, 0);
    return bottom > top + 1 ? `content ends ${Math.round(bottom - top)}px under the tab bar` : null;
  });
  if (covered) found.push({ rule: "under-tabbar", detail: covered });
  if (TEXT_SCALE !== 1) found.push(...(await clippedLabels(page)));
  return { warnings: found as PhoneWarning[], screens };
}

// Phase 120: the phone's text-size setting, as a WebView applies it — font
// sizes grow, boxes that were sized for them don't. Sizes are read first and
// written after, so nested text isn't scaled twice.
async function scaleText(page: Page, scale: number) {
  await page.evaluate((scale) => {
    const all = Array.from(document.querySelectorAll<HTMLElement>("body, body *"));
    const sizes = all.map((el) => parseFloat(getComputedStyle(el).fontSize));
    all.forEach((el, i) => el.style.setProperty("font-size", `${(sizes[i]! * scale).toFixed(2)}px`, "important"));
  }, scale);
  await page.waitForTimeout(150);
}

// A label is cut off when its text is wider than its box and the box hides the
// rest (ellipsis or overflow hidden), or when it spills out of its parent. List
// titles and quiet lines truncate by design (one line, ellipsis) and are not labels.
async function clippedLabels(page: Page): Promise<PhoneWarning[]> {
  await page.evaluate("globalThis.__name = globalThis.__name || function (f) { return f }").catch(() => {});
  const found = await page.evaluate(() => {
    const out: string[] = [];
    const LABELS = ".btn, button, [role='tab'], .pill, .chip, .tabbar-link span, label, .ss-lbl, .asheet-item span, .more-row-label, .state-title";
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(LABELS))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest("[aria-hidden='true'], .sr-only, .lrow-title, .lrow-meta")) continue;
      const text = (el.innerText ?? "").trim().replace(/s+/g, " ");
      if (!text) continue;
      const cs = getComputedStyle(el);
      const hides = cs.overflowX !== "visible" || cs.textOverflow === "ellipsis";
      const cut = hides && el.scrollWidth > el.clientWidth + 1;
      const parent = el.parentElement?.getBoundingClientRect();
      // A row of tabs that scrolls sideways is meant to run past its box; one that hides it is not.
      const parentOverflow = el.parentElement ? getComputedStyle(el.parentElement).overflowX : "visible";
      const spills = !hides && !!parent && r.right > parent.right + 2 && (parentOverflow === "hidden" || parentOverflow === "clip");
      if (cut || spills) out.push(`${el.tagName.toLowerCase()} "${text.slice(0, 40)}" (${cut ? `${el.scrollWidth}px in ${el.clientWidth}px` : "spills out of its box"})`);
    }
    return Array.from(new Set(out)).slice(0, 12);
  });
  return found.map((detail) => ({ rule: "clipped-label" as const, detail }));
}

// [route, trigger selector, label] — the overlays a keyboard user meets.
const MODAL_TRIGGERS: Array<[string, string, string]> = [
  ["/", ".menu-btn", "public mobile menu"],
  ["/dashboard", ".tabbar button.tabbar-link", "dashboard More sheet"], // Phase 101: the drawer is gone; More is the sheet
  ["/dashboard", ".tb-new", "dashboard New sheet"],
];

async function runAxe(page: Page): Promise<PageResult["axe"]> {
  await page.addScriptTag({ path: AXE_PATH });
  const res = await page.evaluate(async () => {
    const axe = (window as any).axe;
    const r = await axe.run(document, { resultTypes: ["violations"], rules: { "region": { enabled: false } } });
    return r.violations as AxeViolation[];
  });
  return res
    .filter((v) => v.impact === "moderate" || v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id, impact: v.impact!, help: v.help, count: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
      // color-contrast carries fg/bg/ratio; other rules a snippet of the element.
      detail: v.nodes.slice(0, 3).map((n) => {
        const d = n.any?.[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string } | undefined;
        return d?.fgColor ? `${d.fgColor} on ${d.bgColor} = ${d.contrastRatio} (need ${d.expectedContrastRatio})` : n.html.slice(0, 120);
      }),
    }));
}

async function checkPage(ctx: BrowserContext, base: string, r: RouteSpec, lang: string, width: number): Promise<PageResult> {
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("response", (res) => { if (res.status() >= 400 && res.url().includes("/api/")) failedRequests.push(`${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`); });
  await page.setViewportSize({ width, height: width <= 640 ? 812 : 800 });
  const dir = resolve(OUT, lang, String(width));
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${slug(r.name ?? r.path)}.png`);
  const result: PageResult = { lang, width, path: r.name ?? r.path, session: r.session, title: "", screenshot: file, overflow: null, gutter: null, phone: [], screens: null, axe: [], sr: [], consoleErrors, failedRequests, boundary: null, rawKeys: [] };
  try {
    await page.goto(`${base}${r.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settle(page);
    if (r.drive) {
      await r.drive(page);
      await settle(page);
    }
    if (TEXT_SCALE !== 1 && width <= PHONE_WIDTH) await scaleText(page, TEXT_SCALE);
    result.title = await page.title();
    result.boundary = await page.evaluate(() => {
      const t = document.body.innerText;
      const m = /Something went wrong|Une erreur est survenue|Can't reach QuoteAI|Impossible de joindre/i.exec(t);
      return m ? m[0] : null;
    });
    const tokens: string[] = await page.evaluate(() => Array.from(new Set((document.body.innerText.match(/\b[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_-]+){1,6}\b/g) ?? []))));
    result.rawKeys = tokens.filter((t) => TRANSLATION_KEYS.has(t));
    result.overflow = await overflow(page);
    result.gutter = await gutter(page, width);
    if (SCREENSHOTS) await page.screenshot({ path: file, fullPage: true });
    const phone = await phoneRules(page, width, r);
    result.phone = phone.warnings;
    result.screens = phone.screens;
    if (RUN_AXE) result.axe = await runAxe(page);
    if (RUN_SR) {
      result.sr = await screenReaderAudit(page, { width });
      // The two off-canvas menus are the same component on every page of their
      // half of the app, and the check clicks — so ask once per half, on the
      // narrow viewport where the drawer exists at all.
      if (width <= GUTTER_WIDTH) {
        for (const [route, trigger, label] of MODAL_TRIGGERS) {
          if (r.path !== route || r.drive) continue; // a driven state may already have a sheet open over the trigger
          result.sr.push(...(await modalAudit(page, trigger, label)));
        }
      }
    }
  } catch (e) {
    result.error = (e as Error).message.slice(0, 300);
  } finally {
    await page.close();
  }
  return result;
}

// ── Report ───────────────────────────────────────────────────────────────────
function writeReport(results: PageResult[], meta: Record<string, unknown>) {
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify({ meta, results }, null, 2));
  const lines: string[] = [`# Visual + a11y sweep — ${new Date().toISOString()}`, "", "```json", JSON.stringify(meta), "```", ""];
  const sev = (r: PageResult) => r.axe.filter((a) => a.impact === "serious" || a.impact === "critical").reduce((s, a) => s + a.count, 0);
  const byPath = new Map<string, PageResult[]>();
  for (const r of results) byPath.set(r.path, [...(byPath.get(r.path) ?? []), r]);

  lines.push("## Summary", "", "| route | overflow (lang@width) | gutter | axe serious/critical | screen reader | console errors | failed /api | boundary/error |", "|---|---|---|---|---|---|---|---|");
  for (const [path, rs] of byPath) {
    const ov = rs.filter((r) => r.overflow).map((r) => `${r.lang}@${r.width}`).join(", ") || "—";
    const gu = rs.filter((r) => r.gutter).map((r) => `${r.lang}@${r.width}`).join(", ") || "—";
    const ax = rs.reduce((s, r) => s + sev(r), 0);
    const ce = rs.reduce((s, r) => s + r.consoleErrors.length, 0);
    const fr = rs.reduce((s, r) => s + r.failedRequests.length, 0);
    const be = rs.filter((r) => r.boundary || r.error).map((r) => `${r.lang}@${r.width}: ${r.boundary ?? r.error}`).join("; ") || "—";
    const srRules = [...new Set(rs.flatMap((r) => r.sr.map((f) => f.rule)))];
    lines.push(`| \`${path}\` | ${ov} | ${gu} | ${ax || "—"} | ${srRules.join(", ") || "—"} | ${ce || "—"} | ${fr || "—"} | ${be} |`);
  }

  lines.push("", "## axe violations (moderate+), by rule", "");
  const byRule = new Map<string, { impact: string; help: string; where: string[] }>();
  for (const r of results) for (const a of r.axe) {
    const e = byRule.get(a.id) ?? { impact: a.impact, help: a.help, where: [] };
    e.where.push(`${r.path} ${r.lang}@${r.width} ×${a.count}: ${a.targets.map((t, i) => `${t} — ${a.detail[i] ?? ""}`).join(" | ")}`);
    byRule.set(a.id, e);
  }
  for (const [id, e] of [...byRule].sort((a, b) => b[1].where.length - a[1].where.length)) {
    lines.push(`### ${id} — ${e.impact} — ${e.help}`, "");
    for (const w of e.where.slice(0, 40)) lines.push(`- ${w}`);
    if (e.where.length > 40) lines.push(`- … ${e.where.length - 40} more`);
    lines.push("");
  }

  lines.push("## Screen-reader / keyboard findings, by rule", "");
  const bySrRule = new Map<string, string[]>();
  for (const r of results) for (const f of r.sr) {
    bySrRule.set(f.rule, [...(bySrRule.get(f.rule) ?? []), `${r.path} ${r.lang}@${r.width} — \`${f.target}\`: ${f.detail}`]);
  }
  for (const [rule, where] of [...bySrRule].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${rule} — ${SR_BLOCKING.has(rule as SrFinding["rule"]) ? "blocking" : "report"} — ${where.length} occurrence(s)`, "");
    for (const w of where.slice(0, 30)) lines.push(`- ${w}`);
    if (where.length > 30) lines.push(`- … ${where.length - 30} more`);
    lines.push("");
  }

  lines.push("## Overflow details", "");
  for (const r of results) if (r.overflow) lines.push(`- \`${r.path}\` ${r.lang}@${r.width}: ${r.overflow.scrollWidth}/${r.overflow.clientWidth} — ${r.overflow.offenders.join(", ")}`);
  lines.push("", `## Phone gutter (< ${GUTTER_MIN}px from an edge at ≤ ${GUTTER_WIDTH}px)`, "");
  for (const r of results) if (r.gutter) lines.push(`- \`${r.path}\` ${r.lang}@${r.width}: ${r.gutter.offenders.join(" · ")}`);
  lines.push("", `## Phone rules (≤ ${PHONE_WIDTH}px) — errors (Phase 113 gate)`, "");
  const byPhoneRule = new Map<string, string[]>();
  for (const r of results) for (const w of r.phone) byPhoneRule.set(w.rule, [...(byPhoneRule.get(w.rule) ?? []), `\`${r.path}\` ${r.lang}@${r.width}: ${w.detail}`]);
  for (const [rule, where] of [...byPhoneRule].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${rule} — ${where.length} page(s)`, "");
    for (const w of where.slice(0, 60)) lines.push(`- ${w}`);
    if (where.length > 60) lines.push(`- … ${where.length - 60} more`);
    lines.push("");
  }
  // Phase 113: every phone page's height against its budget, tallest first — the headroom is what the next change can spend.
  const tall = results.filter((r) => r.screens !== null).sort((a, b) => b.screens! - a.screens!);
  if (tall.length) {
    lines.push("", `## Phone heights (screens of 812 px, tallest first)`, "", "| page | lang@width | screens | budget |", "|---|---|---|---|");
    for (const r of tall) {
      const b = phoneBudget(r.path, r.session);
      lines.push(`| \`${r.path}\` | ${r.lang}@${r.width} | ${r.screens!.toFixed(1)}${r.screens! > b.screens ? " **over**" : ""} | ${b.screens} (${b.why}) |`);
    }
  }
  lines.push("", "## Raw translation keys on the page", "");
  for (const r of results) if (r.rawKeys.length) lines.push(`- \`${r.path}\` ${r.lang}@${r.width}: ${r.rawKeys.join(", ")}`);
  lines.push("", "## Console errors / failed requests", "");
  for (const r of results) {
    if (!r.consoleErrors.length && !r.failedRequests.length) continue;
    lines.push(`- \`${r.path}\` ${r.lang}@${r.width}:`);
    for (const c of [...new Set(r.consoleErrors)]) lines.push(`  - console: ${c}`);
    for (const f of [...new Set(r.failedRequests)]) lines.push(`  - request: ${f}`);
  }
  writeFileSync(resolve(OUT, "report.md"), lines.join("\n") + "\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────
const mailbox = await captureResend();
const { installVendorStubs } = await import("./vendorStub.js");
installVendorStubs();
const { startServer, stopServer, createOrg, createUser, cleanupAll } = await import("./harness.js");
const { seedShowcase, setSignTokenCapture } = await import("./fixtures.js");
const { db, businessProfilesTable, quotesTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
setSignTokenCapture(() => {
  for (let i = mailbox.length - 1; i >= 0; i--) {
    const l = mailbox[i]!.links.find((x) => x.includes("/sign/"));
    if (l) return l.split("/sign/")[1]!.split(/[/?#]/)[0]!;
  }
  return null;
});

let browser: Browser | null = null;
let exitCode = 0;
const t0 = Date.now();
try {
  const apiBase = await startServer();
  process.env.QUOTEAI_BASE_URL = `http://localhost:${VITE_PORT}`;
  const frontend = await startVite(VITE_PORT, apiBase);
  console.log(`[qa-visual] api ${apiBase} · frontend ${frontend}`);

  const org = await createOrg({ province: PROVINCE, companyName: PROVINCE === "QC" ? "Rénovations Tremblay inc." : "Northside Renovations Ltd." });
  const showcase = await seedShowcase(org, { withLogo: true });
  // Phase 86b: a foreman member of the showcase company (a second invite — the
  // seeded one must stay unaccepted for the /team-invite page).
  let foremanToken: string | null = null;
  const foremanEmail = `foreman-sweep-${org.userId}@example.invalid`;
  const foremanInvite = await org.api("/api/team/members/invite", { body: { email: foremanEmail, role: "foreman", send: false } });
  if (foremanInvite.status === 201) {
    const foremanUser = await createUser({ email: foremanEmail, name: "Jordan Foreman" });
    const accepted = await foremanUser.api(`/api/team/invite/${String(foremanInvite.body.url).split("/team-invite/")[1]}/accept`, { method: "POST" });
    if (accepted.status === 200) {
      foremanToken = foremanUser.token;
      sweepForemanId = foremanUser.userId;
      // Phase 95: give the showcase quotes senders, so the leaderboard and both people's numbers have something to show.
      const qs = await db.select({ id: quotesTable.id }).from(quotesTable).where(eq(quotesTable.userId, org.userId));
      for (const [i, q] of qs.entries()) await db.update(quotesTable).set({ createdByUserId: org.userId, sentByUserId: i % 3 === 1 ? foremanUser.userId : org.userId }).where(eq(quotesTable.id, q.id));
    }
  }
  if (!foremanToken) console.warn("[qa-visual] could not set up the foreman session — its routes are skipped");
  // Phase 93: signed in, no company — onboarding's own audience. And someone the showcase invited who signed
  // up without the link: onboarding offers the invitation before any form.
  const newcomer = await createUser({ name: "Morgan Newcomer" });
  // Phase 103: an owner on Pro, for the apps their plan doesn't include.
  const proOwner = await createOrg({ plan: "monthly_pro", province: PROVINCE, companyName: PROVINCE === "QC" ? "Plomberie Gagnon inc." : "Lakeside Plumbing Ltd." });
  let inviteeToken: string | null = null;
  const inviteeEmail = `invitee-sweep-${org.userId}@example.invalid`;
  if ((await org.api("/api/team/members/invite", { body: { email: inviteeEmail, role: "office", send: false } })).status === 201) {
    inviteeToken = (await createUser({ email: inviteeEmail, name: "Riley Invitee" })).token;
  } else console.warn("[qa-visual] could not invite the invitee — its route is skipped");
  // Phase 111: the main client's portal, signed in the way a client is — the emailed code, verified.
  {
    const { api } = await import("./harness.js");
    const clients = await org.api("/api/clients");
    const main = Array.isArray(clients.body) ? (clients.body as { id: string; email?: string | null }[]).find((c) => c.email === "client@e2e-test.invalid") : undefined;
    const link = main ? await org.api(`/api/clients/${main.id}/portal`) : null;
    const token = typeof link?.body?.url === "string" ? String(link.body.url).split("/portal/")[1] : null;
    if (token) {
      // The showcase's work belongs to this client (the fixture seeds it without a client): the running job and its
      // invoices, the signed and the unsigned contract, and the quote with tiers still to accept.
      const { clientsTable, contractsTable, projectsTable, invoicesTable } = await import("@workspace/db");
      const { and, inArray } = await import("drizzle-orm");
      const [row] = await db.select({ id: clientsTable.id }).from(clientsTable).where(and(eq(clientsTable.userId, org.userId), eq(clientsTable.email, "client@e2e-test.invalid")));
      if (row) {
        await db.update(quotesTable).set({ clientId: row.id }).where(inArray(quotesTable.id, [showcase.quoteId, showcase.pendingQuoteId, showcase.tieredQuoteId]));
        await db.update(contractsTable).set({ clientId: row.id }).where(inArray(contractsTable.id, [showcase.contractId, showcase.pendingContractId]));
        await db.update(projectsTable).set({ clientId: row.id }).where(eq(projectsTable.id, showcase.jobId));
        await db.update(invoicesTable).set({ clientId: row.id }).where(eq(invoicesTable.projectId, showcase.jobId));
      }
      const before = mailbox.length;
      await api(`/api/portal/${token}/otp`, { body: {} });
      const code = mailbox.slice(before).map((m) => /^(\d{6}) /.exec(m.subject)?.[1]).find(Boolean);
      const ok = code ? await api(`/api/portal/${token}/verify`, { body: { code } }) : null;
      if (ok?.status === 200 && typeof ok.body.session === "string") sweepPortal = { token, session: ok.body.session };
      // Something from the company to read, and a reply, so Messages is not its empty state.
      if (sweepPortal) {
        await org.api(`/api/clients/${main!.id}/messages`, { body: { body: showcase.language === "fr" ? "Bonjour! Les armoires arrivent jeudi. On commence l'installation vendredi matin." : "Hi! The cabinets arrive Thursday. We start the install Friday morning." } }).catch(() => null);
        await api(`/api/portal/${token}/messages`, { body: { body: showcase.language === "fr" ? "Parfait, merci. La porte de côté sera débarrée." : "Perfect, thanks. The side door will be unlocked." }, headers: { "X-Portal-Session": sweepPortal.session } });
      }
    }
    if (!sweepPortal) console.warn("[qa-visual] could not open the showcase client's portal — its routes are skipped");
  }
  console.log(`[qa-visual] showcase seeded for ${org.email}:`, { ...showcase, invoiceToken: "…", signToken: showcase.signToken ? "…" : null, workerToken: showcase.workerToken ? "…" : null, teamInviteToken: showcase.teamInviteToken ? "…" : null });

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  browser = await chromium.launch({ channel: process.env.QA_CHROME_PATH ? undefined : "chrome", executablePath: process.env.QA_CHROME_PATH, headless: true });
  const results: PageResult[] = [];
  const all = routes(showcase);
  for (const lang of LANGS) {
    const widths = lang === "fr" ? WIDTHS_FR : WIDTHS_EN;
    for (const session of ["public", "owner", "foreman", "newcomer", "invitee", "pro"] as const) {
      const rs = all.filter((r) => r.session === session);
      const bearer = session === "owner" ? org.token : session === "foreman" ? foremanToken : session === "newcomer" ? newcomer.token : session === "invitee" ? inviteeToken : session === "pro" ? proOwner.token : null;
      if (!rs.length || (session !== "public" && !bearer)) continue;
      const ctx = await browser.newContext({
        locale: lang === "fr" ? "fr-CA" : "en-CA",
        extraHTTPHeaders: bearer ? { authorization: `Bearer ${bearer}` } : {},
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      await ctx.addInitScript((l: string) => { try { localStorage.setItem("quoteai-lang", l); } catch {} }, lang);
      for (const width of widths) {
        for (const r of rs) {
          // Step 3 saves the company: every newcomer page starts from "no company yet" again.
          if (session === "newcomer") await db.delete(businessProfilesTable).where(eq(businessProfilesTable.userId, newcomer.userId));
          const res = await checkPage(ctx, frontend, r, lang, width);
          results.push(res);
          const flags = [res.overflow && "OVERFLOW", res.gutter && `GUTTER:${res.gutter.offenders.length}`, res.phone.length && `phone:${[...new Set(res.phone.map((w) => w.rule))].join(",")}`, res.sr.length && `SR:${[...new Set(res.sr.map((f) => f.rule))].join(",")}`, res.axe.some((a) => a.impact !== "moderate") && `AXE:${res.axe.filter((a) => a.impact !== "moderate").map((a) => a.id).join(",")}`, res.consoleErrors.length && `CONSOLE:${res.consoleErrors.length}`, res.failedRequests.length && `API:${res.failedRequests.length}`, res.boundary && `BOUNDARY:${res.boundary}`, res.rawKeys.length && `RAWKEY:${res.rawKeys.join(",")}`, res.error && `ERROR:${res.error}`].filter(Boolean);
          console.log(`${lang}@${String(width).padStart(4)} ${(r.name ?? r.path).padEnd(60)} ${flags.join(" ") || "ok"}`);
        }
      }
      await ctx.close();
    }
  }
  writeReport(results, { langs: LANGS, widthsEn: WIDTHS_EN, widthsFr: WIDTHS_FR, province: PROVINCE, routes: all.length, pages: results.length, seconds: Math.round((Date.now() - t0) / 1000) });
  const serious = results.reduce((s, r) => s + r.axe.filter((a) => a.impact !== "moderate").reduce((x, a) => x + a.count, 0), 0);
  const overflows = results.filter((r) => r.overflow).length;
  const gutters = results.filter((r) => r.gutter).length;
  const rawKeyPages = results.filter((r) => r.rawKeys.length).length;
  const srBlocking = results.reduce((s, r) => s + r.sr.filter((f) => SR_BLOCKING.has(f.rule)).length, 0);
  const srOther = results.reduce((s, r) => s + r.sr.length, 0) - srBlocking;
  const phonePages = results.filter((r) => r.phone.length).length;
  const broken = results.filter((r) => r.boundary || r.error).length;
  console.log(`\n[qa-visual] ${results.length} pages in ${Math.round((Date.now() - t0) / 1000)}s — overflow on ${overflows}, gutter on ${gutters}, axe serious/critical nodes ${serious}, screen-reader ${srBlocking} blocking + ${srOther} to read, raw i18n keys on ${rawKeyPages}, phone-rule errors on ${phonePages}, broken ${broken} → ${resolve(OUT, "report.md")}`);
  // Phase 113: the sweep is a gate. Every one of these has been zero since the phase that introduced it;
  // console errors and failed requests stay in the report only (third-party noise, rate limits on purpose).
  const failures = overflows + gutters + serious + srBlocking + rawKeyPages + phonePages + broken;
  if (GATE && failures) {
    console.error(`[qa-visual] FAILED: ${failures} finding(s) — see report.md (--gate=false to only report)`);
    exitCode = 1;
  }
  if (KEEP) {
    console.log(`[qa-visual] --keep: account ${org.email} left in place; bearer ${org.token}; frontend ${frontend} (API ${apiBase}). Ctrl-C to stop.`);
    await new Promise(() => {});
  }
} finally {
  await browser?.close().catch(() => {});
  if (!KEEP) {
    await cleanupAll().catch((e) => console.error("[qa-visual] cleanup failed", e));
    await stopVite();
    await stopServer();
  }
}
process.exit(exitCode);
