import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission.js";
import multer from "multer";
import { db, businessProfilesTable, normalizeProvince, getTaxProfile, paymentScheduleSchema, DEFAULT_AUTOMATION_SETTINGS, effectivePlan, hasFeature, PRODUCT_FEATURES, type BusinessProfile } from "@workspace/db";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { UpdateBusinessProfileBody } from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { randomBytes } from "crypto";

const router = Router();
const objectStorageService = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const uploadLogo = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

const ALLOWED_LOGO_MIMES = ["image/svg+xml", "image/png", "image/jpeg"];

// Phase 0 fields (Canadian identity, automation prefs, entitlements) are
// appended to the legacy shape so existing clients keep working.
function serializeProfileExtras(profile: BusinessProfile | undefined) {
  const province = normalizeProvince(profile?.province) ?? null;
  const features = Object.fromEntries(PRODUCT_FEATURES.map((f) => [f, hasFeature(profile, f)])) as Record<string, boolean>;
  return {
    province,
    taxProfile: province ? getTaxProfile(province) : null,
    gstHstNumber: profile?.gstHstNumber ?? null,
    qstNumber: profile?.qstNumber ?? null,
    pstNumber: profile?.pstNumber ?? null,
    licenceNumber: profile?.licenceNumber ?? null,
    etransferEmail: profile?.etransferEmail ?? null,
    defaultPaymentSchedule: profile?.defaultPaymentSchedule ?? null,
    googleReviewUrl: profile?.googleReviewUrl ?? null,
    homeStarsProfileUrl: profile?.homeStarsProfileUrl ?? null,
    sendReviewRequests: profile?.sendReviewRequests ?? true,
    automationSettings: { ...DEFAULT_AUTOMATION_SETTINGS, ...(profile?.automationSettings ?? {}) },
    plan: effectivePlan(profile),
    features,
  };
}

const ProfileExtrasBody = z.object({
  province: z.string().nullable().optional(),
  gstHstNumber: z.string().max(40).nullable().optional(),
  qstNumber: z.string().max(40).nullable().optional(),
  pstNumber: z.string().max(40).nullable().optional(),
  licenceNumber: z.string().max(80).nullable().optional(),
  etransferEmail: z.string().email().max(200).nullable().optional(),
  googleReviewUrl: z.string().url().max(500).nullable().optional(),
  homeStarsProfileUrl: z.string().url().max(500).nullable().optional(),
  sendReviewRequests: z.boolean().optional(),
  defaultPaymentSchedule: z.unknown().nullable().optional(),
  automationSettings: z
    .object({
      notifyOnQuoteAccepted: z.boolean().optional(),
      autoDraftContract: z.boolean().optional(),
      autoSendInvoices: z.boolean().optional(),
      invoiceAutoSendAfterHours: z.number().int().min(0).max(168).optional(),
      invoiceReminders: z.boolean().optional(),
      smsEnabled: z.boolean().optional(),
      smsReminders: z.boolean().optional(),
    })
    .optional(),
});

