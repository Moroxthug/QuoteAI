// Phase 63 — quote-side features over HTTP:
//  • archive → excluded from the list → shows in /archive → restore (Phase 47)
//  • Good/Better/Best variants: create, cap at 3, the public page must pick one,
//    and the chosen variant's pricing lands on the parent quote (Phase 22)
//  • spreadsheet import → review queue → confirm creates a real quote + client (Phase 14)

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, quotesTable, clientsTable, quoteImportCandidatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import "../automations/index.js";
import { startServer, stopServer, createOrg, createUser, seedQuote, cleanupAll, api } from "./harness.js";
import { sentEmails } from "./mailbox.js";

describe("quotes: archive, variants, import", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("archive hides the quote from the list, restore brings it back", async () => {
    const org = await createOrg();
    const quote = await seedQuote(org.userId);
    const listIds = async () => ((await org.api("/api/quotes")).body as { id: string }[]).map((q) => q.id);

    expect(await listIds()).toContain(quote.id);

    const archived = await org.api(`/api/quotes/${quote.id}/archive`, { method: "POST" });
    expect(archived.status, JSON.stringify(archived.body)).toBe(200);
    expect(await listIds()).not.toContain(quote.id);

    const bin = await org.api("/api/archive");
    expect(bin.status).toBe(200);
    expect(bin.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: quote.id, type: "quote", archivedByName: org.name })]));

    // Another org can neither see nor restore it.
    const other = await createOrg();
    expect((await other.api("/api/archive")).body.items.map((i: { id: string }) => i.id)).not.toContain(quote.id);
    expect((await other.api(`/api/quotes/${quote.id}/restore`, { method: "POST" })).status).toBe(403);

    const restored = await org.api(`/api/quotes/${quote.id}/restore`, { method: "POST" });
    expect(restored.status).toBe(200);
    expect(await listIds()).toContain(quote.id);
    expect((await org.api("/api/archive")).body.items).toHaveLength(0);
  });

  test("variants: max three, customer must choose, choice is copied onto the quote", async () => {
    const org = await createOrg();
    const quote = await seedQuote(org.userId);

    const good = await org.api(`/api/quotes/${quote.id}/variants`, { body: {} });
    expect(good.status, JSON.stringify(good.body)).toBe(201);
    expect(good.body.label).toBe("Good");
    const better = await org.api(`/api/quotes/${quote.id}/variants`, { body: { label: "Better" } });
    const best = await org.api(`/api/quotes/${quote.id}/variants`, { body: { label: "Best" } });
    expect(best.status).toBe(201);
    const fourth = await org.api(`/api/quotes/${quote.id}/variants`, { body: { label: "Ultra" } });
    expect(fourth.status).toBe(400);

    // Re-price "Best" to $12,000 so we can tell which one the customer picked.
    const bestCapitoli = [
      { lettera: "A", titolo: "Demolition and prep", subtotale: 4000, voci: [{ descrizione: "Demo existing cabinets", quantita: 1, um: "lot", prezzoUnitario: 4000, totale: 4000 }] },
      { lettera: "B", titolo: "Premium cabinets", subtotale: 8000, voci: [{ descrizione: "Install premium cabinets", quantita: 1, um: "lot", prezzoUnitario: 8000, totale: 8000 }] },
    ];
    const updated = await org.api(`/api/quotes/${quote.id}/variants/${best.body.id}`, { method: "PUT", body: { capitoli: bestCapitoli, subtotale: 12000, totale: 12000 } });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);

    const listed = await org.api(`/api/quotes/${quote.id}/variants`);
    expect(listed.body.variants.map((v: { label: string }) => v.label)).toEqual(["Good", "Better", "Best"]);

    // Public page exposes the options; accepting without a choice is refused.
    const pub = await api(`/api/public/quotes/${quote.id}`);
    expect(pub.status).toBe(200);
    expect(pub.body.quote.variants).toHaveLength(3);
    const noChoice = await api(`/api/public/quotes/${quote.id}/accept`, { body: { nomeConferma: "Jordan Client" } });
    expect(noChoice.status).toBe(400);

    const accepted = await api(`/api/public/quotes/${quote.id}/accept`, { body: { nomeConferma: "Jordan Client", variantId: best.body.id } });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);

    const [row] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
    expect(row!.status).toBe("accepted");
    expect(row!.acceptedVariantId).toBe(best.body.id);
    expect(Number(row!.totale)).toBe(12000);
    expect((row!.capitoli as { titolo: string }[])[1]!.titolo).toBe("Premium cabinets");
    void better;
  });

  test("spreadsheet import: rows land in the review queue, confirm creates quote + client", async () => {
    const org = await createOrg();
    const csv =
      "Client Name,Email,Phone,Address,City,Province,Postal Code,Quote Date,Status,Description,Quantity,Unit Price,Total,Notes\n" +
      `Imported Person,imported-${org.userId}@example.invalid,613-555-0100,123 Main St,Ottawa,ON,K1A0B1,2025-03-15,accepted,Bathroom renovation,1,8500,8500,Paid in full\n` +
      ",,,,,,,,,No client on this row,1,100,100,\n";
    const form = new FormData();
    form.append("file", new Blob([csv], { type: "text/csv" }), "quotes.csv");
    const upload = await org.api("/api/imports/spreadsheet", { form });
    expect(upload.status, JSON.stringify(upload.body)).toBe(201);
    expect(upload.body.totalRows).toBe(2);

    const queue = await org.api("/api/imports/candidates");
    expect(queue.status).toBe(200);
    const candidates = queue.body.candidates as { id: string; status: string; extraction: { clientName?: string } }[];
    expect(candidates.filter((c) => c.status === "pending_review")).toHaveLength(2);
    const withClient = candidates.find((c) => c.extraction.clientName === "Imported Person")!;
    const withoutClient = candidates.find((c) => !c.extraction.clientName)!;

    // Missing client name blocks confirm; reject works.
    expect((await org.api(`/api/imports/candidates/${withoutClient.id}/confirm`, { method: "POST" })).status).toBe(400);
    expect((await org.api(`/api/imports/candidates/${withoutClient.id}/reject`, { method: "POST" })).status).toBe(200);

    const confirmed = await org.api(`/api/imports/candidates/${withClient.id}/confirm`, { method: "POST" });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, confirmed.body.quoteId));
    expect(quote!.userId).toBe(org.userId);
    expect(Number(quote!.totale)).toBe(8500);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, confirmed.body.clientId));
    expect(client!.name).toBe("Imported Person");

    // Confirming twice is refused.
    expect((await org.api(`/api/imports/candidates/${withClient.id}/confirm`, { method: "POST" })).status).toBe(409);
    const [cand] = await db.select().from(quoteImportCandidatesTable).where(eq(quoteImportCandidatesTable.id, withClient.id));
    expect(cand!.status).not.toBe("pending_review");

    // Another org cannot touch this queue.
    const stranger = await createUser();
    expect((await stranger.api(`/api/imports/candidates/${withClient.id}/reject`, { method: "POST" })).status).not.toBe(200);
  });
});

