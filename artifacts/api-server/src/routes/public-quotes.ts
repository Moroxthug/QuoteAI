import { Router } from "express";
import { db, quotesTable, businessProfilesTable, priceCatalogItemsTable, leadsTable, leadEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { REGIONAL_PRICING_GUIDANCE, DESCRIPTION_QUALITY_GUIDANCE } from "../lib/generateQuoteFromText.js";
import { generateNumeroPreventivo } from "../lib/quoteNumber.js";
import { logger } from "../lib/logger.js";
import type { QuoteChapter, QuoteDiscount, QuoteClientData } from "@workspace/db";
import { sendWidgetLeadNotification, sendWidgetClientConfirmationEmail } from "../lib/email.js";
import { ipRateLimiter, apiKeyRateLimiter } from "../lib/rateLimit.js";
import { raiseAutomation } from "../lib/automation.js";
import { linkQuoteToClient } from "../lib/clients.js";
import { resolveQuoteTaxRate } from "../lib/tax.js";
import { FOLLOWUP_CADENCE_DAYS } from "../lib/leadMessaging.js";
import { calculateEstimate, sendDirectInvite } from "../lib/financeitClient.js";
import {
  getFinanceitConnection,
  getLatestFinanceitApplicationForQuote,
  recordFinanceitApplication,
  markFinanceitApplied,
} from "../financeit/service.js";

const router = Router();

const MAX_RAW_INPUT_LENGTH = 6000;

// /api/public/* is open to any origin (widget visitors on customer sites), so
// it's rate-limited both per source IP and per tenant API key — the latter
// caps damage if a single key is scraped/abused from many IPs.
const configLimiter = ipRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many requests. Try again shortly.",
});

const quoteIpLimiter = ipRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many quote requests from this IP address. Try again later.",
});

const quoteApiKeyLimiter = apiKeyRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: "Hourly quote limit reached for this account. Try again later.",
});

const quoteViewLimiter = ipRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many requests. Try again shortly.",
});

const quoteAcceptLimiter = ipRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many acceptance attempts from this IP address. Try again later.",
});

const MAX_ACCEPTED_NAME_LENGTH = 120;

const financeitEstimateLimiter = ipRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many requests. Try again shortly.",
});

const financeitApplyLimiter = ipRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many financing applications from this IP address. Try again later.",
});

// Public projection of the quote: always excludes userId, Stripe billing
// data, and internal AI metadata (costs/tokens) — this endpoint is not
// authenticated, the only "secret" is the quote's UUID itself.
function toPublicQuote(quote: typeof quotesTable.$inferSelect) {
  return {
    id: quote.id,
    numeroPreventivoData: quote.numeroPreventivoData,
    titoloPreventivoRiga1: quote.titoloPreventivoRiga1,
    titoloPreventivoRiga2: quote.titoloPreventivoRiga2,
    descrizioneGenerale: quote.descrizioneGenerale,
    clientData: quote.clientData,
    companySnapshot: quote.companySnapshot,
    capitoli: quote.capitoli,
    sconto: quote.sconto,
    condizioniPagamento: quote.condizioniPagamento,
    subtotale: quote.subtotale,
    ivaPercentuale: quote.ivaPercentuale,
    ivaValore: quote.ivaValore,
    totale: quote.totale,
    note: quote.note,
    pdfUrl: quote.pdfUrl,
    status: quote.status,
    acceptedAt: quote.acceptedAt,
    acceptedByName: quote.acceptedByName,
  };
}

// Helper in-memory semantic search for listino prices
function findRelevantCatalogItems(
  input: string,
  catalog: Array<typeof priceCatalogItemsTable.$inferSelect>,
  limit = 20
): Array<typeof priceCatalogItemsTable.$inferSelect> {
  if (catalog.length <= limit) return catalog;

  const words = input.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (words.length === 0) return catalog.slice(0, limit);

  const scored = catalog.map(item => {
    const nameLower = item.nome.toLowerCase();
    const catLower = (item.categoria || "").toLowerCase();
    const noteLower = (item.note || "").toLowerCase();

    let score = 0;
    for (const word of words) {
      if (nameLower.includes(word)) score += 3;
      if (catLower.includes(word)) score += 1.5;
      if (noteLower.includes(word)) score += 0.5;
    }
    return { item, score };
  });

  const filtered = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item);

  if (filtered.length < limit) {
    const addedIds = new Set(filtered.map(f => f.id));
    for (const item of catalog) {
      if (filtered.length >= limit) break;
      if (!addedIds.has(item.id)) {
        filtered.push(item);
        addedIds.add(item.id);
      }
    }
  }

  return filtered.slice(0, limit);
}

