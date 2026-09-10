import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import multer from "multer";
import { db, businessProfilesTable } from "@workspace/db";
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
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching business profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/business-profile", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const parsed = UpdateBusinessProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }

    const body = parsed.data;
    const updates = {
      userId,
      ...(body.companyName !== undefined && { companyName: body.companyName }),
      ...(body.vatNumber !== undefined && { vatNumber: body.vatNumber }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.email !== undefined && { email: body.email }),
    };

    const [existing] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

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
    });
  } catch (err) {
    req.log.error({ err }, "Error updating business profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/business-profile/logo",
  requireAuth,
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

router.post("/business-profile/apikey", requireAuth, async (req, res) => {
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
