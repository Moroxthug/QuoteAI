import { Router, type Request, type Response, type NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { db, quotesTable, businessProfilesTable, settingsTable, authUsersTable, emailEventsTable, usageDailySummaryTable } from "@workspace/db";
import { eq, sql, desc, count, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getUncachableStripeClient } from "../stripeClient";
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";
import path from "path";

import { PRICE_TO_PLAN } from "./payments.js";

const router = Router();

export async function isAdmin<P = Record<string, string>>(req: Request<P>): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.admin_email;
  if (!adminEmail) return false;
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return false;
    const cleanEmailStr = adminEmail.replace(/['"]/g, "");
    const emails = cleanEmailStr.split(",").map(e => e.trim().toLowerCase());
    return emails.includes(session.user.email.toLowerCase());
  } catch (err) {
    logger.error({ err }, "isAdmin check failed with exception");
    return false;
  }
}

// Generic over P so req.params doesn't collapse to string | string[] on
// routes that use requireAdmin as middleware before the real handler
// (see the analogous comment on requireAuth in middlewares/authMiddleware.ts).
export async function requireAdmin<P = Record<string, string>>(req: Request<P>, res: Response, next: NextFunction): Promise<void> {
  const ok = await isAdmin(req);
  if (!ok) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.get("/settings/registration", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "registration_open"));
    const isOpen = row ? row.value !== "false" : true;
    res.json({ open: isOpen });
  } catch {
    res.json({ open: true });
  }
});

router.use("/admin", requireAdmin);