const AI_PROMPT = `You are an expert consultant for professional quotes in the Canadian market (tradespeople, construction, building systems, technical services).

You must turn a free-text description into a professional DETAILED COST ANALYSIS AND ITEMIZED ESTIMATE, structured into chapters, consistent with the owner's price list and with 2026 Canadian market estimates.

FUNDAMENTAL RULES:
1. Reference and catalog pricing (PRICE LIST):
   - If a "USER'S CUSTOM PRICE LIST" is provided, you MUST use the unit prices defined in it as the PRIORITY source for all matching or related work items.
   - Do not invent new unit prices if the item matches something already in the custom price list.
   - If a work item is not present in the custom price list, use realistic 2026 Canadian market prices.
2. If specific data is missing: make realistic assumptions, do NOT ask for clarification. If "PROPERTY MEASUREMENTS AND DIMENSIONS" are provided, you must use them rigorously to mathematically calculate quantities (sq ft, linear ft, etc.).
3. Organize the work into logical CHAPTERS (A, B, C, D, …) with professional titles (e.g. "Site Setup", "Demolition Work", "New Construction Work", "Electrical System", etc.)
4. Each chapter contains detailed work ITEMS with professional units of measure (sq ft, linear ft, cu ft, kg, hours, lump sum, pieces, each, kW, etc.)
5. Calculate a subtotal for each chapter. The SUMMARY TABLE is derived automatically from the capitoli array.
6. Do not assume a fixed sales tax rate — Canadian GST/HST varies by province (roughly 5-15%). Unless told otherwise, leave iva_percentuale at 0 and let the client-side settings apply the correct rate.
7. titolo_riga2 must describe the job.
8. numero_preventivo_data: DO NOT GENERATE — the server assigns the number automatically. Return an empty string.
9. Write all output text (titles, descriptions, notes) in English.

OUTPUT — ONLY VALID JSON, no extra text:
{
  "titolo_riga1": "Detailed Cost Analysis and Itemized Estimate",
  "titolo_riga2": "[Short job description]",
  "numero_preventivo_data": "",
  "cliente": { "nome": "", "indirizzo": "" },
  "descrizione_generale": "Brief description of the job",
  "capitoli": [
    {
      "lettera": "A",
      "titolo": "Works",
      "osservazione": "Standard item",
      "voci": [
        {
          "descrizione": "Item description",
          "um": "sq ft",
          "quantita": 10,
          "prezzo_unitario": 25.00,
          "totale": 250.00
        }
      ],
      "subtotale": 250.00
    }
  ],
  "sconto": { "percentuale": 0, "importo_scontato": 0 },
  "condizioni_pagamento": [],
  "subtotale": 0,
  "iva_percentuale": 0,
  "iva_valore": 0,
  "totale": 0,
  "note": "Quote generated via Widget"
}

VERY IMPORTANT: output ONLY pure JSON, no explanation, no markdown.`;

