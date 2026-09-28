// Phase 118: the phone app's request routing, what it shows, and which links
// open it. Run: pnpm --filter @workspace/quote-ai test (node:test through tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { apiPath, apiUrlFor, keptAuthCookie } from "./rewrite";
import { appPathForLink, isAppPath, isRootScreen, opensHome } from "./routes";
import { fileNameFor, isApiFileLink, mapsQueryOf, nativeMapsUrl } from "./links";
import { newInstallId } from "./install";

const PAGE = "https://localhost";
const API = "https://quoteai.ca";

test("API calls go to the API origin, everything else stays on the phone", () => {
  assert.equal(apiUrlFor("/api/jobs?x=1", PAGE, API), "https://quoteai.ca/api/jobs?x=1");
  assert.equal(apiUrlFor("https://localhost/api/auth/sign-in/email", PAGE, API), "https://quoteai.ca/api/auth/sign-in/email");
  assert.equal(apiUrlFor("/assets/index.js", PAGE, API), null);
  assert.equal(apiUrlFor("/apiary", PAGE, API), null);
  assert.equal(apiUrlFor("https://localhost/dashboard", PAGE, API), null);
  assert.equal(apiUrlFor("https://eu.i.posthog.com/api/e", PAGE, API), null, "someone else's /api is not ours");
  assert.equal(apiUrlFor("capacitor://localhost/api/me", "capacitor://localhost", API), "https://quoteai.ca/api/me");
  assert.equal(apiUrlFor("data:image/png;base64,AA", PAGE, API), null);
  assert.equal(apiUrlFor("/api/jobs", PAGE, ""), null, "the website never rewrites");
});

test("the path of a rewritten call, for sign-out detection", () => {
  assert.equal(apiPath("https://quoteai.ca/api/auth/sign-out?x=1", API), "/api/auth/sign-out");
  assert.equal(apiPath("https://quoteai.ca/api/auth/sign-out", API), "/api/auth/sign-out");
});

test("the two-step sign-in cookie is kept until the server clears it", () => {
  assert.equal(keptAuthCookie("better-auth.two_factor=abc.sig"), "better-auth.two_factor=abc.sig");
  assert.equal(keptAuthCookie("__Secure-better-auth.two_factor="), null);
  assert.equal(keptAuthCookie(""), null);
});

test("the app shows the signed-in app and the way into it, not the website", () => {
  for (const p of ["/dashboard", "/dashboard/jobs/1", "/onboarding", "/sign-in", "/sign-in/forgot", "/sign-up", "/join", "/team-invite/tok", "/t/tok"]) assert.ok(isAppPath(p), p);
  for (const p of ["/", "/pricing/", "/fr", "/blog/x", "/p/abc", "/sign/tok", "/i/tok", "/portal/tok", "/t", "/t/", "/terms", "/dashboardx"]) assert.ok(!isAppPath(p), p);
});

test("a quoteai.ca/dashboard link opens that screen; other links do not", () => {
  const hosts = ["quoteai.ca", "www.quoteai.ca"];
  assert.equal(appPathForLink("https://quoteai.ca/dashboard/jobs/7?tab=photos#p1", hosts), "/dashboard/jobs/7?tab=photos#p1");
  assert.equal(appPathForLink("https://www.quoteai.ca/dashboard", hosts), "/dashboard");
  assert.equal(appPathForLink("https://quoteai.ca/p/abc", hosts), null, "a client's quote link stays in the browser");
  assert.equal(appPathForLink("https://evil.example/dashboard", hosts), null);
  assert.equal(appPathForLink("not a url", hosts), null);
});

test("Android back leaves the app from its home screens", () => {
  assert.ok(isRootScreen("/dashboard"));
  assert.ok(isRootScreen("/dashboard/"));
  assert.ok(isRootScreen("/sign-in"));
  assert.ok(isRootScreen("/t/abc123"), "a crew member's Now screen");
  assert.ok(!isRootScreen("/dashboard/jobs"));
});

test("the website's homepage means the app's home; other site pages open in the browser", () => {
  for (const p of ["/", "/fr", "/fr/"]) assert.ok(opensHome(p), p);
  for (const p of ["/terms", "/fr/conditions", "/help/x", "/p/abc"]) assert.ok(!opensHome(p), p);
});

// ── Phase 119: native powers ────────────────────────────────────────────────

test("a crew link opens the app (Phase 119); client links still do not", () => {
  const hosts = ["quoteai.ca"];
  assert.equal(appPathForLink("https://quoteai.ca/t/AbC_12-x", hosts), "/t/AbC_12-x");
  assert.equal(appPathForLink("https://quoteai.ca/i/tok", hosts), null);
  assert.equal(appPathForLink("https://quoteai.ca/portal/tok", hosts), null);
});

test("/api links are files the app shares; sign-in links and other sites are not", () => {
  assert.ok(isApiFileLink("/api/invoices/7/pdf?download=1", API));
  assert.ok(isApiFileLink("/api/storage/objects/quote-pdfs/x.pdf", API));
  assert.ok(isApiFileLink("https://quoteai.ca/api/pay/export.csv", API));
  assert.ok(!isApiFileLink("/api/auth/sign-out", API));
  assert.ok(!isApiFileLink("/dashboard/invoices/7", API));
  assert.ok(!isApiFileLink("https://evil.example/api/x.pdf", API));
  assert.ok(!isApiFileLink("/apiary", API));
});

test("a maps link becomes the phone's maps app", () => {
  const google = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("12 rue Sainte-Anne, Québec");
  assert.equal(mapsQueryOf(google), "12 rue Sainte-Anne, Québec");
  assert.equal(mapsQueryOf("https://maps.google.com/?q=Halifax"), "Halifax");
  assert.equal(mapsQueryOf("https://maps.apple.com/?daddr=Toronto"), "Toronto");
  assert.equal(mapsQueryOf("https://www.google.com/search?q=maps"), null);
  assert.equal(mapsQueryOf("not a url"), null);
  assert.equal(nativeMapsUrl("12 rue Sainte-Anne, Québec", "android"), "geo:0,0?q=12%20rue%20Sainte-Anne%2C%20Qu%C3%A9bec");
  assert.equal(nativeMapsUrl("Halifax", "ios"), "maps://?q=Halifax");
});

test("a shared file keeps a sensible name", () => {
  assert.equal(fileNameFor("/api/x", "Quote Q-12.pdf", null, "application/pdf"), "Quote Q-12.pdf");
  assert.equal(fileNameFor("/api/invoices/7/pdf?download=1", null, 'attachment; filename="INV-0042.pdf"', "application/pdf"), "INV-0042.pdf");
  assert.equal(fileNameFor("/api/x", null, "attachment; filename*=UTF-8''Re%C3%A7u%20mai.pdf", null), "Reçu mai.pdf");
  assert.equal(fileNameFor("/api/invoices/7/pdf", null, null, "application/pdf"), "QuoteAI.pdf", "a route called /pdf is not a name");
  assert.equal(fileNameFor("/api/pay/export.csv", null, null, "text/csv"), "export.csv");
  assert.equal(fileNameFor("blob:https://localhost/1234", null, null, "image/jpeg"), "QuoteAI.jpg");
  assert.equal(fileNameFor("/api/x", "a/b:c?.pdf", null, null), "a_b_c_.pdf");
});

test("each install gets its own id in the form the API accepts", () => {
  const a = newInstallId();
  const b = newInstallId();
  assert.match(a, /^[a-f0-9]{32}$/);
  assert.notEqual(a, b);
});
