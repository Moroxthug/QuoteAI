import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable, COMPANY_TRADES, effectivePlan, type CompanyTrade } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { ADDON_MONTHLY_CENTS, addonPriceIdFor, isBillingInterval, type BillingInterval } from "../lib/billing.js";
import { AddonError, setAddonQuantity } from "../lib/subscriptionAddons.js";
import { seatCount } from "../team/seats.js";

// ── Phase 91: seats and the company's sign-up answers ────────────────────────
// Extra seats are a quantity on the company's own subscription (the
// STRIPE_PRICE_EXTRA_SEAT item), charged prorated the moment they are added.
// A company whose plan a group pays for has no subscription of its own to add
// them to. The sign-up answers (trades, team size, seats wanted, field crew)
// tailor the first run — they never gate anything.

const router = Router();

async function profileOf(orgId: string) {
  const [p] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
  return p ?? null;
}

function seatBilling(profile: Awaited<ReturnType<typeof profileOf>>) {
  const interval: BillingInterval = isBillingInterval(profile?.subscriptionInterval) ? (profile!.subscriptionInterval as BillingInterval) : "month";
  const priced = !!addonPriceIdFor("extra_seat", interval);
  const ownPlan = !!profile && !profile.planCoveredBy && effectivePlan(profile) !== "free" && !!profile.stripeCustomerId;
  const reason = !priced ? "SEATS_UNAVAILABLE" : profile?.planCoveredBy ? "COVERED_BY_GROUP" : !ownPlan ? "NO_SUBSCRIPTION" : null;
  return { interval, canBuy: priced && ownPlan, reason, pricePerSeatCents: interval === "year" ? ADDON_MONTHLY_CENTS.extra_seat * 10 : ADDON_MONTHLY_CENTS.extra_seat };
}

// GET /api/seats — how many, how many used, and whether more can be bought here.
router.get("/seats", requireAuth, requirePermission("team", "view"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const profile = await profileOf(orgId);
    res.json({ ...(await seatCount(orgId)), ...seatBilling(profile), seatsWanted: profile?.companySetup?.seatsWanted ?? null });
  } catch (err) {
    req.log.error({ err }, "Error loading seats");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/seats — { extraSeats } — the number of paid seats beyond the plan's.
router.put("/seats", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const body = z.object({ extraSeats: z.number().int().min(0).max(200) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const profile = await profileOf(orgId);
    const billing = seatBilling(profile);
    if (!billing.canBuy) {
      res.status(409).json({ error: billing.reason, message: "Seats can't be changed on this account right now." });
      return;
    }
    const seats = await seatCount(orgId);
    // Going down may not strand people: the seats in use have to fit.
    if (seats.included + body.data.extraSeats < seats.used) {
      res.status(409).json({ error: "SEATS_IN_USE", message: `${seats.used} seats are in use. Remove members or open invitations first.`, used: seats.used, minimumExtra: seats.used - seats.included });
      return;
    }
    if (body.data.extraSeats !== (profile?.extraSeats ?? 0)) {
      await setAddonQuantity({ stripeCustomerId: profile!.stripeCustomerId, interval: billing.interval }, "extra_seat", body.data.extraSeats);
      await db.update(businessProfilesTable).set({ extraSeats: body.data.extraSeats }).where(eq(businessProfilesTable.userId, orgId));
      await writeAudit({ userId: orgId, actorType: "user", actorId: null, entityType: "billing", entityId: orgId, action: "extra_seats_changed", diff: { from: profile?.extraSeats ?? 0, to: body.data.extraSeats } });
    }
    res.json({ ...(await seatCount(orgId)), ...seatBilling(await profileOf(orgId)) });
  } catch (err) {
    if (err instanceof AddonError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    req.log.error({ err }, "Error changing seats");
    res.status(500).json({ error: "Internal server error" });
  }
});

const SetupBody = z.object({
  trades: z.array(z.enum(COMPANY_TRADES as unknown as [CompanyTrade, ...CompanyTrade[]])).max(COMPANY_TRADES.length).optional(),
  teamSize: z.number().int().min(1).max(10_000).optional(),
  seatsWanted: z.number().int().min(1).max(500).optional(),
  fieldCrew: z.boolean().optional(),
});

// PUT /api/company-setup — the sign-up answers.
router.put("/company-setup", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const orgId = getUserId(res);
    const body = SetupBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const profile = await profileOf(orgId);
    const companySetup = { ...(profile?.companySetup ?? {}), ...body.data, completedAt: new Date().toISOString() };
    if (profile) await db.update(businessProfilesTable).set({ companySetup }).where(eq(businessProfilesTable.userId, orgId));
    else await db.insert(businessProfilesTable).values({ userId: orgId, companyName: "", companySetup });
    res.json({ companySetup });
  } catch (err) {
    req.log.error({ err }, "Error saving company setup");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
