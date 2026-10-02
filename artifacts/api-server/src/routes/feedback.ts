import { Router } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { z } from "zod";
import { db, appFeedbackTable, FEEDBACK_KINDS } from "@workspace/db";
import { requireAuth, getUserId, getActorUserId, getUserEmail } from "../middlewares/authMiddleware.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { sendOpsAlert } from "../lib/ops.js";

const router = Router();
const storage = new ObjectStorageService();
const limiter = userRateLimiter({ windowMs: 60 * 60 * 1000, max: 20, message: "Too many notes this hour. Try again later." });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype) ? cb(null, true) : cb(new Error("Use a JPG, PNG or WebP screenshot."))),
});

const Fields = z.object({
  kind: z.enum(FEEDBACK_KINDS).default("wrong"),
  note: z.string().trim().max(4000).default(""),
  replyOk: z.enum(["true", "false"]).default("true"),
  includeLogs: z.enum(["true", "false"]).default("true"),
  appVersion: z.string().max(40).optional(),
  device: z.string().max(120).optional(),
  screen: z.string().max(120).optional(),
  markup: z.string().max(40_000).optional(),
});

const Strokes = z.array(z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).max(2000)).max(50);

// POST /api/feedback — multipart { kind, note, replyOk, includeLogs, appVersion, device, screen, markup, screenshot? } from the phone's Send feedback. Kept in app_feedback and emailed to the operator;
// the person is shown the short reference. Logs here are the app version, the phone and the screen: no client details are ever attached.
router.post(
  "/feedback",
  requireAuth,
  limiter,
  (req, res, next) => {
    upload.single("screenshot")(req, res, (err) => {
      if (err) { res.status(400).json({ error: err.message }); return; }
      next();
    });
  },
  async (req, res) => {
    try {
      const f = Fields.safeParse(req.body ?? {});
      if (!f.success) { res.status(400).json({ error: "Invalid feedback" }); return; }
      if (!f.data.note && !req.file) { res.status(400).json({ error: "Write a note or add a screenshot." }); return; }
      let markup: number[][][] | null = null;
      if (f.data.markup) {
        try { const p = Strokes.safeParse(JSON.parse(f.data.markup)); if (p.success) markup = p.data as unknown as number[][][]; } catch { /* not JSON: dropped */ }
      }
      const userId = getUserId(res);
      let path: string | null = null;
      if (req.file) {
        const ext = req.file.mimetype === "image/png" ? "png" : req.file.mimetype === "image/webp" ? "webp" : "jpg";
        const sub = `feedback/${userId}/${randomUUID()}.${ext}`;
        await storage.uploadObjectBuffer({ subPath: sub, buffer: req.file.buffer, contentType: req.file.mimetype });
        path = sub;
      }
      const [row] = await db.insert(appFeedbackTable).values({
        userId, authorEmail: getUserEmail(res), kind: f.data.kind, note: f.data.note, replyOk: f.data.replyOk === "true", includeLogs: f.data.includeLogs === "true",
        appVersion: f.data.appVersion ?? null, device: f.data.device ?? null, screen: f.data.screen ?? null, screenshotPath: path, markup,
      }).returning();
      const ref = `FB-${1000 + row!.ref}`;
      void sendOpsAlert(`Pocket feedback ${ref} (${f.data.kind})`, [
        `From: ${getUserEmail(res) ?? userId}${f.data.replyOk === "true" ? " (OK to reply)" : " (no reply wanted)"}`,
        `Actor: ${getActorUserId(res)}`,
        f.data.includeLogs === "true" ? `App ${f.data.appVersion ?? "?"} · ${f.data.device ?? "?"} · screen ${f.data.screen ?? "?"}` : "Logs not included",
        path ? `Screenshot: ${path}` : "No screenshot",
        "",
        f.data.note,
      ].filter((l, i, a) => l !== "" || a[i - 1] !== ""));
      res.status(201).json({ ref, screenshot: !!path });
    } catch (err) {
      req.log.error({ err }, "Error saving feedback");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
