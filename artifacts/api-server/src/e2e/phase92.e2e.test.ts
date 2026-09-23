// Phase 92 — the embed widget, loaded the way a contractor's site loads it.
//
// Two local origins stand in for the real ones: a "QuoteAI" origin that
// serves /widget.js (compiled from artifacts/quote-ai/src/widget/widget.ts,
// the same transform the Vite build applies) and forwards /api to the
// in-process app, and a "contractor site" on another port whose page carries
// the snippet exactly as Settings prints it — plus some hostile CSS. Chrome
// (playwright-core, like qa:visual) drives the visitor.
//
//  1. A visitor gets an estimate; the host page's CSS doesn't reach the form;
//     the contractor gets the lead, the draft quote and the email; the visitor
//     gets the receipt.
//  2. On a French page with the AI down, the form is in French and the
//     request still lands — a lead without a quote, the words kept — and the
//     visitor is told a quote will follow (in French, by email too).
//  3. A bad or revoked key shows a neutral "not available" box, nothing else.
//  4. The honeypot: answered like a success, nothing stored.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { transform } from "esbuild";
import { chromium, type Browser, type Page } from "playwright-core";
import { and, eq } from "drizzle-orm";
import { db, businessProfilesTable, leadsTable, leadEventsTable, quotesTable, clientsTable } from "@workspace/db";
import { startServer, stopServer, createOrg, cleanupAll, api, type TestUser } from "./harness.js";
import { stubHost, unstubHost, json } from "./vendorStub.js";
import { sentEmails, emailsTo } from "./mailbox.js";

const AI = "http://127.0.0.1:9/";
// Each state of the form, for a look by eye (gitignored).
const SHOTS = resolve(__dirname, "../../.qa/phase92");
const widget = (page: Page) => page.locator("#quoteai-widget");
/** Uncaught errors per page: the widget must never throw on a contractor site. */
const uncaught = new WeakMap<Page, string[]>();
const shot = (page: Page, name: string) => widget(page).screenshot({ path: resolve(SHOTS, `${name}.png`) });
const WIDGET_SRC = resolve(__dirname, "../../../quote-ai/src/widget/widget.ts");

const CANNED_QUOTE = {
  titolo_riga1: "Detailed Cost Analysis and Itemized Estimate",
  titolo_riga2: "Bathroom floor retile",
  numero_preventivo_data: "",
  cliente: { nome: "", indirizzo: "" },
  descrizione_generale: "Remove and retile a 120 sq ft bathroom floor.",
  capitoli: [
    {
      lettera: "A",
      titolo: "Flooring",
      osservazione: "",
      voci: [
        { descrizione: "Porcelain tile, supplied and installed", um: "sq ft", quantita: 120, prezzo_unitario: 12, totale: 1440 },
        { descrizione: "Demolition and disposal", um: "h", quantita: 16, prezzo_unitario: 85, totale: 1360 },
      ],
      subtotale: 2800,
    },
  ],
  sconto: { percentuale: 0, importo_scontato: 0 },
  condizioni_pagamento: [],
  subtotale: 0,
  iva_percentuale: 0,
  iva_valore: 0,
  totale: 0,
  note: "Quote generated via Widget",
};

function listen(server: http.Server): Promise<number> {
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok((server.address() as { port: number }).port)));
}

/** The snippet from Settings → Widget, byte for byte (anchor text aside). */
function snippet(quoteaiOrigin: string, apiKey: string): string {
  return `<!-- QuoteAI Widget Funnel -->
<div id="quoteai-widget">
  <a href="https://quoteai.ca" rel="noopener">Calculate your quote with QuoteAI</a>
</div>
<script
  src="${quoteaiOrigin}/widget.js"
  data-api-key="${apiKey}"
  async
></script>`;
}

