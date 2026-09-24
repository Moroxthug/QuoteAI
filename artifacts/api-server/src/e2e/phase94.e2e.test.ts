// Phase 94 — the quote forms ask for the client's email and phone.
//
//  1. An AI quote written with an email and a phone keeps both on the quote
//     and on the client record (the AI route used to drop them).
//  2. A manual quote does the same.
//  3. A client first saved by name alone (every quote before this phase) is
//     the same person: a later quote with their email fills in the record
//     instead of starting a second one.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, clientsTable, quotesTable } from "@workspace/db";
import { startServer, stopServer, createOrg, cleanupAll } from "./harness.js";
import { stubHost, unstubHost, json } from "./vendorStub.js";

const AI = "http://127.0.0.1:9/";

const CANNED_QUOTE = {
  titolo_riga1: "Detailed Cost Analysis and Itemized Estimate",
  titolo_riga2: "Deck staining",
  numero_preventivo_data: "",
  cliente: { nome: "", indirizzo: "" },
  descrizione_generale: "Clean and stain a 300 sq ft deck.",
  capitoli: [
    {
      lettera: "A",
      titolo: "Deck",
      osservazione: "",
      voci: [{ descrizione: "Wash, sand and stain", um: "sq ft", quantita: 300, prezzo_unitario: 4, totale: 1200 }],
      subtotale: 1200,
    },
  ],
  sconto: { percentuale: 0, importo_scontato: 0 },
  condizioni_pagamento: [],
  note: "",
};

const CAPITOLI = [{ lettera: "A", titolo: "Work", voci: [{ descrizione: "Paint two rooms", um: "lot", quantita: 1, prezzoUnitario: 900, totale: 0 }], subtotale: 0 }];

const clientsOf = (userId: string) => db.select().from(clientsTable).where(eq(clientsTable.userId, userId));

describe("phase 94: client email and phone on the quote forms", () => {
  beforeAll(async () => {
    await startServer();
    stubHost(AI, (req) => {
      if (!req.url.endsWith("/chat/completions")) return json(599, { error: "unexpected", url: req.url });
      return json(200, {
        id: "chatcmpl-e2e",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "gpt-4o-mini",
        choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(CANNED_QUOTE) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 900, completion_tokens: 300, total_tokens: 1200 },
      });
    });
  });

  afterAll(async () => {
    unstubHost(AI);
    await cleanupAll();
    await stopServer();
  });

  test("an AI quote keeps the client's email and phone, on the quote and the client record", async () => {
    const org = await createOrg();
    const form = new FormData();
    form.set("rawInput", "Stain a 300 sq ft deck in the backyard.");
    form.set("clientData", JSON.stringify({ nome: "Priya Deck", indirizzo: "4 Oak Ave", city: "Ottawa", province: "ON", email: " priya@example.com ", phone: "613-555-0142" }));
    const created = await org.api("/api/quotes", { form });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, created.body.id));
    expect(quote!.clientData).toMatchObject({ nome: "Priya Deck", email: "priya@example.com", phone: "613-555-0142" });

    const clients = await clientsOf(org.userId);
    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({ name: "Priya Deck", email: "priya@example.com", phone: "613-555-0142", city: "Ottawa" });
    expect(quote!.clientId).toBe(clients[0]!.id);

    // The Clients list (the picker on the quote form) now carries them too.
    const listed = await org.api("/api/clients");
    expect(listed.body).toEqual([expect.objectContaining({ clientName: "Priya Deck", email: "priya@example.com", phone: "613-555-0142" })]);
  });

  test("a manual quote does the same", async () => {
    const org = await createOrg();
    const created = await org.api("/api/quotes/manual", {
      body: { capitoli: CAPITOLI, clientData: { nome: "Sam Painter", indirizzo: "", email: "sam@example.com", phone: "416-555-0100" } },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const clients = await clientsOf(org.userId);
    expect(clients).toEqual([expect.objectContaining({ name: "Sam Painter", email: "sam@example.com", phone: "416-555-0100" })]);
  });

  test("a client saved by name alone gets the details filled in, not a second record", async () => {
    const org = await createOrg();
    const first = await org.api("/api/quotes/manual", { body: { capitoli: CAPITOLI, clientData: { nome: "Lee Nguyen", indirizzo: "9 Birch Rd" } } });
    expect(first.status).toBe(201);
    const [before] = await clientsOf(org.userId);
    expect(before).toMatchObject({ name: "Lee Nguyen", email: null, phone: null });

    const second = await org.api("/api/quotes/manual", {
      body: { capitoli: CAPITOLI, clientData: { nome: "lee nguyen ", indirizzo: "", email: "lee@example.com", phone: "905-555-0199" } },
    });
    expect(second.status).toBe(201);

    const after = await clientsOf(org.userId);
    expect(after).toHaveLength(1);
    // Blanks filled; what was there (the address) is kept.
    expect(after[0]).toMatchObject({ id: before!.id, name: "Lee Nguyen", email: "lee@example.com", phone: "905-555-0199", address: "9 Birch Rd" });
    const [q2] = await db.select({ clientId: quotesTable.clientId }).from(quotesTable).where(and(eq(quotesTable.id, second.body.id), eq(quotesTable.userId, org.userId)));
    expect(q2!.clientId).toBe(before!.id);

    // A different person with the same name and their own email still gets their own record.
    await org.api("/api/quotes/manual", { body: { capitoli: CAPITOLI, clientData: { nome: "Lee Nguyen", indirizzo: "", email: "other.lee@example.com" } } });
    expect(await clientsOf(org.userId)).toHaveLength(2);
  });
});
