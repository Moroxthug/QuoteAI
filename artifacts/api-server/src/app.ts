import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import multer from "multer";
import { db, quotesTable, businessProfilesTable, authUsersTable, emailEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { auth, getTrustedOrigins } from "./lib/auth";
import { PRICE_TO_PLAN, PLANS } from "./routes/payments.js";
import { isBillingInterval, planItemOf, resolvePrice, yearlyPriceFor } from "./lib/billing.js";
import { subscriptionChanged } from "./groups/service.js";
import { sendSubscriptionEmail } from "./lib/email";
import router from "./routes";
import "./automations";
import { logger } from "./lib/logger";
import { ipRateLimiter } from "./lib/rateLimit";
import { captureException, flush, installProcessHandlers, requestContext } from "./lib/errorTracking";

// Phase 69: report unhandled rejections / uncaught exceptions before the
// process (or the Vercel instance) goes down with them.
installProcessHandlers();

// Brute-force protection on credential-guessing endpoints. Keyed by IP (pre-auth,
// there's no user identity yet). Each action gets its OWN budget — sharing one
// bucket across sign-in/2FA/password-reset meant a handful of legitimate retries
// on one could silently starve the others, and the failure looked exactly like
// "invalid credentials" or "error sending" on the frontend instead of a clear
// rate-limit message.
const signInRateLimiter = ipRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many sign-in attempts. Please wait a few minutes and try again.",
});
const twoFactorRateLimiter = ipRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many verification attempts. Please wait a few minutes and try again.",
});
const passwordResetRateLimiter = ipRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password reset requests. Please wait a few minutes and try again.",
});
// Anything that sends an email on request (sign-up welcome/verification,
// re-send verification, 2FA email OTP) is an email-bombing vector as well as
// an enumeration one, so it gets the same tight budget as password reset.
const emailSendingRateLimiter = ipRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many requests. Please wait a few minutes and try again.",
});
// Phase 64: better-auth's own limiter only runs in production (per instance);
// these are ours and run everywhere, keyed on the exact paths the client
// calls. `/forget-password` was renamed `/request-password-reset` upstream —
// the frontend calls the new name, so the old key alone protected nothing.
const AUTH_RATE_LIMITERS: Record<string, ReturnType<typeof ipRateLimiter>> = {
  "/api/auth/sign-in/email": signInRateLimiter,
  "/api/auth/sign-up/email": emailSendingRateLimiter,
  "/api/auth/send-verification-email": emailSendingRateLimiter,
  "/api/auth/two-factor/send-otp": emailSendingRateLimiter,
  "/api/auth/two-factor/verify-totp": twoFactorRateLimiter,
  "/api/auth/two-factor/verify-backup-code": twoFactorRateLimiter,
  "/api/auth/two-factor/verify-otp": twoFactorRateLimiter,
  "/api/auth/two-factor/enable": twoFactorRateLimiter,
  "/api/auth/two-factor/disable": twoFactorRateLimiter,
  "/api/auth/forget-password": passwordResetRateLimiter,
  "/api/auth/request-password-reset": passwordResetRateLimiter,
  "/api/auth/reset-password": passwordResetRateLimiter,
  "/api/auth/change-password": passwordResetRateLimiter,
};

const app: Express = express();

// Vercel terminates TLS and proxies requests — without this, req.ip resolves
// to Vercel's edge IP for every request, breaking both IP-based rate limiting
// and abuse-investigation logging (all visitors would look identical).
app.set("trust proxy", 1);

// ── Security headers (Phase 64) ──────────────────────────────────────────────
// The static frontend gets its headers (incl. the page CSP) from vercel.json;
// this covers every /api response, which Vercel serves from the function and
// never touches. A JSON/PDF API needs no page CSP — it needs to never be
// framed, never be sniffed into another type, and never leak a token link
// (/api/i/:token, /api/sign/:token) through Referer.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Better Auth handler — must be before express.json() ──────────────────────
// Use raw middleware to avoid Express 5 wildcard syntax issues
app.use((req, res, next): void => {
  if (req.url?.startsWith("/api/auth/") || req.url === "/api/auth") {
    const pathOnly = req.url.split("?")[0];
    const limiter = AUTH_RATE_LIMITERS[pathOnly];
    if (limiter) {
      limiter(req, res, (err?: unknown) => {
        if (err) { next(err); return; }
        void toNodeHandler(auth)(req, res);
      });
      return;
    }
    void toNodeHandler(auth)(req, res);
    return;
  }
  next();
});

