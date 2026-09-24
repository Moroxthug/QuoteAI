// Phase 93 — sign-up, walked for real.
//
// Phase 91's onboarding (company → your work → province and payments → your
// team), /join and the invite page were checked by typecheck and reading. This
// walks them in Chrome against the real SPA (Vite, proxied at the in-process
// API), the way people arrive, each in their own browser with their own
// address (and their own IP — the sign-up limiter is per IP):
//
//  A. a brand-new owner: sign-up form → verification email → all four
//     onboarding steps → first quote → dashboard;
//  B. an owner from /pricing who picked Pro and wants 4 logins: the plan and
//     the 2 extra seats reach Stripe checkout (mocked at the SDK), and the
//     return from checkout lands where the owner invites people;
//  C. an employee with an access code: /join → sign up → verify → back to
//     /join → join → profile setup;
//  D. an email invite end to end (an admin, the role that could edit the
//     company), then the same person on /onboarding by accident: sent to the
//     dashboard, the employer's company untouched, no company of their own;
//  E. an invitee who signed up without the link: /onboarding shows the
//     invitation instead of a form that would make an empty company.
//
// Each is walked in English and French at 1280 and 375 px. Every step is
// screenshotted to .qa/phase93/<lang>/<width>/ (gitignored) and checked for
// sideways overflow, the error boundary, raw translation keys and uncaught
// errors.

import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { and, eq } from "drizzle-orm";
import { db, businessProfilesTable, organizationMembersTable, authUsersTable } from "@workspace/db";
import { sentEmails, emailsTo, linksIn } from "./mailbox.js";

const h = vi.hoisted(() => {
  // Before the app is imported: auth and email links must point at the SPA's
  // origin (the verification link is followed in the browser).
  const PORT = 5193;
  const FRONT = `http://localhost:${PORT}`;
  process.env.BETTER_AUTH_URL = FRONT;
  process.env.QUOTEAI_BASE_URL = FRONT;
  process.env.TRUSTED_ORIGINS = [process.env.TRUSTED_ORIGINS, FRONT].filter(Boolean).join(",");
  return { PORT, FRONT, checkouts: [] as Array<Record<string, any>> };
});

// Stripe's SDK has its own HTTP client (not fetch), so it is answered here:
// checkout sessions are recorded and "open" on a local stub page.
vi.mock("../stripeClient", () => ({
  getUncachableStripeClient: async () => ({
    checkout: {
      sessions: {
        create: async (params: Record<string, any>) => {
          h.checkouts.push(params);
          return { id: `cs_test_walk_${h.checkouts.length}`, url: `${h.FRONT}/__stripe_checkout__?n=${h.checkouts.length}` };
        },
      },
    },
    customers: { list: async () => ({ data: [] }) },
    // The return page asks the server to sync from Stripe: answer with the subscription the last checkout "bought".
    subscriptions: {
      list: async (q: { status?: string }) => {
        const last = h.checkouts.at(-1);
        if (!last || q.status !== "active") return { data: [] };
        return { data: [{ id: "sub_walk", status: "active", items: { data: (last.line_items as Array<{ price: string; quantity: number }>).map((li) => ({ price: { id: li.price }, quantity: li.quantity, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400 })) } }] };
      },
    },
    promotionCodes: { list: async () => ({ data: [] }) },
  }),
  getStripePublishableKey: async () => "",
  getStripeSecretKey: async () => "sk_test_walk",
}));

const { startServer, stopServer, createOrg, cleanupAll, adoptUserByEmail } = await import("./harness.js");
const { startVite, stopVite } = await import("./viteServer.js");

const SHOTS = resolve(__dirname, "../../.qa/phase93");
const PASSWORD = "Walk-test-pass-93!";
const SEAT_PRICE = "price_walk_extra_seat";
type Lang = "en" | "fr";
const COMBOS: Array<[Lang, number]> = [["en", 1280], ["en", 375], ["fr", 1280], ["fr", 375]];

let browser: Browser;
let ipCounter = 10;

type Walk = { page: Page; ctx: BrowserContext; lang: Lang; width: number; flow: string; findings: string[]; errors: string[]; n: number };

