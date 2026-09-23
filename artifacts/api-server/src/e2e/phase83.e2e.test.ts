// Phase 83 — the write surfaces the dashboard stopped offering to a role.
//
// The fixes themselves are in the frontend: `/dashboard/new`, the imports
// upload card, the job setup editor, "Draft contract", "Edit schedule" and
// Restore all asked `useCan()` before rendering. What this suite pins is the
// other half of that pairing — that the server would in fact have answered
// 403, so the hiding is honest, and that it is exactly the matrix being
// applied and not a blanket denial (a foreman *may* edit a job's setup).
//
// The permission middleware runs before the handler, so a bogus id is enough
// to exercise it: 403 means the role was stopped, 404 means it got through.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, createOrg, createUser, seedQuote, cleanupAll, type TestUser } from "./harness.js";

const BOGUS = "00000000-0000-4000-8000-000000000000";

async function member(owner: TestUser, role: "foreman" | "viewer"): Promise<TestUser> {
  const email = `e2e-${role}-${owner.userId}@example.invalid`;
  const invite = await owner.api("/api/team/members/invite", { body: { email, role } });
  expect(invite.status, JSON.stringify(invite.body)).toBe(201);
  const token = invite.body.url.split("/team-invite/")[1];
  const user = await createUser({ email, name: `${role} person` });
  const accepted = await user.api(`/api/team/invite/${token}/accept`, { method: "POST" });
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
  return user;
}

describe("Phase 83 — what the dashboard hides, the server refuses", () => {
  let owner: TestUser;
  let foreman: TestUser;
  let viewer: TestUser;
  let quoteId: string;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ plan: "monthly_elite" });
    quoteId = (await seedQuote(owner.userId)).id;
    foreman = await member(owner, "foreman");
    viewer = await member(owner, "viewer");
  }, 120_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("foreman: the quote-writing surfaces are 403", async () => {
    // /dashboard/new — every tab of it (quotes:edit).
    expect((await foreman.api("/api/quotes", { body: { prompt: "paint a room" } })).status).toBe(403);
    // The payment schedule card's Save (quotes:edit).
    expect((await foreman.api(`/api/quotes/${quoteId}`, { method: "PUT", body: { titolo: "no" } })).status).toBe(403);
    // Archive → Restore (quotes:full).
    expect((await foreman.api(`/api/quotes/${quoteId}/restore`, { method: "POST" })).status).toBe(403);
    // The quote page's "Draft contract" (contracts:edit).
    expect((await foreman.api(`/api/contracts/from-quote/${quoteId}`, { method: "POST" })).status).toBe(403);
    // The imports upload card — both dropzones (imports:edit).
    expect((await foreman.api("/api/imports/spreadsheet", { method: "POST" })).status).toBe(403);
    expect((await foreman.api("/api/imports/pdf", { method: "POST" })).status).toBe(403);
  });

  test("foreman: job setup is theirs to edit — the gate is the matrix, not a wall", async () => {
    const res = await foreman.api(`/api/jobs/${BOGUS}/setup`, { method: "PUT", body: { milestones: [] } });
    expect(res.status).not.toBe(403);
  });

  test("viewer: the job setup editor is 403", async () => {
    expect((await viewer.api(`/api/jobs/${BOGUS}/setup`, { method: "PUT", body: { milestones: [] } })).status).toBe(403);
    expect((await viewer.api(`/api/jobs/${BOGUS}/setup/confirm`, { method: "POST" })).status).toBe(403);
    expect((await viewer.api(`/api/jobs/${BOGUS}/setup/regenerate`, { method: "POST" })).status).toBe(403);
  });

  test("owner: none of it is blocked for the person who owns the company", async () => {
    const res = await owner.api(`/api/jobs/${BOGUS}/setup`, { method: "PUT", body: { milestones: [] } });
    expect(res.status).not.toBe(403);
    expect((await owner.api(`/api/quotes/${quoteId}`, { method: "PUT", body: { note: "Renamed by owner" } })).status).toBe(200);
  });

  test("a body naming no known field is a 400, not a 500", async () => {
    // `titolo` is not a field this route has ever accepted; before Phase 83 it
    // reached Drizzle as `.set({})` and came back as an internal error.
    const res = await owner.api(`/api/quotes/${quoteId}`, { method: "PUT", body: { titolo: "nope" } });
    expect(res.status).toBe(400);
  });
});
