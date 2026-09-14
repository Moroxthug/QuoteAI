import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { listSecurityAuditEvents } from "../lib/auditLog.js";

const router = Router();

// GET /api/security/audit-log — org-wide security events (login, 2FA, session
// revocation, permission changes). Read-only for every role, per the Phase 7
// matrix ("security": view for everyone, full only for owner/admin).
router.get("/security/audit-log", requireAuth, requirePermission("security", "view"), async (_req, res) => {
  try {
    const orgId = getUserId(res);
    const events = await listSecurityAuditEvents(orgId, { limit: 200 });
    res.json({
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        actorId: e.actorId,
        actorName: e.actorName,
        actorEmail: e.actorEmail,
        entityType: e.entityType,
        entityId: e.entityId,
        ip: e.ip,
        userAgent: e.userAgent,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to load audit log" });
  }
});

export default router;