// Phase 66 — bugs found in the functional walkthrough, pinned here.
describe("quotes: unlock + send lifecycle (Phase 66)", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("a trial user can email a draft: it unlocks, spends a trial download and remembers the client email", async () => {
    const org = await createOrg({ plan: "free", profile: { trialStartedAt: new Date() } });
    const quote = await seedQuote(org.userId, { status: "draft" });
    // The quote forms never collect an email — mirror that.
    const { email: _dropped, ...clientNoEmail } = quote.clientData!;
    await db.update(quotesTable).set({ clientData: clientNoEmail }).where(eq(quotesTable.id, quote.id));
    const before = sentEmails.length;

    const sent = await org.api(`/api/quotes/${quote.id}/send-pdf-email`, { method: "POST", body: { toEmail: "walkthrough.client@example.invalid", clientName: "Jordan" } });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(sentEmails.length).toBe(before + 1);
    expect(sentEmails.at(-1)!.html).toContain(`/p/${quote.id}`); // the public link is in the email

    const [row] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
    expect(row!.status).toBe("unlocked");
    expect(row!.unlockedWithPlan).toBe("trial");
    expect(row!.clientData?.email).toBe("walkthrough.client@example.invalid");
    expect(row!.nextFollowUpAt).not.toBeNull();
    expect((await org.api("/api/payments/trial-status")).body.trialDownloadsUsed).toBe(1);
    // The CRM client got the address too.
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, row!.clientId!));
    expect(client!.email).toBe("walkthrough.client@example.invalid");
  });

  test("a subscriber's unlock-quote never reverts an accepted quote, and stats count accepted as unlocked", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "unlocked" });
    const accepted = await api(`/api/public/quotes/${quote.id}/accept`, { method: "POST", body: { nomeConferma: "Jordan Client" } });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);

    // The quote page calls this on open for every subscriber.
    const unlock = await org.api("/api/payments/unlock-quote", { method: "POST", body: { quoteId: quote.id } });
    expect(unlock.status).toBe(200);
    expect(unlock.body.status).toBe("accepted");
    const detail = await org.api(`/api/quotes/${quote.id}`);
    expect(detail.body.status).toBe("accepted");
    expect(detail.body.acceptedByName).toBe("Jordan Client");

    const stats = await org.api("/api/quotes/stats");
    expect(stats.body.unlocked).toBe(1);
    expect(stats.body.accepted).toBe(1);
    expect(stats.body.unlockedRevenue).toBe(10000);

    // A draft is unlocked with the plan, exactly once.
    const draft = await seedQuote(org.userId, { status: "draft" });
    expect((await org.api("/api/payments/unlock-quote", { method: "POST", body: { quoteId: draft.id } })).body.status).toBe("unlocked");
  });
});
