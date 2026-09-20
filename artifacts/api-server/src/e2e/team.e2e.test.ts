// Phase 63 — team accounts (Phase 7): invite → accept → act as the org, and
// the permission matrix actually denying a role over HTTP.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, organizationMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, seedQuote, cleanupAll, api } from "./harness.js";
import { emailsTo } from "./mailbox.js";

describe("team: invite, accept, role denial", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("owner invites a viewer; viewer can read but not write; invite is single-use", async () => {
    const owner = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(owner.userId);
    const inviteeEmail = `e2e-viewer-${owner.userId}@example.invalid`;

    // Invite — email goes out (mocked) and the raw link comes back to the dashboard.
    const invite = await owner.api("/api/team/members/invite", { body: { email: inviteeEmail, role: "viewer" } });
    expect(invite.status, JSON.stringify(invite.body)).toBe(201);
    expect(invite.body.url).toMatch(/\/team-invite\/[A-Za-z0-9_-]{20,}$/);
    expect(invite.body.emailed).toBe(true);
    expect(emailsTo(inviteeEmail).length).toBeGreaterThan(0);
    const token = invite.body.url.split("/team-invite/")[1];

    // Public preview of the invite (no login).
    const preview = await api(`/api/team/invite/${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ email: inviteeEmail, role: "viewer" });

    // A different logged-in email cannot accept it.
    const stranger = await createUser();
    const wrong = await stranger.api(`/api/team/invite/${token}/accept`, { method: "POST" });
    expect(wrong.status).toBe(403);
    expect(wrong.body.error).toBe("EMAIL_MISMATCH");

    // The invitee accepts.
    const viewer = await createUser({ email: inviteeEmail, name: "Viewer Person" });
    const accepted = await viewer.api(`/api/team/invite/${token}/accept`, { method: "POST" });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    expect(accepted.body.member).toMatchObject({ role: "viewer", status: "active" });

    // Single-use: accepting wipes the token hash, so the same link is now unknown.
    const again = await viewer.api(`/api/team/invite/${token}/accept`, { method: "POST" });
    expect(again.status).toBe(404);
    expect((await api(`/api/team/invite/${token}`)).status).toBe(404);

    // Acting as the org: viewer sees the owner's quote …
    const list = await viewer.api("/api/quotes");
    expect(list.status).toBe(200);
    const ids = (list.body as { id: string }[]).map((q) => q.id);
    expect(ids).toContain(quote.id);

    // … but cannot edit or archive it, or manage the team.
    const edit = await viewer.api(`/api/quotes/${quote.id}/variants`, { body: { label: "Better" } });
    expect(edit.status).toBe(403);
    expect(edit.body.error).toBe("FORBIDDEN");
    const archive = await viewer.api(`/api/quotes/${quote.id}/archive`, { method: "POST" });
    expect(archive.status).toBe(403);
    const inviteAsViewer = await viewer.api("/api/team/members/invite", { body: { email: "x@example.invalid", role: "viewer" } });
    expect(inviteAsViewer.status).toBe(403);

    // The org switcher lists the membership.
    const orgs = await viewer.api("/api/team/orgs");
    expect(orgs.status).toBe(200);
    expect(JSON.stringify(orgs.body)).toContain(owner.userId);

    // Owner removes the member → viewer loses access to the org's data.
    const [member] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.invitedEmail, inviteeEmail));
    const removed = await owner.api(`/api/team/members/${member!.id}`, { method: "DELETE" });
    expect([200, 204]).toContain(removed.status);
    const after = await viewer.api("/api/quotes");
    const afterIds = after.status === 200 ? (after.body as { id: string }[]).map((q) => q.id) : [];
    expect(afterIds).not.toContain(quote.id);
  });

  test("seat limit and plan gate are enforced", async () => {
    const starter = await createOrg({ plan: "monthly_starter" });
    const gated = await starter.api("/api/team/members/invite", { body: { email: "a@example.invalid", role: "office", send: false } });
    expect(gated.status).toBe(403);
    expect(gated.body.error).toBe("PLAN_REQUIRED");

    const pro = await createOrg({ plan: "monthly_pro" });
    const seats = (await pro.api("/api/team/members")).body.seats.included as number;
    for (let i = 1; i < seats; i++) {
      const r = await pro.api("/api/team/members/invite", { body: { email: `seat${i}-${pro.userId}@example.invalid`, role: "office", send: false } });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
    }
    const overflow = await pro.api("/api/team/members/invite", { body: { email: `overflow-${pro.userId}@example.invalid`, role: "office", send: false } });
    expect(overflow.status).toBe(403);
    expect(overflow.body.error).toBe("SEAT_LIMIT");
  });
});
