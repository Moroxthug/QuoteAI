// Phase 69 — operations surface: the public ops probe, cron-tick recording,
// the automation-backlog alert, and the admin retry.
//
// The tick runs the real maintainers against the shared database (same as
// integrations.e2e); this file only asserts the bookkeeping around it. Ticks
// it records are deleted afterwards so production's /healthz/ops reflects the
// real schedule, not the test run.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, automationRunsTable, cronTicksTable, quotesTable, calendarConnectionsTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { spawnSync } from "node:child_process";
import { randomBytes, createDecipheriv } from "node:crypto";
import { resolve } from "node:path";
import { encryptSecret } from "../lib/crypto.js";
import "../automations/index.js";
import { startServer, stopServer, createOrg, cleanupAll, api, seedQuote } from "./harness.js";
import { emailsTo } from "./mailbox.js";

// Ticks are stamped by the database clock (`defaultNow()`), which was measured
// ~0.7 s behind this machine after a reboot — enough for a tick written inside
// a warm-started server to sort *before* a `new Date()` taken here. A 10 s
// margin keeps the window tied to this run without trusting two clocks to agree.
const startedAt = new Date(Date.now() - 10_000);
const savedEnv = { OPS_ALERT_EMAIL: process.env.OPS_ALERT_EMAIL, ADMIN_EMAIL: process.env.ADMIN_EMAIL };