router.get("/business-profile", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    if (!profile) {
      res.json({
        userId,
        companyName: "",
        vatNumber: null,
        address: null,
        logoUrl: null,
        phone: null,
        email: null,
        ...serializeProfileExtras(undefined),
      });
      return;
    }

    res.json({
      userId: profile.userId,
      companyName: profile.companyName,
      vatNumber: profile.vatNumber ?? null,
      address: profile.address ?? null,
      logoUrl: profile.logoUrl ?? null,
      phone: profile.phone ?? null,
      email: profile.email ?? null,
      apiKey: profile.apiKey ?? null,
      ...serializeProfileExtras(profile),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching business profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/business-profile", requireAuth, requirePermission("settings", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const parsed = UpdateBusinessProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }

    const body = parsed.data;
    const extrasParsed = ProfileExtrasBody.safeParse(req.body);
    if (!extrasParsed.success) {
      res.status(400).json({ error: "Invalid request", details: extrasParsed.error });
      return;
    }
    const extras = extrasParsed.data;

    const [existing] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    let province: string | null | undefined = undefined;
    if (extras.province !== undefined) {
      province = extras.province === null || extras.province === "" ? null : normalizeProvince(extras.province);
      if (extras.province && !province) {
        res.status(400).json({ error: "Invalid province code" });
        return;
      }
    }
    let defaultPaymentSchedule: typeof existing extends undefined ? never : BusinessProfile["defaultPaymentSchedule"] | undefined = undefined;
    if (extras.defaultPaymentSchedule !== undefined) {
      if (extras.defaultPaymentSchedule === null) defaultPaymentSchedule = null;
      else {
        const ps = paymentScheduleSchema.safeParse(extras.defaultPaymentSchedule);
        if (!ps.success) {
          res.status(400).json({ error: "Invalid default payment schedule", details: ps.error });
          return;
        }
        defaultPaymentSchedule = { ...ps.data, derived: false };
      }
    }

    const updates = {
      userId,
      ...(body.companyName !== undefined && { companyName: body.companyName }),
      ...(body.vatNumber !== undefined && { vatNumber: body.vatNumber }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.email !== undefined && { email: body.email }),
      ...(province !== undefined && { province }),
      ...(extras.gstHstNumber !== undefined && { gstHstNumber: extras.gstHstNumber?.trim() || null }),
      ...(extras.qstNumber !== undefined && { qstNumber: extras.qstNumber?.trim() || null }),
      ...(extras.pstNumber !== undefined && { pstNumber: extras.pstNumber?.trim() || null }),
      ...(extras.licenceNumber !== undefined && { licenceNumber: extras.licenceNumber?.trim() || null }),
      ...(extras.etransferEmail !== undefined && { etransferEmail: extras.etransferEmail?.trim() || null }),
      ...(extras.googleReviewUrl !== undefined && { googleReviewUrl: extras.googleReviewUrl?.trim() || null }),
      ...(extras.homeStarsProfileUrl !== undefined && { homeStarsProfileUrl: extras.homeStarsProfileUrl?.trim() || null }),
      ...(extras.sendReviewRequests !== undefined && { sendReviewRequests: extras.sendReviewRequests }),
      ...(defaultPaymentSchedule !== undefined && { defaultPaymentSchedule }),
      ...(extras.automationSettings !== undefined && {
        automationSettings: { ...(existing?.automationSettings ?? {}), ...extras.automationSettings },
      }),
    };

    let profile;
    if (existing) {
      [profile] = await db
        .update(businessProfilesTable)
        .set(updates)
        .where(eq(businessProfilesTable.userId, userId))
        .returning();
    } else {
      [profile] = await db
        .insert(businessProfilesTable)
        .values({ companyName: body.companyName ?? "", ...updates })
        .returning();
    }

    res.json({
      userId: profile!.userId,
      companyName: profile!.companyName,
      vatNumber: profile!.vatNumber ?? null,
      address: profile!.address ?? null,
      logoUrl: profile!.logoUrl ?? null,
      phone: profile!.phone ?? null,
      email: profile!.email ?? null,
      apiKey: profile!.apiKey ?? null,
      ...serializeProfileExtras(profile),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating business profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/business-profile/logo",
  requireAuth,
  requirePermission("settings", "edit"),
  uploadLogo,
  async (req, res) => {
    try {
      const userId = getUserId(res);

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const uploadedFile = files?.["logo"]?.[0] ?? files?.["file"]?.[0];

      if (!uploadedFile) {
        res.status(400).json({ error: "No file uploaded. Send the file in the 'logo' field." });
        return;
      }

      const { mimetype, size, originalname, buffer } = uploadedFile;

      if (!ALLOWED_LOGO_MIMES.includes(mimetype)) {
        res.status(400).json({ error: "Invalid file type. Allowed types: SVG, PNG, JPEG" });
        return;
      }

      if (size > 2 * 1024 * 1024) {
        res.status(400).json({ error: "File too large. Maximum size: 2 MB" });
        return;
      }

      const ext = originalname.split(".").pop()?.toLowerCase() ?? "bin";
      const safeExt = ["svg", "png", "jpg", "jpeg"].includes(ext) ? ext : "png";
      const subPath = `logos/${userId}/logo.${safeExt}`;

      const publicSubPath = await objectStorageService.uploadPublicObjectBuffer({
        subPath,
        buffer,
        contentType: mimetype,
      });

      const logoUrl = `/api/storage/public-objects/${publicSubPath}`;

      const [existing] = await db
        .select()
        .from(businessProfilesTable)
        .where(eq(businessProfilesTable.userId, userId));

      if (existing) {
        await db
          .update(businessProfilesTable)
          .set({ logoUrl })
          .where(eq(businessProfilesTable.userId, userId));
      } else {
        await db
          .insert(businessProfilesTable)
          .values({ userId, companyName: "", logoUrl });
      }

      res.json({ logoUrl });
    } catch (err) {
      req.log.error({ err }, "Error uploading logo");
      res.status(500).json({ error: "Failed to upload logo" });
    }
  }
);

router.post("/business-profile/apikey", requireAuth, requirePermission("settings", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const newApiKey = `quoteai_pk_${randomBytes(24).toString("hex")}`;

    const [existing] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    if (existing) {
      await db
        .update(businessProfilesTable)
        .set({ apiKey: newApiKey })
        .where(eq(businessProfilesTable.userId, userId));
    } else {
      await db
        .insert(businessProfilesTable)
        .values({ userId, companyName: "", apiKey: newApiKey });
    }

    res.json({ apiKey: newApiKey });
  } catch (err) {
    req.log.error({ err }, "Error generating api key");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
