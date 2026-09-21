import { db, stripeConnectAccountsTable, businessProfilesTable, authUsersTable, type Invoice, type StripeConnectAccount } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { publicInvoiceUrl, invoiceToken } from "./service.js";
import { balanceCents } from "./math.js";
import { applicationFeeCents, connectFeeBps } from "../lib/billing.js";

// ── Phase 15: Stripe Connect for invoice card payments ──────────────────────
// One Express account per company. Checkout Sessions run directly against the
// connected account (the `stripeAccount` request option / "direct charge"),
// so the money never passes through QuoteAI's own Stripe balance. Phase 73:
// QuoteAI takes a small application fee on each card payment
// (STRIPE_CONNECT_FEE_BPS, default 0.5 %), deducted by Stripe from the
// contractor's payout and shown on their "Get paid online" card.

export async function getConnectAccount(userId: string): Promise<StripeConnectAccount | null> {
  const [row] = await db.select().from(stripeConnectAccountsTable).where(eq(stripeConnectAccountsTable.userId, userId));
  return row ?? null;
}

async function ensureConnectAccount(userId: string): Promise<StripeConnectAccount> {
  const existing = await getConnectAccount(userId);
  if (existing) return existing;

  const stripe = await getUncachableStripeClient();
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  const [authUser] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, userId));

  const account = await stripe.accounts.create({
    type: "express",
    country: "CA",
    email: profile?.email ?? authUser?.email ?? undefined,
    business_type: "company",
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    business_profile: profile?.companyName ? { name: profile.companyName } : undefined,
  });

  const [row] = await db
    .insert(stripeConnectAccountsTable)
    .values({ userId, stripeAccountId: account.id, chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled, detailsSubmitted: account.details_submitted })
    .onConflictDoUpdate({ target: stripeConnectAccountsTable.userId, set: { stripeAccountId: account.id } })
    .returning();
  return row!;
}

/** Onboarding (or re-onboarding) link — Stripe's own hosted flow, ~5 minutes, no partner application. */
export async function createOnboardingLink(userId: string): Promise<string> {
  const conn = await ensureConnectAccount(userId);
  const stripe = await getUncachableStripeClient();
  const baseUrl = getBaseUrl();
  const link = await stripe.accountLinks.create({
    account: conn.stripeAccountId,
    type: "account_onboarding",
    refresh_url: `${baseUrl}/api/invoice-payments/connect/refresh`,
    return_url: `${baseUrl}/api/invoice-payments/connect/return`,
  });
  return link.url;
}

/** Re-fetches the account from Stripe and syncs the local capability flags. */
export async function syncConnectAccountStatus(stripeAccountId: string): Promise<void> {
  const stripe = await getUncachableStripeClient();
  const account = await stripe.accounts.retrieve(stripeAccountId);
  await db
    .update(stripeConnectAccountsTable)
    .set({ chargesEnabled: !!account.charges_enabled, payoutsEnabled: !!account.payouts_enabled, detailsSubmitted: !!account.details_submitted })
    .where(eq(stripeConnectAccountsTable.stripeAccountId, stripeAccountId));
}

/** Creates a Checkout Session for the invoice's balance, run directly against the company's connected account. */
export async function createInvoiceCheckoutSession(inv: Invoice): Promise<{ url: string; sessionId: string }> {
  const conn = await getConnectAccount(inv.userId);
  if (!conn?.chargesEnabled) throw new Error("CARD_PAYMENTS_NOT_ENABLED");
  const amount = balanceCents(inv);
  if (amount <= 0) throw new Error("Nothing owing on this invoice");

  const stripe = await getUncachableStripeClient();
  const returnUrl = publicInvoiceUrl(invoiceToken(inv));
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price_data: { currency: "cad", unit_amount: amount, product_data: { name: `Invoice ${inv.number}` } }, quantity: 1 }],
      success_url: `${returnUrl}?payment=success`,
      cancel_url: `${returnUrl}?payment=cancelled`,
      metadata: { invoiceId: inv.id, applicationFeeBps: String(connectFeeBps()) },
      ...(applicationFeeCents(amount) > 0 ? { payment_intent_data: { application_fee_amount: applicationFeeCents(amount) } } : {}),
    },
    { stripeAccount: conn.stripeAccountId },
  );
  return { url: session.url!, sessionId: session.id };
}
