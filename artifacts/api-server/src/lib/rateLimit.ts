import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

// Requires `app.set("trust proxy", ...)` upstream so req.ip reflects the
// real client IP behind Vercel's proxy instead of colliding on one IP.

export function ipRateLimiter(opts: { windowMs: number; max: number; message: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: opts.message },
  });
}

// Keys by the widget's x-api-key (tenant) when present, falling back to IP —
// caps damage from a single leaked/abused API key independent of source IP.
export function apiKeyRateLimiter(opts: { windowMs: number; max: number; message: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const apiKey = req.headers["x-api-key"] || req.query.apiKey;
      return apiKey ? String(apiKey) : req.ip || "unknown";
    },
    message: { error: opts.message },
  });
}

// Keys by the authenticated user (res.locals.userId, set by requireAuth) —
// must run AFTER requireAuth in the middleware chain.
export function userRateLimiter(opts: { windowMs: number; max: number; message: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request, res: Response) => res.locals.userId || req.ip || "unknown",
    message: { error: opts.message },
  });
}