// ── Stripe webhook MUST be registered before express.json() ──────────────────
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("STRIPE_WEBHOOK_SECRET not set — cannot verify webhook signature");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    let event: {
      type: string;
      data: {
        object: {
          metadata?: Record<string, string>;
          payment_status?: string;
          customer?: string;
          mode?: string;
          status?: string;
          current_period_end?: number;
          plan?: { id?: string };
          items?: { data?: { price?: { id?: string } }[] };
        };
      };
    };

    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret) as typeof event;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: `Webhook signature error: ${message}` });
      return;
    }



    // Shared helper: upsert subscription in DB, resolving user by customerId or email
    async function syncSubscription(customerId: string, priceId: string | undefined, status: string) {
      // Phase 73: yearly price ids resolve to the same tier with interval "year".
      const resolved = resolvePrice(priceId, PRICE_TO_PLAN);
      const planType = resolved?.tier;
      if (!planType || !resolved) {
        logger.warn({ customerId, priceId }, "Unknown price ID in subscription sync — skipping");
        return null;
      }
      const isActive = status === "active" || status === "trialing";

      // 1. Look up by stripeCustomerId already in DB
      const [existing] = await db
        .select({ userId: businessProfilesTable.userId })
        .from(businessProfilesTable)
        .where(eq(businessProfilesTable.stripeCustomerId, customerId));

      let userId = existing?.userId;

      // 2. Fallback: fetch customer from Stripe and look up by email
      if (!userId) {
        try {
          const { getUncachableStripeClient } = await import("./stripeClient");
          const stripe = await getUncachableStripeClient();
          const customer = await stripe.customers.retrieve(customerId);
          if (!customer.deleted && customer.email) {
            const [authUser] = await db
              .select({ id: authUsersTable.id })
              .from(authUsersTable)
              .where(eq(authUsersTable.email, customer.email));
            userId = authUser?.id;
          }
        } catch (fetchErr) {
          logger.error({ err: fetchErr }, "Failed to fetch Stripe customer for email lookup");
        }
      }

      if (!userId) {
        logger.warn({ customerId }, "Cannot resolve user for Stripe customer — skipping");
        return null;
      }

      await db
        .insert(businessProfilesTable)
        .values({
          userId,
          stripeCustomerId: customerId,
          subscriptionPlan: isActive ? planType : null,
          subscriptionStatus: isActive ? "active" : "cancelled",
          subscriptionInterval: isActive ? resolved.interval : null,
        })
        .onConflictDoUpdate({
          target: businessProfilesTable.userId,
          set: {
            stripeCustomerId: customerId,
            subscriptionPlan: isActive ? planType : null,
            subscriptionStatus: isActive ? "active" : "cancelled",
            subscriptionInterval: isActive ? resolved.interval : null,
          },
        });

      logger.info({ userId, customerId, planType, status }, "Subscription synced to DB");
      // Phase 90: a paying group company's covered companies follow it; a covered company that now pays for itself leaves the group bill.
      await subscriptionChanged(userId, isActive);
      return { userId, planType, isActive };
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const quoteId = session.metadata?.quoteId;
        const userId = session.metadata?.userId;
        const planType = session.metadata?.planType;

        if (quoteId) {
          await db
            .update(quotesTable)
            .set({ status: "unlocked", unlockedWithPlan: planType ?? null })
            .where(eq(quotesTable.id, quoteId));
          logger.info({ quoteId, planType }, "Quote unlocked via webhook");
        }

        if (userId && session.customer && session.mode === "subscription" && planType) {
          const customerId = session.customer as string;
          const interval = isBillingInterval(session.metadata?.interval) ? session.metadata.interval : "month";
          await db
            .insert(businessProfilesTable)
            .values({
              userId,
              stripeCustomerId: customerId,
              subscriptionPlan: planType,
              subscriptionStatus: "active",
              subscriptionInterval: interval,
            })
            .onConflictDoUpdate({
              target: businessProfilesTable.userId,
              set: {
                stripeCustomerId: customerId,
                subscriptionPlan: planType,
                subscriptionStatus: "active",
                subscriptionInterval: interval,
              },
            });
          logger.info({ userId, planType }, "Subscription activated via checkout webhook");
          await db.update(businessProfilesTable).set({ planCoveredBy: null }).where(eq(businessProfilesTable.userId, userId));
          await subscriptionChanged(userId, true);

          try {
            const [authUser] = await db
              .select({ email: authUsersTable.email, name: authUsersTable.name })
              .from(authUsersTable)
              .where(eq(authUsersTable.id, userId));

            const email = authUser?.email;
            const name = authUser?.name || "Customer";

            if (email) {
              const info = PLANS.find((p) => p.id === planType && p.interval);
              if (info) {
                await sendSubscriptionEmail({
                  toEmail: email,
                  toName: name,
                  planName: info.name,
                  planPrice: interval === "year" ? yearlyPriceFor(info.price) : info.price,
                  planInterval: interval,
                });
              }
            }
          } catch (emailErr) {
            logger.error({ err: emailErr }, "Failed to send subscription email (non-fatal)");
          }
        }
      }

      // ── Handle subscription created/updated (e.g. Stripe dashboard, portal) ──
      if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
        const sub = event.data.object;
        const customerId = sub.customer as string;
        const priceId = planItemOf(sub.items?.data ?? [])?.price?.id;
        const status = sub.status ?? "";
        if (customerId) {
          await syncSubscription(customerId, priceId, status);
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object;
        if (sub.customer) {
          await db
            .update(businessProfilesTable)
            .set({ subscriptionStatus: "cancelled", subscriptionPlan: null, subscriptionInterval: null })
            .where(eq(businessProfilesTable.stripeCustomerId, sub.customer as string));
          const [cancelled] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.stripeCustomerId, sub.customer as string));
          if (cancelled) await subscriptionChanged(cancelled.userId, false, { ended: true });
          logger.info({ customer: sub.customer }, "Subscription cancelled via webhook");
        }
      }
    } catch (bizErr) {
      logger.error({ err: bizErr }, "Webhook business logic error (non-fatal)");
    }

    res.status(200).json({ received: true });
  }
);
// ─────────────────────────────────────────────────────────────────────────────