async function open(flow: string, lang: Lang, width: number): Promise<Walk> {
  const ctx = await browser.newContext({
    locale: lang === "fr" ? "fr-CA" : "en-CA",
    viewport: { width, height: width <= 640 ? 812 : 800 },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
    // One person, one device: the sign-up limiter keys on the forwarded IP (trust proxy 1).
    extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${ipCounter++}` },
  });
  await ctx.addInitScript((l: string) => { try { localStorage.setItem("quoteai-lang", l); } catch {} }, lang);
  // The Stripe-hosted checkout page, standing in.
  await ctx.route(`${h.FRONT}/__stripe_checkout__**`, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Checkout</title><h1>Stripe checkout (stub)</h1>" }));
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 300)));
  mkdirSync(resolve(SHOTS, lang, String(width)), { recursive: true });
  return { page, ctx, lang, width, flow, findings: [], errors, n: 0 };
}

/** Visible within 10 s (vitest has no Playwright matchers). */
const visible = (loc: ReturnType<Page["locator"]>) => loc.first().waitFor({ state: "visible", timeout: 10_000 });

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector(".animate-spin, .auth-spin, [aria-busy='true']"), null, { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(250);
}

/** Screenshot + the checks every step gets. */
async function look(w: Walk, label: string) {
  await settle(w.page);
  const r = await w.page.evaluate(() => {
    const doc = document.documentElement;
    const text = document.body.innerText;
    return {
      overflow: doc.scrollWidth > doc.clientWidth + 1 ? `${doc.scrollWidth}/${doc.clientWidth}` : null,
      boundary: /Something went wrong|Une erreur est survenue/i.exec(text)?.[0] ?? null,
      rawKeys: Array.from(new Set(text.match(/\b(?:setup|onboarding|join|invite|me|signUp|signIn|team|seats|codes|group)\.[a-zA-Z0-9_.-]+\b/g) ?? [])).filter((k) => !/\.(ca|com|invalid|js)$/.test(k)),
    };
  });
  const where = `${w.flow} ${w.lang}@${w.width} ${label}`;
  if (r.overflow) w.findings.push(`${where}: sideways overflow ${r.overflow}`);
  if (r.boundary) w.findings.push(`${where}: error boundary`);
  if (r.rawKeys.length) w.findings.push(`${where}: raw keys ${r.rawKeys.join(", ")}`);
  w.n += 1;
  await w.page.screenshot({ path: resolve(SHOTS, w.lang, String(w.width), `${w.flow}-${String(w.n).padStart(2, "0")}-${label}.png`), fullPage: true });
}

async function done(w: Walk) {
  await w.ctx.close();
  expect(w.errors, `${w.flow} ${w.lang}@${w.width}: uncaught page errors`).toEqual([]);
  expect(w.findings).toEqual([]);
}

async function mailTo(email: string, match: (l: string) => boolean): Promise<string> {
  for (let i = 0; i < 50; i++) {
    for (const m of emailsTo(email).reverse()) {
      const link = linksIn(m).find(match);
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no email with the expected link reached ${email} (${sentEmails.length} sent in all)`);
}

const walkEmail = (flow: string, lang: Lang, width: number) => `e2e-walk-${flow}-${lang}${width}-${randomUUID().slice(0, 8)}@example.invalid`;

/** The sign-up form (already open), then the verification link from the email. */
async function signUp(w: Walk, email: string, name: string, opts: { resend?: boolean } = {}) {
  await w.page.waitForSelector("#name");
  await look(w, "sign-up");
  await w.page.fill("#name", name);
  await w.page.fill("#email", email);
  await w.page.fill("#password", PASSWORD);
  await w.page.click("button[type=submit]");
  await w.page.waitForSelector(".auth-center");
  await look(w, "check-email");
  if (opts.resend) {
    // "Nothing yet? … send it again": a second verification email, and the page says so.
    await mailTo(email, (l) => l.includes("/api/auth/verify-email"));
    await w.page.locator(".auth-center button.auth-link").click();
    await w.page.waitForFunction(() => /Sent|Envoyé/.test(document.querySelector(".auth-center [role=status]")?.textContent ?? ""), null, { timeout: 10_000 });
    await look(w, "resent");
    expect(emailsTo(email).filter((m) => linksIn(m).some((l) => l.includes("/api/auth/verify-email")))).toHaveLength(2);
  }
  const link = await mailTo(email, (l) => l.includes("/api/auth/verify-email"));
  await w.page.goto(link);
  await adoptUserByEmail(email);
}

async function atStep(w: Walk, n: number, label: string) {
  await w.page.waitForSelector(`[data-step="${n}"]`, { timeout: 20_000 });
  await look(w, label);
}

/** Steps 1-3 of onboarding; returns once step 4 is on screen. */
async function onboard(w: Walk, opts: { company: string; seatsWanted: number; province: "ON" | "QC" }) {
  await atStep(w, 1, "step1-company");
  await w.page.fill("#companyName", opts.company);
  await w.page.fill("#phone", "416 555 0199");
  await w.page.fill("#address", "12 King St W, Toronto, ON");
  await w.page.click(".card-foot .btn-navy");
  await atStep(w, 2, "step2-work");
  const trades = w.page.locator("fieldset").first().locator(".pill");
  await trades.nth(0).click();
  await trades.nth(2).click();
  await w.page.fill("#setup-team", "8");
  await w.page.fill("#setup-seats", String(opts.seatsWanted));
  await w.page.locator("fieldset").nth(1).locator(".pill").first().click();
  await look(w, "step2-filled");
  await w.page.click(".card-foot .btn-navy");
  await atStep(w, 3, "step3-province");
  await w.page.selectOption("#province", opts.province);
  await w.page.fill("#licence", opts.province === "QC" ? "RBQ 5555-1234-01" : "LIC-9393");
  await w.page.fill("#etransfer", "pay@walk.example.invalid");
  await w.page.click(".card-foot .btn-navy");
  await atStep(w, 4, "step4-team");
}

async function profileOf(userId: string) {
  const [p] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return p ?? null;
}
async function userIdOf(email: string) {
  const [u] = await db.select({ id: authUsersTable.id }).from(authUsersTable).where(eq(authUsersTable.email, email));
  return u!.id;
}

beforeAll(async () => {
  const apiBase = await startServer();
  await startVite(h.PORT, apiBase);
  browser = await chromium.launch({ channel: process.env.QA_CHROME_PATH ? undefined : "chrome", executablePath: process.env.QA_CHROME_PATH, headless: true });
}, 180_000);

afterAll(async () => {
  await browser?.close().catch(() => {});
  await cleanupAll();
  await stopVite();
  await stopServer();
});

describe.each(COMBOS)("Phase 93 walk — %s @ %i px", (lang, width) => {
  const province = lang === "fr" ? "QC" : "ON";

  test("A. a brand-new owner: sign-up, the four steps, the dashboard", async () => {
    const w = await open("A-owner", lang, width);
    const email = walkEmail("a", lang, width);
    await w.page.goto(`${h.FRONT}/sign-up`);
    await signUp(w, email, "Robin Owner", { resend: true });
    await w.page.waitForURL(/\/onboarding$/, { timeout: 20_000 });
    await onboard(w, { company: "Walk Renovations Ltd.", seatsWanted: 3, province });
    // No plan picked, no team feature: the Pro note, and the crew note (they said crews work on site).
    await visible(w.page.locator(".notice.info"));
    await visible(w.page.locator(".notice.teal"));
    await w.page.locator("button.w-full.btn-outline-navy").click();
    await w.page.waitForURL(/\/dashboard\/new/);
    await look(w, "first-quote");
    await w.page.goto(`${h.FRONT}/dashboard`);
    await settle(w.page);
    expect(new URL(w.page.url()).pathname).toBe("/dashboard");
    await look(w, "dashboard");

    const p = await profileOf(await userIdOf(email));
    expect(p?.companyName).toBe("Walk Renovations Ltd.");
    expect(p?.province).toBe(province);
    expect(p?.phone).toBe("416 555 0199");
    expect(p?.companySetup).toMatchObject({ teamSize: 8, seatsWanted: 3, fieldCrew: true });
    expect(p?.companySetup?.trades).toHaveLength(2);
    // The verification email speaks the language the person signed up in.
    const verify = emailsTo(email).find((m) => linksIn(m).some((l) => l.includes("/api/auth/verify-email")))!;
    expect(verify.subject).toMatch(lang === "fr" ? /Confirmez|Vérifiez/ : /Verify/);
    expect(verify.html).toContain(`lang="${lang}"`);
    // The owner's welcome, in the same language.
    expect(emailsTo(email).map((m) => m.subject)).toContain(lang === "fr" ? "Bienvenue sur QuoteAI" : "Welcome to QuoteAI");
    await done(w);
  }, 240_000);

  test("B. from /pricing with Pro and 4 logins wanted: plan + 2 extra seats reach checkout", async () => {
    // English runs have the seat price (Stripe test mode); French runs show what happens before the owner creates it.
    const priced = lang === "en";
    if (priced) process.env.STRIPE_PRICE_EXTRA_SEAT = SEAT_PRICE;
    else delete process.env.STRIPE_PRICE_EXTRA_SEAT;
    try {
      const w = await open("B-pricing", lang, width);
      const email = walkEmail("b", lang, width);
      await w.page.goto(`${h.FRONT}${lang === "fr" ? "/fr/tarifs" : "/pricing"}`);
      await look(w, "pricing");
      await w.page.locator(".price-card", { has: w.page.locator("h2", { hasText: /^Pro$/ }) }).locator(".price-foot button").click();
      await w.page.waitForURL(/\/sign-up\?plan=monthly_pro/);
      await signUp(w, email, "Sam Pricing");
      await w.page.waitForURL(/\/onboarding\?plan=monthly_pro/, { timeout: 20_000 });
      await onboard(w, { company: "Pricing Walk Inc.", seatsWanted: 4, province });

      const before = h.checkouts.length;
      if (priced) {
        expect((await w.page.locator("output").textContent())?.trim()).toBe("2");
      } else {
        // No seat price yet: no stepper that would silently charge for fewer logins than shown.
        expect(await w.page.locator("output").count()).toBe(0);
        await visible(w.page.locator("[data-seats-unavailable]"));
      }
      await w.page.locator("[data-checkout]").click();
      await w.page.waitForURL(/__stripe_checkout__/);
      expect(h.checkouts.length).toBe(before + 1);
      const session = h.checkouts.at(-1)!;
      const userId = await userIdOf(email);
      expect(session.metadata).toMatchObject({ userId, planType: "monthly_pro", extraSeats: priced ? "2" : "0" });
      expect(session.line_items).toEqual(priced ? [{ price: expect.any(String), quantity: 1 }, { price: SEAT_PRICE, quantity: 2 }] : [{ price: expect.any(String), quantity: 1 }]);
      expect(session.customer_email).toBe(email);

      // What the webhook does on payment, then the way back from Stripe.
      await db.update(businessProfilesTable).set({ subscriptionPlan: "monthly_pro", subscriptionStatus: "active", subscriptionInterval: "month", stripeCustomerId: `cus_walk_${randomUUID().slice(0, 8)}`, extraSeats: priced ? 2 : 0 }).where(eq(businessProfilesTable.userId, userId));
      const success = new URL(session.success_url as string);
      expect(success.origin).toBe(h.FRONT);
      expect(success.pathname).toBe("/dashboard/team");
      await w.page.goto(session.success_url as string);
      await settle(w.page);
      await visible(w.page.locator("[data-payment-return]"));
      // Where the logins just paid for are handed out; the sync on return kept the plan.
      await visible(w.page.locator("[data-invite-member]"));
      expect((await profileOf(userId))?.subscriptionPlan).toBe("monthly_pro");
      await look(w, "back-from-checkout");
      await done(w);
    } finally {
      delete process.env.STRIPE_PRICE_EXTRA_SEAT;
    }
  }, 240_000);

  test("C. an employee with an access code: /join, sign up, verify, join, profile", async () => {
    const owner = await createOrg({ plan: "monthly_pro", province, companyName: lang === "fr" ? "Rénovations Code inc." : "Code Walk Contracting" });
    const made = await owner.api("/api/team/members/codes", { body: { count: 1, role: "foreman" } });
    expect(made.status).toBe(201);
    const code = made.body.codes[0].code as string;

    const w = await open("C-code", lang, width);
    const email = walkEmail("c", lang, width);
    await w.page.goto(`${h.FRONT}/join`);
    await look(w, "join");
    await w.page.fill("#join-code", code);
    await w.page.click("form button[type=submit]");
    await w.page.waitForSelector("a[href^='/sign-up?next=']");
    await look(w, "code-checked");
    await w.page.click("a[href^='/sign-up?next=']");
    await w.page.waitForURL(/\/sign-up\?next=/);
    await signUp(w, email, "Alex Foreman");
    await w.page.waitForURL(/\/join\?code=/, { timeout: 20_000 });
    await w.page.waitForSelector("main button.btn-navy");
    await look(w, "back-to-join");
    await w.page.click("main button.btn-navy");
    await w.page.waitForURL(/\/dashboard\/me\?welcome=1/, { timeout: 20_000 });
    await w.page.waitForSelector("#me-title");
    await look(w, "profile-setup");
    await w.page.fill("#me-title", lang === "fr" ? "Chef d'équipe" : "Site lead");
    await w.page.fill("#me-phone", "514 555 0142");
    await w.page.click("form button[type=submit]");
    await w.page.waitForFunction(() => !document.querySelector("#me-title"), null, { timeout: 15_000 });
    await look(w, "profile-done");

    const id = await userIdOf(email);
    const [m] = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.ownerId, owner.userId), eq(organizationMembersTable.userId, id)));
    expect(m).toMatchObject({ status: "active", role: "foreman" });
    expect(await profileOf(id)).toBeNull();
    // Someone joining a company is not welcomed as a new business owner.
    expect(emailsTo(email).some((m) => /Welcome to QuoteAI|Bienvenue sur QuoteAI/.test(m.subject))).toBe(false);
    await done(w);
  }, 240_000);

  test("D. an emailed invite, accepted; then /onboarding by accident goes to the dashboard", async () => {
    const companyName = lang === "fr" ? "Rénovations Invitation inc." : "Invite Walk Builders";
    const owner = await createOrg({ plan: "monthly_pro", province, companyName });
    const email = walkEmail("d", lang, width);
    const inv = await owner.api("/api/team/members/invite", { body: { email, role: "admin" } });
    expect(inv.status).toBe(201);
    expect(inv.body.emailed).toBe(true);
    const link = await mailTo(email, (l) => l.includes("/team-invite/"));
    expect(link.startsWith(`${h.FRONT}/team-invite/`)).toBe(true);

    const w = await open("D-invite", lang, width);
    await w.page.goto(link);
    await w.page.waitForSelector("a[href^='/sign-up?next=']");
    await look(w, "invite");
    await w.page.click("a[href^='/sign-up?next=']");
    await signUp(w, email, "Jamie Admin");
    await w.page.waitForURL(/\/team-invite\//, { timeout: 20_000 });
    await w.page.waitForSelector("main button.btn-navy");
    await look(w, "back-to-invite");
    await w.page.click("main button.btn-navy");
    await w.page.waitForSelector("a[href='/dashboard/me?welcome=1']");
    await look(w, "accepted");
    await w.page.click("a[href='/dashboard/me?welcome=1']");
    await w.page.waitForSelector("#me-title");
    await look(w, "profile-setup");

    // By accident: an old bookmark, the back button, a link in the welcome email.
    await w.page.goto(`${h.FRONT}/onboarding`);
    await w.page.waitForURL((u) => u.pathname.startsWith("/dashboard"), { timeout: 15_000 });
    await look(w, "onboarding-by-accident");
    expect(w.page.url()).not.toContain("/onboarding");
    const id = await userIdOf(email);
    expect(await profileOf(id)).toBeNull();
    expect((await profileOf(owner.userId))?.companyName).toBe(companyName);
    expect(emailsTo(email).some((m) => /Welcome to QuoteAI|Bienvenue sur QuoteAI/.test(m.subject))).toBe(false);
    await done(w);
  }, 240_000);

  test("E. invited, but signed up without the link: /onboarding offers the invitation", async () => {
    const companyName = lang === "fr" ? "Rénovations Sans Lien inc." : "No Link Renovations";
    const owner = await createOrg({ plan: "monthly_pro", province, companyName });
    const email = walkEmail("e", lang, width);
    expect((await owner.api("/api/team/members/invite", { body: { email, role: "office" } })).status).toBe(201);

    const w = await open("E-pending", lang, width);
    await w.page.goto(`${h.FRONT}/sign-up`);
    await signUp(w, email, "Casey Office");
    await w.page.waitForURL(/\/onboarding/, { timeout: 20_000 });
    await w.page.waitForSelector("[data-pending-invite]");
    await look(w, "onboarding-invitation");
    expect(await w.page.locator("[data-pending-invite]").textContent()).toContain(companyName);
    await w.page.locator("[data-pending-invite] button.btn-navy").click();
    await w.page.waitForURL(/\/dashboard\/me\?welcome=1/, { timeout: 20_000 });
    await w.page.waitForSelector("#me-title");
    await look(w, "joined");
    const id = await userIdOf(email);
    const [m] = await db.select().from(organizationMembersTable).where(and(eq(organizationMembersTable.ownerId, owner.userId), eq(organizationMembersTable.userId, id)));
    expect(m).toMatchObject({ status: "active", role: "office" });
    expect(await profileOf(id)).toBeNull();
    // Someone joining a company is not welcomed as a new business owner.
    expect(emailsTo(email).some((m) => /Welcome to QuoteAI|Bienvenue sur QuoteAI/.test(m.subject))).toBe(false);
    await done(w);
  }, 240_000);
});