describe("ops", () => {
  beforeAll(startServer);
  afterAll(async () => {
    process.env.OPS_ALERT_EMAIL = savedEnv.OPS_ALERT_EMAIL;
    process.env.ADMIN_EMAIL = savedEnv.ADMIN_EMAIL;
    await db.delete(cronTicksTable).where(gte(cronTicksTable.startedAt, startedAt));
    await cleanupAll();
    await stopServer();
  });

  test("dead run → /healthz/ops degraded → tick records itself, alerts the operator → admin retry revives it", async () => {
    const org = await createOrg({ companyName: "Ops Co" });
    const opsEmail = `ops-${org.userId}@example.invalid`;
    process.env.OPS_ALERT_EMAIL = opsEmail;
    process.env.ADMIN_EMAIL = org.email; // the org owner acts as the platform admin below

    // A run whose handler would succeed (quote.accepted on an accepted quote)
    // but that the retry loop gave up on.
    const quote = await seedQuote(org.userId, { status: "accepted" });
    await db.update(quotesTable).set({ acceptedAt: new Date(), acceptedByName: "Retry Client" }).where(eq(quotesTable.id, quote.id));
    const [dead] = await db
      .insert(automationRunsTable)
      .values({
        userId: org.userId,
        event: "quote.accepted",
        entityType: "quote",
        entityId: quote.id,
        idempotencyKey: `e2e-ops:${quote.id}`,
        status: "dead",
        attempts: 5,
        lastError: "simulated: handler failed five times",
        finishedAt: new Date(),
      })
      .returning();

    // 1. Public probe: degraded (dead run; and, unless a real tick ran within 25 h, stale).
    const degraded = await api("/api/healthz/ops");
    expect(degraded.status).toBe(503);
    expect(degraded.body.status).toBe("degraded");
    expect(degraded.body.automations.dead).toBeGreaterThanOrEqual(1);
    expect(degraded.body.problems.join(" ")).toMatch(/dead/);
    expect(degraded.body).not.toHaveProperty("ticks"); // the public probe never lists internals

    // 2. Tick: recorded, reports the backlog, alerts the operator.
    const tick = await api("/api/cron/tick", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(tick.status, JSON.stringify(tick.body)).toBe(200);
    expect(tick.body.backlog.dead).toBeGreaterThanOrEqual(1);
    const ticks = await db.select().from(cronTicksTable).where(gte(cronTicksTable.startedAt, startedAt));
    expect(ticks.length).toBeGreaterThanOrEqual(1);
    const last = ticks[ticks.length - 1]!;
    expect(last.ok).toBe(true);
    expect(last.finishedAt).not.toBeNull();
    expect(last.tookMs).toBeGreaterThanOrEqual(0);
    expect((last.result as Record<string, unknown>)?.automations).toBeTruthy();
    const alerts = emailsTo(opsEmail);
    expect(alerts.length, "one ops alert email").toBeGreaterThanOrEqual(1);
    expect(alerts[0]!.subject).toMatch(/^\[QuoteAI ops\] \d+ dead/);
    expect(alerts[0]!.html).toContain(`quote.accepted quote/${quote.id}`);
    expect(alerts[0]!.html).toContain("simulated: handler failed five times");

    // The tick is what un-stales the probe; the dead run keeps it degraded.
    const afterTick = await api("/api/healthz/ops");
    expect(afterTick.status).toBe(503);
    expect(afterTick.body.cron.stale).toBe(false);
    expect(afterTick.body.cron.lastOkAt).toBeTruthy();

    // 3. Admin surface: ops report with tick history, the backlog list, the retry.
    const anon = await api("/api/admin/ops");
    expect(anon.status).toBe(403);
    const report = await org.api("/api/admin/ops");
    expect(report.status, JSON.stringify(report.body)).toBe(200);
    expect(report.body.ticks.length).toBeGreaterThanOrEqual(1);
    expect(report.body.automations.dead).toBeGreaterThanOrEqual(1);
    const list = await org.api("/api/admin/automations");
    expect(list.status).toBe(200);
    expect(list.body.runs.some((r: { id: string }) => r.id === dead!.id)).toBe(true);

    const retry = await org.api(`/api/admin/automations/${dead!.id}/retry`, { body: {} });
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect(retry.body.ok).toBe(true);
    expect(retry.body.run.status).toBe("succeeded");
    expect(retry.body.run.attempts).toBe(6);
    expect((await org.api("/api/admin/automations/00000000-0000-0000-0000-000000000000/retry", { body: {} })).status).toBe(404);

    // 4. Once nothing is dead (7-day window) the probe is green again.
    await db.delete(automationRunsTable).where(eq(automationRunsTable.userId, org.userId));
    const ok = await api("/api/healthz/ops");
    // Other tenants' runs may legitimately be dead in the shared DB — only assert our contribution is gone.
    expect(ok.body.automations.dead).toBe(degraded.body.automations.dead - 1);
  }, 240_000);

  test("rotate-token-key re-encrypts under the new key, is idempotent, refuses on unknown keys", async () => {
    const org = await createOrg({ companyName: "Rotate Co" });
    const oldKey = process.env.TOKEN_ENCRYPTION_KEY!; // what the harness encrypts with
    const newKey = randomBytes(32).toString("hex");
    const where = and(eq(calendarConnectionsTable.userId, org.userId), eq(calendarConnectionsTable.provider, "google"));
    await db.insert(calendarConnectionsTable).values({
      userId: org.userId,
      provider: "google",
      accountEmail: org.email,
      accessTokenEnc: encryptSecret("access-plain"),
      refreshTokenEnc: encryptSecret("refresh-plain"),
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
    });
    // Scoped to this tenant with --user: the shared database also holds real tokens under the production key.
    const run = (env: Record<string, string>, ...flags: string[]) =>
      spawnSync(process.execPath, [resolve(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs"), resolve(import.meta.dirname, "../../scripts/rotate-token-key.ts"), "--user", org.userId, ...flags], {
        encoding: "utf8",
        env: { ...process.env, ...env },
      });

    // Wrong OLD key: refuses, writes nothing.
    const refused = run({ OLD_TOKEN_ENCRYPTION_KEY: "1".repeat(64), NEW_TOKEN_ENCRYPTION_KEY: newKey }, "--apply");
    expect(refused.status, refused.stdout + refused.stderr).toBe(1);
    const [untouched] = await db.select().from(calendarConnectionsTable).where(where);
    expect(decryptWith(untouched!.accessTokenEnc, oldKey)).toBe("access-plain");

    const dry = run({ OLD_TOKEN_ENCRYPTION_KEY: oldKey, NEW_TOKEN_ENCRYPTION_KEY: newKey });
    expect(dry.status, dry.stdout + dry.stderr).toBe(0);
    expect(dry.stdout).toContain("2 value(s) to rotate, 0 already under the new key, 0 undecryptable");
    expect(decryptWith((await db.select().from(calendarConnectionsTable).where(where))[0]!.accessTokenEnc, oldKey)).toBe("access-plain");

    const applied = run({ OLD_TOKEN_ENCRYPTION_KEY: oldKey, NEW_TOKEN_ENCRYPTION_KEY: newKey }, "--apply");
    expect(applied.status, applied.stdout + applied.stderr).toBe(0);
    const [rotated] = await db.select().from(calendarConnectionsTable).where(where);
    expect(decryptWith(rotated!.accessTokenEnc, oldKey)).toBeNull();
    expect(decryptWith(rotated!.accessTokenEnc, newKey)).toBe("access-plain");
    expect(decryptWith(rotated!.refreshTokenEnc, newKey)).toBe("refresh-plain");

    // Second pass: recognised as already rotated.
    const again = run({ OLD_TOKEN_ENCRYPTION_KEY: oldKey, NEW_TOKEN_ENCRYPTION_KEY: newKey });
    expect(again.status).toBe(0);
    expect(again.stdout).toContain("0 value(s) to rotate, 2 already under the new key");
  }, 120_000);
});

function decryptWith(payload: string, hexKey: string): string | null {
  try {
    const [iv, tag, data] = payload.split(".");
    const d = createDecipheriv("aes-256-gcm", Buffer.from(hexKey, "hex"), Buffer.from(iv!, "base64"));
    d.setAuthTag(Buffer.from(tag!, "base64"));
    return Buffer.concat([d.update(Buffer.from(data!, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