// ── Stripe Connect webhook (Phase 15: invoice card payments) ─────────────────
// Separate endpoint/secret from the platform webhook above: Connect events
// (checkout sessions and account updates on a connected account) are a
// distinct event stream in the Stripe Dashboard, not forwarded to the
// platform endpoint.
app.post(
  "/api/payments/connect-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) { res.status(400).json({ error: "Missing stripe-signature header" }); return; }
    const sig = Array.isArray(signature) ? signature[0] : signature;

    const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("STRIPE_CONNECT_WEBHOOK_SECRET not set — cannot verify Connect webhook signature");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    let event: {
      type: string;
      account?: string;
      data: { object: { id?: string; metadata?: Record<string, string>; amount_total?: number; payment_status?: string; charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean } };
    };

    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret) as typeof event;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "Stripe Connect webhook signature verification failed");
      res.status(400).json({ error: `Webhook signature error: ${message}` });
      return;
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const invoiceId = session.metadata?.invoiceId;
        if (invoiceId && session.payment_status === "paid" && typeof session.amount_total === "number") {
          const { db: database, invoicesTable: invTable, invoicePaymentsTable: payTable } = await import("@workspace/db");
          const { eq: eqOp } = await import("drizzle-orm");
          const [inv] = await database.select().from(invTable).where(eqOp(invTable.id, invoiceId));
          if (inv) {
            // Idempotent: a webhook retry must not double-record the same Checkout Session.
            const [already] = await database.select().from(payTable).where(eqOp(payTable.reference, session.id ?? ""));
            if (!already) {
              const { recordPayment } = await import("./invoices/service");
              await recordPayment({ invoiceId: inv.id, userId: inv.userId, amountCents: session.amount_total, method: "card", reference: session.id ?? "", sendReceipt: true });
              logger.info({ invoiceId, sessionId: session.id }, "Invoice paid by card via Stripe Connect");
            }
          }
        }
      }

      if (event.type === "account.updated" && event.account) {
        const { syncConnectAccountStatus } = await import("./invoices/stripeConnect");
        await syncConnectAccountStatus(event.account);
      }
    } catch (bizErr) {
      logger.error({ err: bizErr }, "Stripe Connect webhook business logic error (non-fatal)");
    }

    res.status(200).json({ received: true });
  }
);
// ─────────────────────────────────────────────────────────────────────────────

