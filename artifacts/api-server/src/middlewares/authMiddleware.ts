import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";

declare global {
  namespace Express {
    interface Locals {
      userId: string;
      userEmail: string;
      userName: string;
    }
  }
}

// Generic over P: if this stayed fixed to Request's default, TypeScript
// would unify the type of req.params across the entire handler chain to the
// more generic value (string | string[]) whenever this middleware
// precedes a handler with literal route parameters (e.g.
// router.get("/foo/:id", requireAuth, (req) => req.params.id)), hiding
// the real type inferred from the route string.
export async function requireAuth<P = Record<string, string>>(req: Request<P>, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.locals.userId = session.user.id;
    res.locals.userEmail = session.user.email;
    res.locals.userName = session.user.name;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function getUserId(res: Response): string {
  return res.locals.userId;
}

export function getUserEmail(res: Response): string {
  return res.locals.userEmail ?? "";
}

export function getUserName(res: Response): string {
  return res.locals.userName ?? "";
}