function contractorPage(lang: "en" | "fr", body: string): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>Reno site</title>
<style>
  /* Hostile host styles: none of this may reach the widget. */
  * { font-family: "Comic Sans MS", cursive !important; }
  button { background: hotpink !important; font-size: 30px !important; }
  input, textarea, select, label, h2, p { color: #a00 !important; border: 3px dashed lime !important; }
</style></head><body><h1>Example Renovations</h1>${body}</body></html>`;
}

describe("Phase 92 — the embed widget", () => {
  let owner: TestUser;
  let apiKey = "";
  let quoteaiServer: http.Server;
  let siteServer: http.Server;
  let quoteaiOrigin = "";
  let siteOrigin = "";
  let browser: Browser;
  let widgetJs = "";

  beforeAll(async () => {
    const appBase = await startServer();
    apiKey = `e2e-widget-${randomUUID()}`;
    owner = await createOrg({ companyName: "Widget Test Reno", profile: { apiKey } });

    widgetJs = (await transform(await readFile(WIDGET_SRC, "utf8"), { loader: "ts", format: "iife", target: "es2019" })).code;
    const upstream = new URL(appBase);
    quoteaiServer = http.createServer((req, res) => {
      if (req.url?.startsWith("/widget.js")) {
        res.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
        res.end(widgetJs);
        return;
      }
      if (req.url?.startsWith("/api/")) {
        const up = http.request({ host: upstream.hostname, port: upstream.port, method: req.method, path: req.url, headers: { ...req.headers, host: upstream.host } }, (r) => {
          res.writeHead(r.statusCode ?? 502, r.headers);
          r.pipe(res);
        });
        up.on("error", () => res.writeHead(502).end());
        req.pipe(up);
        return;
      }
      res.writeHead(404).end();
    });
    quoteaiOrigin = `http://127.0.0.1:${await listen(quoteaiServer)}`;

    siteServer = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      const key = url.searchParams.get("key") ?? apiKey;
      const lang = url.pathname === "/fr" ? "fr" : "en";
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(contractorPage(lang, snippet(quoteaiOrigin, key)));
    });
    // "localhost" vs the 127.0.0.1 above: a different host as well as a different port — a real cross-site embed.
    siteOrigin = `http://localhost:${await listen(siteServer)}`;

    browser = await chromium.launch({ channel: process.env.QA_CHROME_PATH ? undefined : "chrome", executablePath: process.env.QA_CHROME_PATH, headless: true });
  });

  afterAll(async () => {
    unstubHost(AI);
    await browser?.close();
    await new Promise((ok) => quoteaiServer?.close(ok));
    await new Promise((ok) => siteServer?.close(ok));
    await cleanupAll();
    await stopServer();
  });

  async function open(path: string, width = 1280): Promise<Page> {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    uncaught.set(page, errors);
    await page.goto(`${siteOrigin}${path}`);
    return page;
  }

  test("a visitor gets an estimate and the contractor gets the lead", async () => {
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

    const page = await open("/");
    const w = widget(page);
    await expect.poll(() => w.getByRole("heading", { level: 2 }).textContent()).toBe("Get an estimate from Widget Test Reno");
    // The fallback link sits in the light DOM, unrendered under the shadow root.
    expect(await page.locator("#quoteai-widget > a").isVisible()).toBe(false);

    // The host's CSS stops at the shadow root.
    const next = w.getByRole("button", { name: "Next" });
    const look = await next.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, size: cs.fontSize, font: cs.fontFamily };
    });
    expect(look.bg).toBe("rgb(16, 16, 49)");
    expect(look.size).toBe("15px");
    expect(look.font).not.toMatch(/Comic/);

    // Required fields are checked in place and named to assistive tech.
    await next.click();
    const description = w.getByLabel("Describe the work");
    await expect.poll(() => description.getAttribute("aria-invalid")).toBe("true");
    expect(await w.getByText("Describe the work in a sentence or two").isVisible()).toBe(true);
    await shot(page, "en-1280-step1-errors");
    expect(await description.evaluate((el) => el === (el.getRootNode() as ShadowRoot).activeElement)).toBe(true);

    await description.fill("Retile our 120 sq ft bathroom floor, remove the old tile first.");
    await w.getByLabel("City").fill("Ottawa");
    await w.getByLabel("Province or territory").selectOption("ON");
    await next.click();

    await expect.poll(() => w.getByText("Step 2 of 2").isVisible()).toBe(true);
    await w.getByLabel("Your name").fill("Alex Martin");
    await w.getByLabel("Email").fill("e2e-p92-visitor@example.invalid");
    await w.getByRole("button", { name: "Get my estimate" }).click();
    // Consent is required.
    await expect.poll(() => w.getByText("Tick the box so they can contact you.").isVisible()).toBe(true);
    await shot(page, "en-1280-step2-errors");
    await w.getByLabel(/I agree that Widget Test Reno may contact me/).check();

    const submitted = page.evaluate(() => new Promise<{ quoteId: string | null; estimate: { min: number; max: number } | null }>((ok) => {
      document.getElementById("quoteai-widget")!.addEventListener("quoteai:submitted", (e) => ok((e as CustomEvent).detail), { once: true });
    }));
    await w.getByRole("button", { name: "Get my estimate" }).click();

    await expect.poll(() => w.getByRole("heading", { level: 2 }).textContent(), { timeout: 30_000 }).toBe("Thank you, Alex");
    // 2800 + 13% HST = 3164 → 90% / 125%.
    expect(await w.getByText("$2,848 – $3,955").isVisible()).toBe(true);
    expect(await w.getByText("A confirmation was sent to e2e-p92-visitor@example.invalid.").isVisible()).toBe(true);
    expect(await w.getByRole("link", { name: "(613) 555-0100" }).getAttribute("href")).toBe("tel:+16135550100");
    await shot(page, "en-1280-done");
    const detail = await submitted;
    expect(detail.quoteId).toMatch(/^[0-9a-f-]{36}$/);
    expect(detail.estimate).toMatchObject({ min: 2847.6, max: 3955 });

    // The contractor's side: a draft quote from the widget, a new lead pointing at it, the client filed.
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, detail.quoteId!));
    expect(quote).toMatchObject({ userId: owner.userId, source: "widget", status: "draft", totale: "3164.00" });
    const [lead] = await db.select().from(leadsTable).where(and(eq(leadsTable.userId, owner.userId), eq(leadsTable.quoteId, quote!.id)));
    expect(lead).toMatchObject({ source: "widget", status: "new", name: "Alex Martin", email: "e2e-p92-visitor@example.invalid", consentSource: "widget_form" });
    expect(lead!.clientId).toBe(quote!.clientId);
    const leads = await owner.api("/api/leads");
    expect(JSON.stringify(leads.body)).toContain("Alex Martin");

    await expect.poll(() => emailsTo("e2e-p92-visitor@example.invalid").length).toBeGreaterThan(0);
    expect(emailsTo("e2e-p92-visitor@example.invalid")[0]!.subject).toBe("Your request to Widget Test Reno has been received");
    expect(emailsTo("e2e-p92-visitor@example.invalid")[0]!.html).toContain("$2,848");
    await expect.poll(() => sentEmails.some((m) => m.subject === "New website lead — Alex Martin")).toBe(true);

    expect(uncaught.get(page)).toEqual([]);
    await page.close();
  });

  test("on a French page with the AI down, the request still lands", async () => {
    unstubHost(AI); // 127.0.0.1:9 is closed: the model call fails outright.
    const page = await open("/fr", 375);
    const w = widget(page);
    await expect.poll(() => w.getByRole("heading", { level: 2 }).textContent()).toBe("Obtenez une estimation de Widget Test Reno");
    await w.getByLabel("Décrivez les travaux").fill("Refaire la toiture d'un bungalow, environ 1400 pi², bardeaux d'asphalte.");
    await w.getByLabel("Ville").fill("Gatineau");
    await w.getByLabel("Province ou territoire").selectOption("QC");
    await w.getByRole("button", { name: "Suivant" }).click();
    await w.getByLabel("Votre nom").fill("Camille Roy");
    await w.getByLabel("Courriel").fill("e2e-p92-camille@example.invalid");
    await w.getByLabel("Téléphone").fill("819 555 0142");
    await w.getByLabel(/J'accepte que Widget Test Reno communique avec moi/).check();
    await shot(page, "fr-375-step2");
    await w.getByRole("button", { name: "Obtenir mon estimation" }).click();

    await expect.poll(() => w.getByRole("heading", { level: 2 }).textContent(), { timeout: 30_000 }).toBe("Merci, Camille");
    expect(await w.getByText("Widget Test Reno a bien reçu votre demande et vous enverra une soumission.").isVisible()).toBe(true);
    expect(await w.getByText(/\$/).count()).toBe(0);
    await shot(page, "fr-375-done-no-estimate");

    const [lead] = await db.select().from(leadsTable).where(and(eq(leadsTable.userId, owner.userId), eq(leadsTable.email, "e2e-p92-camille@example.invalid")));
    expect(lead).toMatchObject({ source: "widget", quoteId: null, phone: "819 555 0142" });
    expect(lead!.clientId).not.toBeNull();
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, lead!.clientId!));
    expect(client).toMatchObject({ name: "Camille Roy", province: "QC", preferredLanguage: "fr" });
    const events = await db.select().from(leadEventsTable).where(eq(leadEventsTable.leadId, lead!.id));
    expect(JSON.stringify(events.find((e) => e.type === "created")?.payload)).toContain("bardeaux");

    await expect.poll(() => emailsTo("e2e-p92-camille@example.invalid").length).toBeGreaterThan(0);
    const receipt = emailsTo("e2e-p92-camille@example.invalid")[0]!;
    expect(receipt.subject).toBe("Widget Test Reno a bien reçu votre demande");
    expect(receipt.html).toContain('lang="fr-CA"');
    expect(receipt.html).not.toContain("price-box\">");
    await expect.poll(() => sentEmails.some((m) => m.subject === "New website lead — Camille Roy" && m.html.includes("No automatic estimate"))).toBe(true);

    expect(uncaught.get(page)).toEqual([]);
    await page.close();
  });

  test("a bad or revoked key shows a neutral box", async () => {
    for (const key of ["not-a-real-key", ""]) {
      const page = await open(`/?key=${encodeURIComponent(key)}`);
      const w = widget(page);
      await expect.poll(() => w.getByRole("heading", { level: 2 }).textContent()).toBe("Online quotes are not available right now.");
      const text = (await w.evaluate((el) => el.shadowRoot!.textContent)) ?? "";
      if (key === "") await shot(page, "en-1280-unavailable");
      expect(text).not.toMatch(/API key|error|403|401|invalid/i);
      await page.close();
    }

    // Regenerating the key revokes the one on the contractor's site.
    const regen = await owner.api("/api/business-profile/apikey", { method: "POST" });
    expect(regen.status).toBe(200);
    const [profile] = await db.select({ apiKey: businessProfilesTable.apiKey }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, owner.userId));
    expect(profile!.apiKey).not.toBe(apiKey);
    const page = await open(`/?key=${encodeURIComponent(apiKey)}`);
    await expect.poll(() => widget(page).getByRole("heading", { level: 2 }).textContent()).toBe("Online quotes are not available right now.");
    await page.close();
    apiKey = profile!.apiKey!;
  });

  test("the honeypot is answered like a success and stores nothing", async () => {
    const before = await db.select({ id: leadsTable.id }).from(leadsTable).where(eq(leadsTable.userId, owner.userId));
    const res = await api("/api/public/quotes", {
      headers: { "x-api-key": apiKey },
      body: { rawInput: "Cheap roofing deals click here now", website: "http://spam.example", clientData: { nome: "Bot" } },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, quoteId: null, estimate: null });
    const after = await db.select({ id: leadsTable.id }).from(leadsTable).where(eq(leadsTable.userId, owner.userId));
    expect(after.length).toBe(before.length);
  });
});