// ── Financeit webhook (Phase 16: point-of-sale financing) ────────────────────
// Best-effort delivery, no auto-retry per Financeit's docs. Verified against a
// shared secret (FINANCEIT_WEBHOOK_SECRET, provisioned alongside partner API
// access) rather than a signature scheme — revisit once the exact webhook
// authentication Financeit issues is in hand.
app.post(
  "/api/webhooks/financeit",
  express.json(),
  async (req: Request, res: Response): Promise<void> => {
    const webhookSecret = process.env.FINANCEIT_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("FINANCEIT_WEBHOOK_SECRET not set — rejecting Financeit webhook POST to prevent spoofing");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }
    const tokenHeader = req.headers["x-financeit-webhook-token"];
    const tokenStr = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (!tokenStr) {
      res.status(400).json({ error: "Missing x-financeit-webhook-token header" });
      return;
    }
    const { timingSafeEqual } = await import("node:crypto");
    const provided = Buffer.from(tokenStr);
    const expected = Buffer.from(webhookSecret);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      res.status(401).json({ error: "Invalid webhook token" });
      return;
    }

    const body = req.body as { event_type?: string; application_id?: string; loan_state?: string; [k: string]: unknown };
    const eventType = body.event_type === "funds_released" ? "funds_released" : "loan_state_event";

    try {
      if (body.application_id) {
        const { getFinanceitApplicationByFinanceitId, recordFinanceitLoanEvent } = await import("./financeit/service");
        const application = await getFinanceitApplicationByFinanceitId(body.application_id);
        if (application) {
          await recordFinanceitLoanEvent({
            applicationId: application.id,
            eventType,
            loanState: typeof body.loan_state === "string" ? body.loan_state : null,
            raw: body,
          });
        } else {
          logger.warn({ applicationId: body.application_id }, "Financeit webhook: no matching application found");
        }
      }
    } catch (bizErr) {
      logger.error({ err: bizErr }, "Financeit webhook business logic error (non-fatal)");
    }

    res.status(200).json({ received: true });
  }
);
// ─────────────────────────────────────────────────────────────────────────────

// ── WhatsApp webhook — verify Meta HMAC signature before express.json() ───────
app.post(
  "/api/whatsapp/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      logger.error("WHATSAPP_APP_SECRET not set — rejecting WhatsApp webhook POST to prevent spoofing");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }
    {
      const sigHeader = req.headers["x-hub-signature-256"];
      const sigStr = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      if (!sigStr) {
        res.status(400).json({ error: "Missing x-hub-signature-256 header" });
        return;
      }
      const { createHmac, timingSafeEqual } = await import("node:crypto");
      const hmac = createHmac("sha256", appSecret).update(req.body as Buffer).digest("hex");
      const expected = Buffer.from(`sha256=${hmac}`);
      const actual = Buffer.from(sigStr);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        logger.error("WhatsApp webhook signature mismatch — request rejected");
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    try {
      req.body = JSON.parse((req.body as Buffer).toString("utf-8")) as unknown;
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }
    next();
  }
);
// ─────────────────────────────────────────────────────────────────────────────

// ── Meta Lead Ads webhook — verify HMAC signature before express.json() ──────
// Same handshake as the WhatsApp webhook above (both are Meta Graph API
// webhooks): a `leadgen` field-change notification on a Page, signed with the
// app secret rather than a per-connection secret.
app.post(
  "/api/meta-lead-ads/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      logger.error("META_APP_SECRET not set — rejecting Meta Lead Ads webhook POST to prevent spoofing");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }
    {
      const sigHeader = req.headers["x-hub-signature-256"];
      const sigStr = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      if (!sigStr) {
        res.status(400).json({ error: "Missing x-hub-signature-256 header" });
        return;
      }
      const { createHmac, timingSafeEqual } = await import("node:crypto");
      const hmac = createHmac("sha256", appSecret).update(req.body as Buffer).digest("hex");
      const expected = Buffer.from(`sha256=${hmac}`);
      const actual = Buffer.from(sigStr);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        logger.error("Meta Lead Ads webhook signature mismatch — request rejected");
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    try {
      req.body = JSON.parse((req.body as Buffer).toString("utf-8")) as unknown;
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }
    next();
  }
);
// ─────────────────────────────────────────────────────────────────────────────

