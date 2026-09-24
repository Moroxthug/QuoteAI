// Phase 98 — GET /api/healthz/owner, the deployment half of `pnpm ops:owner-check`.
// It maps which launch settings exist, so it must stay behind CRON_SECRET, and
// it must answer with yes/no only — never a value.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, api } from "./harness.js";

const SAVED = { SENTRY_DSN: process.env.SENTRY_DSN, PILOT_PROMO_CODE: process.env.PILOT_PROMO_CODE, OPS_ALERT_EMAIL: process.env.OPS_ALERT_EMAIL };

describe("owner readiness endpoint (Phase 98)", () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(SAVED)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await stopServer();
  });

  test("refuses without the cron secret, and with a wrong one", async () => {
    expect((await api("/api/healthz/owner")).status).toBe(401);
    expect((await api("/api/healthz/owner", { token: "not-the-secret" })).status).toBe(401);
  });

  test("answers presence, never the value", async () => {
    process.env.SENTRY_DSN = "https://publickey-e2e@o0.ingest.sentry.io/0";
    delete process.env.PILOT_PROMO_CODE;
    delete process.env.OPS_ALERT_EMAIL;
    const res = await api("/api/healthz/owner", { token: process.env.CRON_SECRET! });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.body.vars.SENTRY_DSN).toBe(true);
    expect(res.body.vars.OPS_ALERT_EMAIL).toBe(false);
    expect(res.body.stripe.promo).toMatchObject({ set: false, ok: false });
    expect(JSON.stringify(res.body)).not.toContain("publickey-e2e");
    expect(JSON.stringify(res.body)).not.toContain(process.env.STRIPE_SECRET_KEY ?? "\u0000");
  });
});
