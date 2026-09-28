// Phase 118: the phone app's request routing, what it shows, and which links
// open it. Run: pnpm --filter @workspace/quote-ai test (node:test through tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { apiPath, apiUrlFor, keptAuthCookie } from "./rewrite";
import { appPathForLink, isAppPath, isRootScreen, opensHome } from "./routes";

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
  for (const p of ["/dashboard", "/dashboard/jobs/1", "/onboarding", "/sign-in", "/sign-in/forgot", "/sign-up", "/join", "/team-invite/tok"]) assert.ok(isAppPath(p), p);
  for (const p of ["/", "/pricing/", "/fr", "/blog/x", "/p/abc", "/sign/tok", "/i/tok", "/portal/tok", "/t/tok", "/dashboardx"]) assert.ok(!isAppPath(p), p);
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
  assert.ok(!isRootScreen("/dashboard/jobs"));
});

test("the website's homepage means the app's home; other site pages open in the browser", () => {
  for (const p of ["/", "/fr", "/fr/"]) assert.ok(opensHome(p), p);
  for (const p of ["/terms", "/fr/conditions", "/help/x", "/p/abc"]) assert.ok(!opensHome(p), p);
});