// ── Resend webhook — email delivery/bounce/complaint events ─────────────────
// Verifies the signature per the Svix standard used by Resend:
// signed content = "{svix-id}.{svix-timestamp}.{raw body}", HMAC-SHA256 with
// the RESEND_WEBHOOK_SECRET secret (format "whsec_<base64>").
app.post(
  "/api/webhooks/resend",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response): Promise<void> => {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("RESEND_WEBHOOK_SECRET not set — rejecting Resend webhook POST to prevent spoofing");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    const svixId = req.headers["svix-id"];
    const svixTimestamp = req.headers["svix-timestamp"];
    const svixSignature = req.headers["svix-signature"];
    const idStr = Array.isArray(svixId) ? svixId[0] : svixId;
    const tsStr = Array.isArray(svixTimestamp) ? svixTimestamp[0] : svixTimestamp;
    const sigStr = Array.isArray(svixSignature) ? svixSignature[0] : svixSignature;

    if (!idStr || !tsStr || !sigStr) {
      res.status(400).json({ error: "Missing svix-id, svix-timestamp or svix-signature header" });
      return;
    }

    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const rawBody = req.body as Buffer;
    const signedContent = `${idStr}.${tsStr}.${rawBody.toString("utf-8")}`;
    const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ""), "base64");
    const expectedSig = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

    // svix-signature contains one or more space-separated signatures, e.g. "v1,<base64> v1,<base64>"
    const providedSigs = sigStr.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
    const expectedBuf = Buffer.from(expectedSig, "base64");
    const isValid = providedSigs.some((sig) => {
      const providedBuf = Buffer.from(sig, "base64");
      return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
    });

    if (!isValid) {
      logger.error("Resend webhook signature mismatch — request rejected");
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    let event: { type?: string; data?: Record<string, unknown> };
    try {
      event = JSON.parse(rawBody.toString("utf-8")) as typeof event;
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    const eventData = {
      type: event.type,
      emailId: event.data?.email_id,
      to: event.data?.to,
      from: event.data?.from,
      subject: event.data?.subject,
    };

    if (event.type === "email.bounced" || event.type === "email.complained") {
      // Important signals: a partner's email address is no longer receiving
      // lead notifications from the widget. Persisted in email_events so the admin
      // can see them over time instead of having to check the server logs.
      logger.warn(eventData, `Resend: ${event.type}`);
    } else {
      logger.info(eventData, `Resend: ${event.type ?? "evento sconosciuto"}`);
    }

    try {
      await db.insert(emailEventsTable).values({
        type: event.type || "sconosciuto",
        emailId: typeof event.data?.email_id === "string" ? event.data.email_id : null,
        to: Array.isArray(event.data?.to) ? (event.data.to as string[]) : (event.data?.to ? [String(event.data.to)] : null),
        from: typeof event.data?.from === "string" ? event.data.from : null,
        subject: typeof event.data?.subject === "string" ? event.data.subject : null,
        payload: event.data ?? {},
      });
    } catch (err) {
      logger.error({ err }, "Failed to persist Resend webhook event");
    }

    res.status(200).json({ received: true });
  }
);
// ─────────────────────────────────────────────────────────────────────────────

// CORS: calls to /api/public/* (the widget embedded on third-party sites) must
// stay open to ANY origin, including ones never seen before — this is
// traffic from visitors on client (contractor) sites, not ours.
// The rest of the API stays restricted to trustedOrigins.
// NOTE: these used to be two separate `app.use(cors(...))` calls; the first
// (path-scoped to /api/public) set the permissive headers but didn't stop
// the chain, so the request still fell through to the second global
// middleware, which for an untrusted origin called
// `callback(new Error(...))` — an unhandled error that propagated as a
// generic 500 instead of a normal browser-side CORS block. Result:
// every real widget call from a client site failed with a 500.
// Unified into a single middleware with an options-delegate to eliminate
// the double pass.
const trustedOrigins = new Set(getTrustedOrigins());
app.use(
  cors((req, callback) => {
    if (req.path.startsWith("/api/public")) {
      callback(null, { origin: true, credentials: false });
      return;
    }
    const origin = req.headers.origin;
    // Any-port localhost is a dev convenience only: in production it would let a
    // page served by some local program on the user's machine call the API with
    // their cookies.
    const devLocalhost = process.env.NODE_ENV !== "production" && !!origin && /^https?:\/\/localhost(:\d+)?$/.test(origin);
    if (!origin || trustedOrigins.has(origin) || devLocalhost) {
      callback(null, { origin: true, credentials: true });
    } else {
      callback(null, { origin: false, credentials: true });
    }
  })
);
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use(async (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: "File too large: maximum 5MB per image.",
      LIMIT_FILE_COUNT: "Too many files: you can attach at most 3 images.",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field.",
    };
    res.status(400).json({ error: messages[err.code] ?? `Upload error: ${err.message}` });
    return;
  }
  if (err instanceof Error && err.message.startsWith("Unsupported image type")) {
    res.status(400).json({ error: err.message });
    return;
  }
  logger.error(err, "Unhandled error");
  // Phase 69: every 500 reaches error tracking with the request (no body,
  // no cookies) and the actor; awaited so the function cannot end first.
  const actorUserId = res.locals.actorUserId as string | undefined;
  await captureException(err, {
    mechanism: "express",
    handled: false,
    request: requestContext(req),
    user: actorUserId ? { id: actorUserId } : undefined,
    tags: { route: `${req.method} ${req.route?.path ?? req.path}` },
  });
  await flush(1500);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