router.get("/admin/metrics", async (_req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsersRow,
      subscriptionRows,
      quoteTotalRow,
      quotesThisMonthRow,
      quotesPrevMonthRow,
      usersThisMonthRow,
    ] = await Promise.all([
      db.select({ count: count() }).from(businessProfilesTable),
      db.select({
        plan: businessProfilesTable.subscriptionPlan,
        status: businessProfilesTable.subscriptionStatus,
        cnt: count(),
      })
        .from(businessProfilesTable)
        .groupBy(businessProfilesTable.subscriptionPlan, businessProfilesTable.subscriptionStatus),
      db.select({ total: count(), revenue: sql<string>`COALESCE(SUM(totale::numeric), 0)` }).from(quotesTable),
      db.select({ cnt: count() }).from(quotesTable).where(sql`created_at >= ${monthStart.toISOString()}`),
      db.select({ cnt: count() }).from(quotesTable).where(
        sql`created_at >= ${prevMonthStart.toISOString()} AND created_at < ${monthStart.toISOString()}`
      ),
      db.select({ cnt: count() }).from(businessProfilesTable).where(
        sql`created_at >= ${monthStart.toISOString()}`
      ),
    ]);

    const totalUsers = totalUsersRow[0]?.count ?? 0;
    const totalQuotes = quoteTotalRow[0]?.total ?? 0;
    const totalQuoteRevenue = Number(quoteTotalRow[0]?.revenue ?? 0);
    const quotesThisMonth = quotesThisMonthRow[0]?.cnt ?? 0;
    const quotesPrevMonth = quotesPrevMonthRow[0]?.cnt ?? 0;
    const usersThisMonth = usersThisMonthRow[0]?.cnt ?? 0;

    let starterCount = 0;
    let proCount = 0;
    let activeSubscriptions = 0;
    for (const row of subscriptionRows) {
      if (row.status === "active") {
        activeSubscriptions += Number(row.cnt);
        if (row.plan === "monthly_starter") starterCount += Number(row.cnt);
        if (row.plan === "monthly_pro") proCount += Number(row.cnt);
      }
    }
    const mrr = starterCount * 19 + proCount * 49;

    res.json({
      totalUsers,
      usersThisMonth,
      activeSubscriptions,
      starterCount,
      proCount,
      mrr,
      totalQuotes,
      quotesThisMonth,
      quotesPrevMonth,
      totalQuoteRevenue,
    });
  } catch (err) {
    logger.error({ err }, "Admin metrics error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/users", async (_req, res) => {
  try {
    const profiles = await db
      .select()
      .from(businessProfilesTable)
      .orderBy(desc(businessProfilesTable.createdAt))
      .limit(200);

    const userIds = profiles.map(p => p.userId);
    let authUsers: Record<string, { email: string; name: string }> = {};

    if (userIds.length > 0) {
      try {
        const users = await db
          .select({ id: authUsersTable.id, email: authUsersTable.email, name: authUsersTable.name })
          .from(authUsersTable)
          .where(inArray(authUsersTable.id, userIds));
        for (const u of users) {
          authUsers[u.id] = { email: u.email, name: u.name };
        }
      } catch (dbErr) {
        logger.error({ err: dbErr }, "Failed to fetch auth users (non-fatal)");
      }
    }

    // Fetch stats grouped by userId
    const quoteStats = await db
      .select({
        userId: quotesTable.userId,
        quoteCount: sql<number>`count(${quotesTable.id})::int`,
        totalCost: sql<number>`coalesce(sum(${quotesTable.apiCost}), 0)::float`,
      })
      .from(quotesTable)
      .groupBy(quotesTable.userId);

    const statsMap: Record<string, { quoteCount: number; totalCost: number }> = {};
    for (const stat of quoteStats) {
      statsMap[stat.userId] = {
        quoteCount: stat.quoteCount,
        totalCost: stat.totalCost,
      };
    }

    const rows = profiles.map(p => ({
      userId: p.userId,
      email: authUsers[p.userId]?.email ?? "",
      firstName: authUsers[p.userId]?.name ?? "",
      companyName: p.companyName,
      subscriptionPlan: p.subscriptionPlan ?? null,
      subscriptionStatus: p.subscriptionStatus ?? null,
      stripeCustomerId: p.stripeCustomerId ?? null,
      apiKey: p.apiKey ?? null,
      quoteCount: statsMap[p.userId]?.quoteCount ?? 0,
      totalCost: statsMap[p.userId]?.totalCost ?? 0,
      createdAt: p.createdAt.toISOString(),
    }));

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Admin users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/users/:userId/quotes", async (req, res) => {
  try {
    const { userId } = req.params;
    const userQuotes = await db
      .select({
        id: quotesTable.id,
        titoloRiga1: quotesTable.titoloPreventivoRiga1,
        titoloRiga2: quotesTable.titoloPreventivoRiga2,
        numeroPreventivoData: quotesTable.numeroPreventivoData,
        clientData: quotesTable.clientData,
        totale: quotesTable.totale,
        status: quotesTable.status,
        source: quotesTable.source,
        promptTokens: quotesTable.promptTokens,
        completionTokens: quotesTable.completionTokens,
        totalTokens: quotesTable.totalTokens,
        modelUsed: quotesTable.modelUsed,
        apiCost: quotesTable.apiCost,
        createdAt: quotesTable.createdAt,
      })
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId))
      .orderBy(desc(quotesTable.createdAt));

    res.json(userQuotes);
  } catch (err) {
    logger.error({ err }, "Admin fetch user quotes error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/users/:userId/apikey", async (req, res) => {
  try {
    const { userId } = req.params;
    const { apiKey } = req.body;
    
    let newApiKey = apiKey;
    if (!newApiKey) {
      newApiKey = `quoteai_pk_${crypto.randomBytes(24).toString("hex")}`;
    }

    const [updated] = await db
      .update(businessProfilesTable)
      .set({ apiKey: newApiKey })
      .where(eq(businessProfilesTable.userId, userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Business profile not found for this user." });
      return;
    }

    res.json({ success: true, apiKey: newApiKey });
  } catch (err) {
    logger.error({ err }, "Admin assign API key error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    logger.error({ err }, "Admin settings get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/settings", async (req, res) => {
  try {
    const { key, value } = req.body as { key: string; value: string };
    if (!key || value === undefined) {
      res.status(400).json({ error: "key and value required" });
      return;
    }
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Admin settings post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/grant-plan", async (req, res) => {
  try {
    const { email, plan, days = 365 } = req.body as { email?: string; plan?: string; days?: number };
    if (!email || !plan) {
      res.status(400).json({ error: "email and plan required" });
      return;
    }
    const validPlans = ["monthly_starter", "monthly_pro", "monthly_elite"];
    if (!validPlans.includes(plan)) {
      res.status(400).json({ error: `Invalid plan. Valid values: ${validPlans.join(", ")}` });
      return;
    }
    const [authUser] = await db.select().from(authUsersTable).where(eq(authUsersTable.email, email));
    if (!authUser) {
      res.status(404).json({ error: `No user found with email: ${email}` });
      return;
    }
    const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await db.insert(businessProfilesTable).values({
      userId: authUser.id,
      companyName: "",
      subscriptionPlan: plan,
      subscriptionStatus: "active",
      subscriptionPeriodEnd: periodEnd,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: businessProfilesTable.userId,
      set: {
        subscriptionPlan: plan,
        subscriptionStatus: "active",
        subscriptionPeriodEnd: periodEnd,
        updatedAt: new Date(),
      },
    });
    logger.info({ email, plan, days, userId: authUser.id }, "Admin manually granted plan");
    res.json({ ok: true, email, plan, periodEnd, userId: authUser.id });
  } catch (err) {
    logger.error({ err }, "Admin grant-plan error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/sync-subscription", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "email required" });
      return;
    }

    const stripe = await getUncachableStripeClient();

    // Search Stripe for customers with this email
    const customers = await stripe.customers.list({ email, limit: 5 });
    if (customers.data.length === 0) {
      res.status(404).json({ error: `No Stripe customer found for email: ${email}` });
      return;
    }

    // Find our user by email
    const [authUser] = await db
      .select({ id: authUsersTable.id })
      .from(authUsersTable)
      .where(eq(authUsersTable.email, email));

    if (!authUser) {
      res.status(404).json({ error: `No app user found for email: ${email}` });
      return;
    }

    // Try each Stripe customer (might have multiple), look for active subscription
    let synced: { customerId: string; planType: string; status: string } | null = null;

    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 5 });
      for (const sub of subs.data) {
        const priceId = sub.items.data[0]?.price?.id;
        const planType = priceId ? PRICE_TO_PLAN[priceId] : undefined;
        if (!planType) continue;

        const isActive = sub.status === "active" || sub.status === "trialing";
        await db
          .insert(businessProfilesTable)
          .values({
            userId: authUser.id,
            stripeCustomerId: customer.id,
            subscriptionPlan: isActive ? planType : null,
            subscriptionStatus: isActive ? "active" : sub.status,
          })
          .onConflictDoUpdate({
            target: businessProfilesTable.userId,
            set: {
              stripeCustomerId: customer.id,
              subscriptionPlan: isActive ? planType : null,
              subscriptionStatus: isActive ? "active" : sub.status,
            },
          });

        logger.info({ userId: authUser.id, customerId: customer.id, planType, status: sub.status }, "Admin manual subscription sync");
        synced = { customerId: customer.id, planType, status: sub.status };
        if (isActive) break; // prefer active sub
      }
      if (synced?.status === "active") break;
    }

    if (!synced) {
      res.status(404).json({ error: "No matching subscription found for this customer's price IDs" });
      return;
    }

    res.json({ ok: true, synced });
  } catch (err) {
    logger.error({ err }, "Admin sync-subscription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Force-link a Stripe customer to a quoteai user (useful when emails don't match)
router.post("/admin/sync-by-customer", requireAdmin, async (req, res) => {
  try {
    const { stripeCustomerId, userEmail } = req.body as { stripeCustomerId?: string; userEmail?: string };
    if (!stripeCustomerId || !userEmail) {
      res.status(400).json({ error: "stripeCustomerId and userEmail required" });
      return;
    }

    // Find quoteai user by email
    const [authUser] = await db
      .select({ id: authUsersTable.id })
      .from(authUsersTable)
      .where(eq(authUsersTable.email, userEmail));
    if (!authUser) {
      res.status(404).json({ error: `No app user found for email: ${userEmail}` });
      return;
    }

    const stripe = await getUncachableStripeClient();

    // Fetch subscriptions for this customer from Stripe
    const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 10 });
    const activeSub = subs.data.find(s => s.status === "active" || s.status === "trialing") ?? subs.data[0];

    if (!activeSub) {
      res.status(404).json({ error: `No subscriptions found for customer: ${stripeCustomerId}` });
      return;
    }

    const priceId = activeSub.items.data[0]?.price?.id;
    const planType = priceId ? PRICE_TO_PLAN[priceId] : undefined;
    const isActive = activeSub.status === "active" || activeSub.status === "trialing";

    if (!planType) {
      res.status(400).json({ error: `Unknown price ID: ${priceId} — add to PRICE_TO_PLAN map` });
      return;
    }

    await db
      .insert(businessProfilesTable)
      .values({
        userId: authUser.id,
        stripeCustomerId,
        subscriptionPlan: isActive ? planType : null,
        subscriptionStatus: isActive ? "active" : activeSub.status,
      })
      .onConflictDoUpdate({
        target: businessProfilesTable.userId,
        set: {
          stripeCustomerId,
          subscriptionPlan: isActive ? planType : null,
          subscriptionStatus: isActive ? "active" : activeSub.status,
        },
      });

    logger.info({ userId: authUser.id, stripeCustomerId, planType, status: activeSub.status }, "Admin force-linked customer to user");
    res.json({ ok: true, userId: authUser.id, stripeCustomerId, planType, status: activeSub.status });
  } catch (err) {
    logger.error({ err }, "Admin sync-by-customer error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/quote-stats", async (_req, res) => {
  try {
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);

    const dailyRows = await db.execute(
      sql`SELECT DATE(created_at AT TIME ZONE 'Europe/Rome') as day, COUNT(*)::int as cnt
          FROM quotes
          WHERE created_at >= ${last30.toISOString()}
          GROUP BY day
          ORDER BY day ASC`
    );

    res.json({ daily: dailyRows.rows });
  } catch (err) {
    logger.error({ err }, "Admin quote stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Real SEO Audit Engine Helpers ---
async function getPageHtml(pageUrl: string, reqOrigin: string): Promise<string> {
  const pathsToTry = [
    path.join(process.cwd(), "artifacts/quote-ai/dist/public", pageUrl === "/" ? "index.html" : `${pageUrl.replace(/\/$/, "")}/index.html`),
    path.join(process.cwd(), "../quote-ai/dist/public", pageUrl === "/" ? "index.html" : `${pageUrl.replace(/\/$/, "")}/index.html`),
    path.join(process.cwd(), "dist/public", pageUrl === "/" ? "index.html" : `${pageUrl.replace(/\/$/, "")}/index.html`),
    path.join(process.cwd(), "public", pageUrl === "/" ? "index.html" : `${pageUrl.replace(/\/$/, "")}/index.html`),
  ];

  for (const p of pathsToTry) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf-8");
      } catch (e) {
        logger.error({ err: e, path: p }, "Failed to read local file");
      }
    }
  }

  // Fallback to HTTP fetch
  const fullUrl = `${reqOrigin}${pageUrl}`;
  try {
    const res = await fetch(fullUrl);
    if (res.ok) {
      return await res.text();
    }
  } catch (err) {
    logger.warn({ err, fullUrl }, "Failed to fetch page HTML via HTTP fallback");
  }

  throw new Error(`Page HTML not found locally or via HTTP for path: ${pageUrl}`);
}

function parseHtmlSeo(html: string) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : "";

  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1 = h1Matches.length > 0 ? h1Matches[0][1].replace(/<[^>]*>/g, "").trim() : "";

  const imgTags = [...html.matchAll(/<img\s+([\s\S]*?)>/gi)];
  let missingAlt = 0;
  for (const tag of imgTags) {
    const attrs = tag[1];
    if (!/alt=["']/i.test(attrs) || /alt=["']\s*["']/i.test(attrs)) {
      missingAlt++;
    }
  }

  const ogTitle = (html.match(/<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || "";
  const ogImage = (html.match(/<meta\s+property=["']og:image["']\s+content=["']([\s\S]*?)["']/i) || [])[1] || "";

  let score = 100;
  const issues: string[] = [];

  if (!title) {
    score -= 20;
    issues.push("Missing <title> tag");
  } else if (title.length < 30 || title.length > 65) {
    score -= 10;
    issues.push(`Suboptimal title length (${title.length} characters). Recommended 30-65.`);
  }

  if (!description) {
    score -= 20;
    issues.push("Missing meta description");
  } else if (description.length < 120 || description.length > 160) {
    score -= 10;
    issues.push(`Suboptimal description length (${description.length} characters). Recommended 120-160.`);
  }

  if (h1Matches.length === 0) {
    score -= 15;
    issues.push("Missing <h1> tag");
  } else if (h1Matches.length > 1) {
    score -= 10;
    issues.push(`Multiple <h1> tags detected (${h1Matches.length}). Only one is recommended.`);
  }

  if (missingAlt > 0) {
    score -= Math.min(15, missingAlt * 3);
    issues.push(`${missingAlt} images missing an 'alt' attribute`);
  }

  if (!ogTitle || !ogImage) {
    score -= 5;
    issues.push("Incomplete or missing OpenGraph tags for social media");
  }

  return {
    title,
    description,
    h1,
    score: Math.max(0, score),
    issues,
  };
}

router.get("/admin/seo-audit", async (req, res) => {
  try {
    const auditPages = [
      { url: "/", name: "Homepage" },
      { url: "/blog", name: "Blog Index" },
      { url: "/preventivi/imbianchino", name: "Land. Painters" },
      { url: "/preventivi/elettricista", name: "Land. Electricians" },
      { url: "/preventivi/idraulico", name: "Land. Plumbers" },
      { url: "/preventivi/muratore", name: "Land. General Contractors" },
      { url: "/preventivi/ristrutturazione/roma", name: "Roma Renovations" },
      { url: "/preventivi/ristrutturazione/milano", name: "Milano Renovations" },
    ];

    const origin = `${req.protocol}://${req.headers.host}`;
    const results = await Promise.all(
      auditPages.map(async (page) => {
        try {
          const html = await getPageHtml(page.url, origin);
          const seo = parseHtmlSeo(html);
          return {
            url: page.url,
            name: page.name,
            ...seo,
          };
        } catch (e: any) {
          return {
            url: page.url,
            name: page.name,
            score: 0,
            title: "Read error",
            description: "",
            h1: "",
            issues: [`Unable to read the page: ${e.message}`],
          };
        }
      })
    );

    res.json({
      overallScore: Math.round(results.reduce((acc, curr) => acc + curr.score, 0) / results.length),
      pages: results,
      lastChecked: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Admin SEO audit error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Real Google Search Console Auth & Query helpers ---
function signGoogleJwt(clientEmail: string, privateKey: string, keyId: string): string {
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: keyId,
  };
  const base64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signatureInput = `${base64Header}.${base64Payload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signatureInput);
  const signature = signer.sign(privateKey, "base64url");
  return `${signatureInput}.${signature}`;
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const jwt = signGoogleJwt(sa.client_email, sa.private_key, sa.private_key_id);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth error: ${res.status} - ${errText}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

router.get("/admin/search-console", async (req, res) => {
  let gscKey = process.env.GSC_SERVICE_ACCOUNT_KEY;
  const siteUrl = process.env.GSC_SITE_URL || "https://quoteai.ca/";

  if (!gscKey) {
    const possiblePaths = [
      path.join(process.cwd(), "artifacts", "quote-ai", "scripts", "google-indexing-key.json"),
      path.join(process.cwd(), "..", "quote-ai", "scripts", "google-indexing-key.json"),
      path.join(process.cwd(), "scripts", "google-indexing-key.json"),
      path.join(process.cwd(), "google-indexing-key.json"),
      "/var/task/artifacts/quote-ai/scripts/google-indexing-key.json",
      "/var/task/quote-ai/scripts/google-indexing-key.json",
      path.join(process.cwd(), "artifacts/quote-ai/scripts/google-indexing-key.json")
    ];
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        try {
          const content = readFileSync(p, "utf8");
          const parsed = JSON.parse(content);
          if (parsed.type === "service_account" && parsed.private_key) {
            gscKey = content;
            break;
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  try {
    if (!gscKey) {
      // Fallback fallback simulated dashboard if variables are not yet configured on Vercel
      const keywords = [
        { query: "plumber quote toronto (Demo)", clicks: 342, impressions: 4500, ctr: 0.076, position: 2.1 },
        { query: "quote template excel (Demo)", clicks: 289, impressions: 5800, ctr: 0.049, position: 3.4 },
        { query: "create quote pdf (Demo)", clicks: 210, impressions: 3200, ctr: 0.065, position: 1.8 },
        { query: "electrician quote vancouver (Demo)", clicks: 195, impressions: 2900, ctr: 0.067, position: 2.5 },
        { query: "contractor quote template (Demo)", clicks: 140, impressions: 2100, ctr: 0.066, position: 3.0 },
      ];

      const clicks = keywords.reduce((sum, k) => sum + k.clicks, 0);
      const impressions = keywords.reduce((sum, k) => sum + k.impressions, 0);
      const ctr = clicks / impressions;
      const position = keywords.reduce((sum, k) => sum + k.position * k.impressions, 0) / impressions;

      const trends = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        trends.push({
          day: d.toISOString().slice(0, 10),
          clicks: Math.round(15 + Math.random() * 25),
          impressions: Math.round(300 + Math.random() * 200),
        });
      }

      res.json({
        isDemo: true,
        summary: {
          totalClicks: clicks,
          totalImpressions: impressions,
          averageCtr: Number(ctr.toFixed(4)),
          averagePosition: Number(position.toFixed(1)),
        },
        keywords,
        trends,
      });
      return;
    }

    const token = await getGoogleAccessToken(gscKey);
    const apiEndpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const apiResponse = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: thirtyDaysAgo,
        endDate: yesterday,
        dimensions: ["query", "date"],
        rowLimit: 5000,
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      throw new Error(`Google Search Console API responded with status ${apiResponse.status}: ${errText}`);
    }

    const data = await apiResponse.json() as { rows?: any[] };
    const rows = data.rows || [];

    if (rows.length === 0) {
      res.json({
        isDemo: false,
        summary: { totalClicks: 0, totalImpressions: 0, averageCtr: 0, averagePosition: 0 },
        keywords: [],
        trends: [],
      });
      return;
    }

    // Process GSC response
    const keywordMap = new Map<string, { clicks: number; impressions: number; posSum: number; count: number }>();
    const trendMap = new Map<string, { clicks: number; impressions: number }>();

    let totalClicks = 0;
    let totalImpressions = 0;
    let weightedPositionSum = 0;

    for (const r of rows) {
      const query = r.keys[0];
      const date = r.keys[1];
      const clicks = r.clicks || 0;
      const impressions = r.impressions || 0;
      const position = r.position || 0;

      totalClicks += clicks;
      totalImpressions += impressions;
      weightedPositionSum += position * impressions;

      // Group by query
      const kw = keywordMap.get(query) || { clicks: 0, impressions: 0, posSum: 0, count: 0 };
      kw.clicks += clicks;
      kw.impressions += impressions;
      kw.posSum += position;
      kw.count += 1;
      keywordMap.set(query, kw);

      // Group by date
      const tr = trendMap.get(date) || { clicks: 0, impressions: 0 };
      tr.clicks += clicks;
      tr.impressions += impressions;
      trendMap.set(date, tr);
    }

    const keywords = Array.from(keywordMap.entries()).map(([query, d]) => {
      const ctr = d.impressions > 0 ? d.clicks / d.impressions : 0;
      return {
        query,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: Number(ctr.toFixed(4)),
        position: Number((d.posSum / d.count).toFixed(1)),
      };
    }).sort((a, b) => b.clicks - a.clicks).slice(0, 100);

    const trends = Array.from(trendMap.entries()).map(([day, d]) => ({
      day,
      clicks: d.clicks,
      impressions: d.impressions,
    })).sort((a, b) => a.day.localeCompare(b.day));

    const averageCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const averagePosition = totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0;

    res.json({
      isDemo: false,
      summary: {
        totalClicks,
        totalImpressions,
        averageCtr: Number(averageCtr.toFixed(4)),
        averagePosition: Number(averagePosition.toFixed(1)),
      },
      keywords,
      trends,
    });
  } catch (err) {
    logger.error({ err }, "Admin Search Console error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/widget/stats - Global and per-client widget usage statistics
router.get("/admin/widget/stats", async (_req, res) => {
  try {
    // 1. Global widget metrics
    const [globalStats] = await db
      .select({
        totalQuotes: count(),
        totalCost: sql<string>`COALESCE(SUM(prompt_tokens * 0.00000015 + completion_tokens * 0.00000060), 0)`, // Estimated Groq Llama 3.3 cost
        totalTokens: sql<string>`COALESCE(SUM(prompt_tokens + completion_tokens), 0)`,
      })
      .from(quotesTable)
      .where(eq(quotesTable.source, "widget"));

    // 2. Statistics per client/company
    const clientUsageRows = await db
      .select({
        userId: businessProfilesTable.userId,
        companyName: businessProfilesTable.companyName,
        apiKey: businessProfilesTable.apiKey,
        quotesCount: count(quotesTable.id),
        totalTokens: sql<string>`COALESCE(SUM(quotes.prompt_tokens + quotes.completion_tokens), 0)`,
        totalCost: sql<string>`COALESCE(SUM(quotes.prompt_tokens * 0.00000015 + quotes.completion_tokens * 0.00000060), 0)`,
      })
      .from(businessProfilesTable)
      .leftJoin(quotesTable, sql`quotes.user_id = business_profiles.user_id AND quotes.source = 'widget'`)
      .groupBy(
        businessProfilesTable.userId,
        businessProfilesTable.companyName,
        businessProfilesTable.apiKey
      )
      .orderBy(desc(count(quotesTable.id)));

    // 3. Most recent calls made by widgets
    const recentCalls = await db
      .select({
        quoteId: quotesTable.id,
        userId: quotesTable.userId,
        clientName: sql<string>`quotes.client_data->>'nome'`,
        clientEmail: sql<string>`quotes.client_data->>'email'`,
        companyName: businessProfilesTable.companyName,
        date: quotesTable.createdAt,
        modelUsed: quotesTable.modelUsed,
        apiCost: sql<string>`(quotes.prompt_tokens * 0.00000015 + quotes.completion_tokens * 0.00000060)`,
        totalTokens: sql<number>`(quotes.prompt_tokens + quotes.completion_tokens)`,
        status: quotesTable.status,
      })
      .from(quotesTable)
      .leftJoin(businessProfilesTable, eq(quotesTable.userId, businessProfilesTable.userId))
      .where(eq(quotesTable.source, "widget"))
      .orderBy(desc(quotesTable.createdAt))
      .limit(50);

    res.json({
      success: true,
      global: {
        totalQuotes: globalStats?.totalQuotes ?? 0,
        totalCost: Number(globalStats?.totalCost ?? 0),
        totalTokens: Number(globalStats?.totalTokens ?? 0),
      },
      clientUsage: clientUsageRows.map(row => ({
        ...row,
        quotesCount: Number(row.quotesCount),
        totalTokens: Number(row.totalTokens),
        totalCost: Number(row.totalCost),
      })),
      recentCalls,
    });
  } catch (err) {
    logger.error({ err }, "Admin widget stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/widget/create-client - Creates a virtual (unregistered) client/company and assigns an API key
router.post("/admin/widget/create-client", async (req, res) => {
  try {
    const { companyName, email, phone, address, vatNumber } = req.body;
    if (!companyName || !companyName.trim()) {
      res.status(400).json({ error: "Company name is required." });
      return;
    }
    const tempUserId = `temp_widget_${crypto.randomBytes(12).toString("hex")}`;
    const apiKey = `quoteai_pk_${crypto.randomBytes(24).toString("hex")}`;

    const [profile] = await db
      .insert(businessProfilesTable)
      .values({
        userId: tempUserId,
        companyName: companyName.trim(),
        email: email ? String(email).trim() : undefined,
        phone: phone ? String(phone).trim() : undefined,
        address: address ? String(address).trim() : undefined,
        vatNumber: vatNumber ? String(vatNumber).trim() : undefined,
        apiKey,
      })
      .returning();

    res.status(201).json({ success: true, profile });
  } catch (err) {
    logger.error({ err }, "Error creating unregistered widget client");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/margin — per-org AI/WhatsApp cost vs. subscription revenue
// (Phase 8 §4a). Cost comes from usage_daily_summary (rolled up nightly by
// the cron tick); revenue is the plan's flat monthly price as a proxy for
// what the account pays — flags accounts running at a loss before it's a
// pattern, so pricing/allowances (plans.ts MONTHLY_USAGE_ALLOWANCE) can be
// corrected.
const PLAN_MONTHLY_PRICE_CAD: Record<string, number> = {
  monthly_starter: 19,
  monthly_pro: 49,
  monthly_elite: 59,
};

router.get("/admin/margin", async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const costRows = await db
      .select({
        userId: usageDailySummaryTable.userId,
        kind: usageDailySummaryTable.kind,
        costCents: sql<string>`SUM(${usageDailySummaryTable.costCents})`,
        quantity: sql<string>`SUM(${usageDailySummaryTable.quantity})`,
      })
      .from(usageDailySummaryTable)
      .where(sql`${usageDailySummaryTable.date} >= ${since}`)
      .groupBy(usageDailySummaryTable.userId, usageDailySummaryTable.kind);

    const byUser = new Map<string, { costCentsTotal: number; byKind: Record<string, { costCents: number; quantity: number }> }>();
    for (const row of costRows) {
      const entry = byUser.get(row.userId) ?? { costCentsTotal: 0, byKind: {} };
      const costCents = Number(row.costCents);
      entry.byKind[row.kind] = { costCents, quantity: Number(row.quantity) };
      entry.costCentsTotal += costCents;
      byUser.set(row.userId, entry);
    }

    const userIds = [...byUser.keys()];
    const profiles = userIds.length
      ? await db
          .select({ userId: businessProfilesTable.userId, companyName: businessProfilesTable.companyName, subscriptionPlan: businessProfilesTable.subscriptionPlan, subscriptionStatus: businessProfilesTable.subscriptionStatus })
          .from(businessProfilesTable)
          .where(inArray(businessProfilesTable.userId, userIds))
      : [];
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

    const rows = userIds
      .map((userId) => {
        const entry = byUser.get(userId)!;
        const profile = profileByUser.get(userId);
        const plan = profile?.subscriptionStatus === "active" ? (profile?.subscriptionPlan ?? null) : null;
        const revenueCents = (plan ? PLAN_MONTHLY_PRICE_CAD[plan] ?? 0 : 0) * 100;
        return {
          userId,
          companyName: profile?.companyName ?? null,
          plan,
          costCents: entry.costCentsTotal,
          revenueCents,
          marginCents: revenueCents - entry.costCentsTotal,
          byKind: entry.byKind,
        };
      })
      .sort((a, b) => a.marginCents - b.marginCents);

    res.json({ days, rows });
  } catch (err) {
    logger.error({ err }, "Admin margin error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/email-events - History of Resend events (delivery/bounce/complaint)
// persisted by the webhook in app.ts, so we can tell from here when a
// partner's email stops receiving lead notifications instead of having to read the logs.
router.get("/admin/email-events", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const events = await db
      .select()
      .from(emailEventsTable)
      .orderBy(desc(emailEventsTable.createdAt))
      .limit(limit);
    res.json({ success: true, count: events.length, events });
  } catch (err) {
    logger.error({ err }, "Error fetching email events");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
