import type { Request, Response, NextFunction } from "express";
import { db, businessProfilesTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { eq } from "drizzle-orm";
import { findActiveApiKeyByRawKey } from "../lib/apiKeys.js";
import { userRateLimiter } from "../lib/rateLimit.js";

// Keys by res.locals.userId, which requireApiKey sets — must run AFTER it in
// every route's middleware chain, same convention as the cookie-auth routes'
// own userRateLimiter usage.
export const publicApiLimiter = userRateLimiter({ windowMs: 60 * 60_000, max: 300, message: "Too many API requests this hour" });

/**
 * Auth for the public API (`/api/v1/public/*`) — a bearer API key instead of
 * the cookie session `requireAuth` uses. Sets the same `res.locals` fields so
 * every downstream `requirePermission`/`getUserId` call works unchanged: the
 * key's snapshotted role stands in for `actorRole`, and its owning company
 * for `userId`.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const rawKey = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
  if (!rawKey) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Missing Authorization: Bearer <api key> header" });
    return;
  }

  const key = await findActiveApiKeyByRawKey(rawKey);
  if (!key) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or revoked API key" });
    return;
  }

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, key.userId));
  if (!hasFeature(profile, "public_api")) {
    res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("public_api"), message: "The public API requires the Elite plan" });
    return;
  }

  res.locals.userId = key.userId;
  res.locals.actorUserId = key.userId;
  res.locals.actorRole = key.role;
  res.locals.userEmail = "";
  res.locals.userName = "";
  next();
}
