import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission.js";
import { openai, toFile } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger.js";
import { userRateLimiter } from "../lib/rateLimit.js";

const speechLimiter = userRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: "You have reached the hourly limit for voice transcriptions. Please try again later.",
});

const ALLOWED_AUDIO_MIMES = [
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
];

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AUDIO_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

const router = Router();

// POST /api/speech/transcribe
router.post(
  "/speech/transcribe",
  requireAuth,
  requirePermission("quotes", "edit"),
  speechLimiter,
  (req, res, next) => {
    audioUpload.single("audio")(req, res, (err) => {
      if (err instanceof multer.MulterError || err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    });
  },
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      const uploadable = await toFile(file.buffer, file.originalname || "audio.webm", {
        type: file.mimetype,
      });

      const transcription = await openai.audio.transcriptions.create({
        file: uploadable,
        model: "whisper-large-v3-turbo",
        language: "en",
        response_format: "json",
      });

      res.json({ text: transcription.text });
    } catch (err) {
      logger.error({ err }, "Error transcribing audio");
      res.status(500).json({ error: "Transcription failed. Please try again." });
    }
  }
);

export default router;