// GET /api/public/config (authenticated with x-api-key or apiKey query param)
router.get("/public/config", configLimiter, async (req, res) => {
  try {
    const apiKeyHeader = req.headers["x-api-key"] || req.query.apiKey;
    if (!apiKeyHeader) {
      res.status(401).json({ error: "Missing API key. Provide the x-api-key header or the apiKey query parameter." });
      return;
    }

    const apiKey = String(apiKeyHeader);

    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.apiKey, apiKey));

    if (!profile) {
      res.status(403).json({ error: "Invalid or inactive API key." });
      return;
    }

    // Load the price catalog to determine the supported categories
    const catalogItems = await db
      .select()
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, profile.userId));

    const categoriesSet = new Set<string>();
    for (const item of catalogItems) {
      if (item.categoria) {
        categoriesSet.add(item.categoria.trim());
      }
    }

    res.json({
      success: true,
      companyName: profile.companyName,
      logoUrl: profile.logoUrl,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      supportedCategories: Array.from(categoriesSet),
    });
  } catch (err) {
    logger.error({ err }, "Error fetching public widget config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/public/quotes (authenticated with x-api-key)
router.post("/public/quotes", quoteIpLimiter, quoteApiKeyLimiter, async (req, res) => {
  try {
    const apiKeyHeader = req.headers["x-api-key"] || req.query.apiKey;
    if (!apiKeyHeader) {
      res.status(401).json({ error: "Missing API key. Provide the x-api-key header or the apiKey query parameter." });
      return;
    }

    const apiKey = String(apiKeyHeader);

    // Find the business profile matching the API key
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.apiKey, apiKey));

    if (!profile) {
      res.status(403).json({ error: "Invalid or inactive API key." });
      return;
    }

    const userId = profile.userId;

    const { rawInput, clientData, misure } = req.body as {
      rawInput?: string;
      clientData?: { nome: string; email?: string; phone?: string; indirizzo?: string; city?: string; postalCode?: string; province?: string };
      misure?: Record<string, string | number>;
    };

    if (!rawInput || !rawInput.trim()) {
      res.status(400).json({ error: "The rawInput parameter is required." });
      return;
    }
    if (rawInput.length > MAX_RAW_INPUT_LENGTH) {
      res.status(400).json({ error: `Description too long (maximum ${MAX_RAW_INPUT_LENGTH} characters).` });
      return;
    }

    // Load the company's price list to run the RAG filter
    const catalogItems = await db
      .select()
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, userId))
      .orderBy(priceCatalogItemsTable.categoria, priceCatalogItemsTable.nome);

    const relevantCatalogItems = findRelevantCatalogItems(rawInput, catalogItems, 20);
    const catalogContext = relevantCatalogItems.length > 0
      ? `USER'S CUSTOM PRICE LIST (use these prices as the PRIORITY reference):
${relevantCatalogItems
  .map(item => `  - ${item.nome} (${item.um}): $${Number(item.prezzoUnitario).toFixed(2)}/unit${item.categoria ? ` [${item.categoria}]` : ""}`)
  .join("\n")}`
      : "";

    // Property measurements
    let misureContext = "";
    if (misure && typeof misure === "object" && Object.keys(misure).length > 0) {
      misureContext = `PROPERTY MEASUREMENTS AND DIMENSIONS:
${Object.entries(misure)
  .map(([key, val]) => `  - ${key}: ${val}`)
  .join("\n")}
Use these exact measurements to mathematically calculate the quantities.`;
    }

    // Location context (city/province the widget visitor provided) so the AI can price by zone
    const locationContext = clientData?.city || clientData?.province
      ? `JOB SITE LOCATION: ${[clientData?.city, clientData?.province ? `(${clientData.province})` : ""].filter(Boolean).join(" ")}`
      : "";

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 4096,
      temperature: 0.3,
      messages: [
        { role: "system", content: AI_PROMPT },
        { role: "system", content: REGIONAL_PRICING_GUIDANCE },
        { role: "system", content: DESCRIPTION_QUALITY_GUIDANCE },
        ...(catalogContext ? [{ role: "system" as const, content: catalogContext }] : []),
        ...(misureContext ? [{ role: "system" as const, content: misureContext }] : []),
        ...(locationContext ? [{ role: "system" as const, content: locationContext }] : []),
        { role: "user", content: rawInput },
      ],
    });

    const usage = completion.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? 0;
    const modelUsed = completion.model || "gpt-4o-mini";

    const isMini = modelUsed.includes("mini");
    const isGpt4 = modelUsed.includes("gpt-4o") && !isMini;
    const pCostRate = isMini ? 0.00000015 : isGpt4 ? 0.000005 : 0.00000059;
    const cCostRate = isMini ? 0.00000060 : isGpt4 ? 0.000015 : 0.00000079;
    const apiCost = ((promptTokens * pCostRate) + (completionTokens * cCostRate)).toFixed(6);

    const content = completion.choices[0]?.message?.content ?? "{}";
    let aiData: any = {};
    try {
      const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      aiData = JSON.parse(cleaned);
    } catch (err) {
      logger.error({ content }, "Failed to parse public API quote JSON");
      res.status(422).json({ error: "The AI could not structure the quote. Try again with a different description." });
      return;
    }

    // Chapters/totals are recomputed from quantita * prezzoUnitario rather than
    // trusted from the AI's own top-level fields, which can echo the prompt's
    // placeholder "0" values even when the per-item numbers are correct.
    let calculatedSubtotale = 0;
    const capitoli: QuoteChapter[] = (aiData.capitoli ?? []).map((cap: any) => {
      let capSubtotale = 0;
      const voci = (cap.voci ?? []).map((v: any) => {
        const quantita = Number(v.quantita ?? 0);
        const prezzoUnitario = Number(v.prezzo_unitario ?? 0);
        const totale = Number((quantita * prezzoUnitario).toFixed(2));
        capSubtotale += totale;
        return {
          descrizione: v.descrizione ?? "",
          um: v.um ?? "a.c.",
          quantita,
          prezzoUnitario,
          totale,
        };
      });
      calculatedSubtotale += capSubtotale;
      return {
        lettera: cap.lettera ?? "A",
        titolo: cap.titolo ?? "",
        osservazione: cap.osservazione ?? "Voce ordinaria",
        voci,
        subtotale: Number(capSubtotale.toFixed(2)),
      };
    });

    const subtotale = Number(calculatedSubtotale.toFixed(2));
    const ivaPercentuale = resolveQuoteTaxRate(aiData.iva_percentuale, profile.province);
    const ivaValore = Number((subtotale * ivaPercentuale / 100).toFixed(2));
    const totale = Number((subtotale + ivaValore).toFixed(2));

    const resolvedClientData: QuoteClientData = {
      nome: clientData?.nome || aiData.cliente?.nome || "Lead Widget",
      indirizzo: clientData?.indirizzo || aiData.cliente?.indirizzo || "",
      email: clientData?.email,
      phone: clientData?.phone,
      city: clientData?.city,
      postalCode: clientData?.postalCode,
      province: clientData?.province,
    };

    // Generate the quote number
    const numeroPreventivoData = await generateNumeroPreventivo(userId);

    // Insert the quote (implicitly capturing the CRM lead)
    const [quote] = await db
      .insert(quotesTable)
      .values({
        userId,
        rawInput,
        clientData: resolvedClientData,
        companySnapshot: {
          companyName: profile.companyName,
          vatNumber: profile.vatNumber ?? undefined,
          address: profile.address ?? undefined,
          phone: profile.phone ?? undefined,
          email: profile.email ?? undefined,
          logoUrl: profile.logoUrl ?? undefined,
        },
        descrizioneGenerale: aiData.descrizione_generale ?? "",
        items: [],
        capitoli,
        sconto: null,
        condizioniPagamento: aiData.condizioni_pagamento ?? [],
        titoloPreventivoRiga1: aiData.titolo_riga1 ?? "Analisi Economica e Computo Metrico Prezzato",
        titoloPreventivoRiga2: aiData.titolo_riga2 ?? "",
        numeroPreventivoData,
        subtotale: subtotale.toFixed(2),
        ivaPercentuale: ivaPercentuale.toFixed(2),
        ivaValore: ivaValore.toFixed(2),
        totale: totale.toFixed(2),
        note: aiData.note ?? "Quote generated via Widget",
        status: "draft",
        source: "widget", // Flag that it came from the widget
        promptTokens,
        completionTokens,
        totalTokens,
        modelUsed,
        apiCost,
      })
      .returning();

    await linkQuoteToClient(quote!, profile.province);

    // Phase 9: the widget submission is a lead first — record consent and
    // schedule the first follow-up here so a quote that's never accepted
    // still gets a nurture sequence instead of going cold silently.
    try {
      const [lead] = await db
        .insert(leadsTable)
        .values({
          userId,
          clientId: quote!.clientId,
          quoteId: quote!.id,
          name: resolvedClientData.nome,
          email: resolvedClientData.email || null,
          phone: resolvedClientData.phone || null,
          preferredChannel: "email",
          source: "widget",
          status: "new",
          consentSource: "widget_form",
          nextFollowUpAt: new Date(Date.now() + FOLLOWUP_CADENCE_DAYS[0]! * 86_400_000),
        })
        .returning();
      await db.insert(leadEventsTable).values({ leadId: lead!.id, userId, type: "created", payload: { source: "widget", quoteId: quote!.id } });
      await db.insert(leadEventsTable).values({ leadId: lead!.id, userId, type: "consent_recorded", payload: { consentSource: "widget_form" } });
    } catch (leadErr) {
      logger.error({ err: leadErr, quoteId: quote!.id }, "Failed to record widget lead (non-fatal)");
    }

    // Return the range estimate for the widget
    res.status(201).json({
      success: true,
      quoteId: quote.id,
      totale,
      prezzoMinimo: Math.round(totale * 0.9 * 100) / 100,
      prezzoMassimo: Math.round(totale * 1.25 * 100) / 100,
      descrizioneGenerale: quote.descrizioneGenerale,
    });

    // Send an async lead-notification email to the contractor
    const contractorEmail = profile.email || "notifiche@quoteai.ca";
    if (contractorEmail) {
      sendWidgetLeadNotification({
        toEmail: contractorEmail,
        companyName: profile.companyName,
        clientName: resolvedClientData.nome,
        clientEmail: resolvedClientData.email || "No email provided",
        clientPhone: resolvedClientData.phone || "No phone provided",
        rawInput: rawInput || "",
        totale: totale.toFixed(2),
        prezzoMinimo: (totale * 0.9).toFixed(2),
        prezzoMassimo: (totale * 1.25).toFixed(2),
      }).catch(emailErr => {
        logger.error({ err: emailErr }, "Failed to send lead email notification asynchronously");
      });
    }

    // Send an async confirmation email to the end client, if they provided an address
    const clientEmail = resolvedClientData.email;
    if (clientEmail && clientEmail.includes("@")) {
      sendWidgetClientConfirmationEmail({
        toEmail: clientEmail,
        clientName: resolvedClientData.nome,
        companyName: profile.companyName,
        companyPhone: profile.phone ?? null,
        companyEmail: profile.email ?? null,
        prezzoMinimo: (totale * 0.9).toFixed(2),
        prezzoMassimo: (totale * 1.25).toFixed(2),
        companyLogoUrl: profile.logoUrl ?? null,
      }).catch(emailErr => {
        logger.error({ err: emailErr }, "Failed to send client confirmation email asynchronously");
      });
    }
  } catch (err) {
    logger.error({ err }, "Error creating public widget quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/public/quotes/:id — read-only public view, used by the page the
// end client opens to review and accept the quote.
// Does not require authentication: the quote's UUID acts as the access
// token, following the same pattern already used for generated PDF links.
router.get("/public/quotes/:id", quoteViewLimiter, async (req, res) => {
  try {
    const id = req.params.id as string;

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    // "draft" or "pending_payment" quotes have not yet been unlocked by the
    // owner: don't expose them publicly, not even read-only.
    if (!quote || (quote.status !== "unlocked" && quote.status !== "accepted")) {
      res.status(404).json({ error: "Quote not found." });
      return;
    }

    res.json({ success: true, quote: toPublicQuote(quote) });
  } catch (err) {
    logger.error({ err }, "Error fetching public quote view");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/public/quotes/:id/accept — the end client confirms their name
// and accepts the quote. We record timestamp + IP as a minimal acceptance
// trail (this is not a qualified electronic signature, but it makes consent
// reasonably verifiable and non-repudiable).
router.post("/public/quotes/:id/accept", quoteAcceptLimiter, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { nomeConferma } = req.body as { nomeConferma?: string };

    const trimmedName = (nomeConferma || "").trim();
    if (!trimmedName) {
      res.status(400).json({ error: "Enter your first and last name to confirm acceptance." });
      return;
    }
    if (trimmedName.length > MAX_ACCEPTED_NAME_LENGTH) {
      res.status(400).json({ error: "Name too long." });
      return;
    }

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!quote || (quote.status !== "unlocked" && quote.status !== "accepted")) {
      res.status(404).json({ error: "Quote not found." });
      return;
    }

    if (quote.status === "accepted") {
      // Idempotent: if already accepted, simply return the current state
      // instead of overwriting who/when accepted it.
      res.json({ success: true, quote: toPublicQuote(quote) });
      return;
    }

    const [updated] = await db
      .update(quotesTable)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByName: trimmedName,
        acceptedIp: req.ip || null,
      })
      .where(eq(quotesTable.id, id))
      .returning();

    // Side effects (notify the company, later: draft the contract) run through
    // the automation runner so a failure never breaks the customer's flow.
    await raiseAutomation({
      event: "quote.accepted",
      userId: updated.userId,
      entityType: "quote",
      entityId: updated.id,
      payload: { acceptedByName: trimmedName },
    });

    res.json({ success: true, quote: toPublicQuote(updated) });
  } catch (err) {
    logger.error({ err }, "Error accepting public quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/public/quotes/:id/financeit/status — does the contractor behind
// this quote offer financing? Never exposes the userId or dealerId.
router.get("/public/quotes/:id/financeit/status", quoteViewLimiter, async (req, res) => {
  try {
    const id = req.params.id as string;
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote || (quote.status !== "unlocked" && quote.status !== "accepted")) {
      res.status(404).json({ error: "Quote not found." });
      return;
    }
    const conn = await getFinanceitConnection(quote.userId);
    const application = await getLatestFinanceitApplicationForQuote(id);
    res.json({
      available: !!conn?.isEnabled,
      application: application ? { status: application.status, applicationLink: application.applicationLink } : null,
    });
  } catch (err) {
    logger.error({ err }, "Error fetching public quote financing status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/public/quotes/:id/financeit/estimate — indicative monthly-payment
// estimate only, no application and no credit check.
router.post("/public/quotes/:id/financeit/estimate", financeitEstimateLimiter, async (req, res) => {
  try {
    const id = req.params.id as string;
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote || (quote.status !== "unlocked" && quote.status !== "accepted")) {
      res.status(404).json({ error: "Quote not found." });
      return;
    }
    const conn = await getFinanceitConnection(quote.userId);
    if (!conn?.isEnabled) {
      res.status(409).json({ error: "FINANCING_NOT_AVAILABLE" });
      return;
    }
    const amountCents = Math.round(Number(quote.totale) * 100);
    const estimate = await calculateEstimate(conn.dealerId, amountCents);
    res.json({ estimate });
  } catch (err) {
    logger.error({ err }, "Error calculating Financeit estimate");
    res.status(502).json({ error: "FINANCEIT_API_ERROR", message: "Couldn't reach Financeit — try again in a moment." });
  }
});

// POST /api/public/quotes/:id/financeit/apply — sends the customer Financeit's
// hosted application link (direct_invites/send); QuoteAI never sees loan data.
router.post("/public/quotes/:id/financeit/apply", financeitApplyLimiter, async (req, res) => {
  try {
    const id = req.params.id as string;
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote || (quote.status !== "unlocked" && quote.status !== "accepted")) {
      res.status(404).json({ error: "Quote not found." });
      return;
    }
    const conn = await getFinanceitConnection(quote.userId);
    if (!conn?.isEnabled) {
      res.status(409).json({ error: "FINANCING_NOT_AVAILABLE" });
      return;
    }
    const amountCents = Math.round(Number(quote.totale) * 100);
    const customerName = quote.clientData?.nome?.trim() || "Customer";
    const invite = await sendDirectInvite({
      dealerId: conn.dealerId,
      amountCents,
      referenceId: id,
      customerName,
      customerEmail: quote.clientData?.email ?? null,
      customerPhone: quote.clientData?.phone ?? null,
    });
    const application = await recordFinanceitApplication({
      userId: quote.userId,
      quoteId: id,
      dealerId: conn.dealerId,
      financeitApplicationId: invite.applicationId,
      applicationLink: invite.applicationLink,
    });
    await markFinanceitApplied(quote.userId);
    res.json({ applicationLink: application.applicationLink });
  } catch (err) {
    logger.error({ err }, "Error starting Financeit application");
    res.status(502).json({ error: "FINANCEIT_API_ERROR", message: "Couldn't reach Financeit — try again in a moment." });
  }
});

export default router;
