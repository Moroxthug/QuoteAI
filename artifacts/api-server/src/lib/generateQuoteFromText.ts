import { db, quotesTable, businessProfilesTable, priceCatalogItemsTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import type { QuoteChapter, QuoteDiscount, QuoteCompanySnapshot, QuoteClientData } from "@workspace/db";
import type { Logger } from "pino";
import { trackEvent } from "./telemetry.js";
import { linkQuoteToClient } from "./clients.js";
import { resolveQuoteTaxRate } from "./tax.js";
import { recordAiUsage } from "./usage.js";

export const AI_PROMPT = `You are an expert consultant for professional quotes for the Canadian market (tradespeople, construction, building systems, technical services).

You must turn a free-form description into a professional ECONOMIC ANALYSIS AND PRICED BILL OF QUANTITIES, structured into chapters, consistent with 2026 Canadian market prices.

FUNDAMENTAL RULES:
1. Realistic 2026 Canadian market prices:
   - COMPLETE "TURNKEY" RENOVATION (Whole house/apartment):
     A complete renovation includes demolition, new building systems (electrical/plumbing), subfloor/screed, flooring, painting, and any windows/doors. Real total costs per sqm are:
     * Economy/Basic tier: $600 - $850 CAD/sqm (e.g. for 145 sqm the total should be between $87,000 and $123,000)
     * Mid/Standard tier: $850 - $1,200 CAD/sqm (e.g. for 145 sqm the total should be between $123,000 and $174,000)
     * High-end/Luxury tier: $1,200 - $1,800+ CAD/sqm (e.g. for 145 sqm the total exceeds $174,000)
     If the user requests a "complete renovation" without specifying a tier, use the Mid tier as a reference (about $950-1,050 CAD/sqm) and generate detailed line items (demolition, structural/masonry work, building systems, finishes, general labour support) that, added together, consistently reach this overall amount.
   - COMPLETE BATHROOM REMODEL: $8,000 - $15,000 CAD (demolition, plumbing rework, fixtures, faucets/taps, tile installation).
   - COMPLETE KITCHEN REMODEL: $8,000 - $16,000 CAD (construction and plumbing work).
   - COMPLETE ELECTRICAL SYSTEM: $120 - $180 CAD per code-compliant outlet/light point, or roughly $8,000 - $15,000 CAD for an average home (about $90-110 CAD/sqm).
   - HEATING/PLUMBING SYSTEM: $8,000 - $18,000 CAD depending on size (piping, manifolds, boiler/heat pump).
   - DEMOLITION AND REMOVAL: $35 - $70 CAD/sqm (removal of flooring, subfloor, partition walls, including disposal/haul-away).
   - FLOORING AND TILE INSTALLATION: $40 - $70 CAD/sqm (materials excluded). SUBFLOOR/SCREED: $35 - $55 CAD/sqm.
   - PAINTER: $25-40 CAD/sqm for standard two-coat painting, $45-70 CAD/sqm for specialty work or wall skim-coating/prep.
   - HOURLY LABOUR RATES:
     * general labourer/mason: $45-75 CAD/hour
     * electrician: $65-110 CAD/hour
     * plumber: $70-120 CAD/hour
     * carpenter/joiner: $55-95 CAD/hour
     * painter: $40-65 CAD/hour
2. If specific details are missing: make realistic assumptions, do NOT ask for clarification
3. Organize the work into logical CHAPTERS (A, B, C, D, …) with professional titles
4. Each chapter contains detailed work LINE ITEMS with professional units of measure (sqm, linear m, cubic m, kg, hours, lump sum, pieces, each, kW, etc.)
5. Calculate a subtotal for each chapter.
6. Apply a discount ONLY if the user explicitly requests one; otherwise percentage: 0
7. Payment terms must follow Canadian norms, NOT a large upfront deposit: a small deposit of 10-15% on signing, one or two progress payments tied to milestones (e.g. on material delivery/start of work, and on substantial completion) making up the bulk of the total, and a final holdback of 10-15% released only after the client has inspected and approved the completed work. Never default to a deposit larger than 15% — many provinces (e.g. Ontario, Quebec) treat large upfront deposits as a red flag and some regulate maximum deposits for consumer home-renovation contracts.
8. Always include applicable sales tax at 13% (Canadian HST) unless otherwise indicated
9. titolo_riga2 must describe the project and the job-site location
10. numero_preventivo_data: DO NOT GENERATE — the server assigns the number automatically. Return an empty string.
11. descrizione_generale must be a real 2-4 sentence plain-English summary of the project scope (what is being done, where, and the general approach) — never a placeholder or a one-line restatement of the title.
12. note must be a short client-facing closing paragraph that always covers: the quote's validity period (e.g. 30 days), a one-line statement of what is NOT included (permits, unforeseen conditions behind walls/floors, work not explicitly listed above, etc.), and a brief workmanship-warranty statement (e.g. "Workmanship is guaranteed for 1 year from completion; manufacturer warranties apply to materials and fixtures.").

OUTPUT — VALID JSON ONLY, no extra text:
{
  "titolo_riga1": "Project Quote & Itemized Estimate",
  "titolo_riga2": "Project: [brief description] – [City] ([Province])",
  "numero_preventivo_data": "",
  "cliente": { "nome": "", "indirizzo": "" },
  "descrizione_generale": "2-4 sentence plain-English summary of the project scope, approach, and location.",
  "capitoli": [
    {
      "lettera": "A",
      "titolo": "Site setup",
      "osservazione": "Standard item",
      "voci": [
        {
          "descrizione": "Complete job site setup",
          "um": "lump sum",
          "quantita": 1,
          "prezzo_unitario": 2500.00,
          "totale": 2500.00
        }
      ],
      "subtotale": 2500.00
    }
  ],
  "sconto": { "percentuale": 0, "importo_scontato": 0 },
  "condizioni_pagamento": [
    "15% deposit upon contract signing",
    "35% upon delivery of materials and start of work",
    "35% upon substantial completion",
    "15% final balance upon completion and client walkthrough"
  ],
  "subtotale": 0,
  "iva_percentuale": 13,
  "iva_valore": 0,
  "totale": 0,
  "note": "Quote valid for 30 days from the issue date. Excludes permits, unforeseen conditions behind existing walls/floors, and any work not explicitly listed above. Workmanship is guaranteed for 1 year from completion; manufacturer warranties apply to materials and fixtures."
}

CALCULATIONS:
- subtotale = sum of all chapter subtotals
- If sconto = 0: iva_valore = subtotale * iva_percentuale/100; totale = subtotale + iva_valore

VERY IMPORTANT: output ONLY pure JSON, no explanation, no markdown.`;

export const REGIONAL_PRICING_GUIDANCE = `GEOGRAPHIC PRICE ADJUSTMENT:
If the text, the client's address, or the job-site location makes it possible to identify the Canadian province or city, adjust unit prices according to the real variation in construction/trade labour costs across Canada:
- High-cost provinces/regions (British Columbia, Ontario — especially the Greater Toronto Area): +10/+20% above the national average prices indicated in the rules above.
- Mid-range provinces (Quebec, Alberta): in line with the national average prices indicated.
- Lower-cost provinces/regions (Atlantic Canada, Manitoba, Saskatchewan): -15/-25% below the national average prices indicated.
- High-cost metropolitan areas (Toronto, Vancouver, Calgary, Ottawa): use the high end of the indicated range, even exceeding it slightly (up to +10% above the maximum) for labour.
- If no location can be identified, use the national average prices indicated without applying any adjustment.
Apply the adjustment consistently to ALL line items in the quote (labour and materials), not just to the final total — the unit prices of each line item must already reflect the region.`;

export const DESCRIPTION_QUALITY_GUIDANCE = `DESCRIPTION QUALITY:
Every line item (the "descrizione" field) must be specific and professional, never generic: state precisely what is being done, and when relevant, with which materials, techniques, or execution methods (e.g. "Two-coat painting of walls and ceilings with washable breathable paint, including prior patching and sanding" instead of "Painting"). Avoid vague items such as "Various work", "General labour" or "Building materials" without further detail. If images are attached, use the visible details (condition of the space, surfaces, existing finishes, readable measurements) to make the line items more precise and to better calibrate quantities and prices.`;

export const CAPITOLATO_CONTEXT = `PROFESSIONAL TECHNICAL SPECIFICATION MODE:
For every work item, write the description in the style of a formal TECHNICAL SPECIFICATION (spec sheet), with AT LEAST 4-6 technical lines in formal English:
- Precisely describe the operations performed and the execution methods (workflow, techniques, sequence of phases)
- Specify materials, products, and components with technical characteristics and applicable Canadian/North American standards (National Building Code of Canada, CSA, ULC, ASTM, provincial building codes)
- State the quality, strength, class, or certification requirements for the materials
- Explicitly state what is INCLUDED in the item (supply, labour, loading, transport, disposal)
- State any relevant EXCLUSIONS and/or costs that remain the client's responsibility
- Use professional Canadian construction/trades terminology
Example: "Demolition and removal of existing ceramic tile flooring, including detachment by mechanical chipping and removal of the setting bed/screed to an average depth of 5 cm. Includes loading, transport, and disposal of debris at a licensed disposal facility in accordance with applicable provincial waste-disposal regulations. Excludes structural subfloor repair and waterproofing work."`;

// ── Public types ────────────────────────────────────────────────────────────────

export type PendingQuoteData = {
  rawInput: string;
  titoloPreventivoRiga1: string;
  titoloPreventivoRiga2: string;
  numeroPreventivoData: string;
  clientData: QuoteClientData;
  companySnapshot: QuoteCompanySnapshot | null;
  descrizioneGenerale: string;
  capitoli: QuoteChapter[];
  sconto: QuoteDiscount | null;
  condizioniPagamento: string[];
  subtotale: string;
  ivaPercentuale: string;
  ivaValore: string;
  totale: string;
  note: string;
  capitolatoPro: boolean;
  templateId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  modelUsed?: string;
  apiCost?: number;
};

// ── Internal helpers ────────────────────────────────────────────────────────────

function parseAiResponse(content: string, rawInput: string, profile: typeof businessProfilesTable.$inferSelect | undefined, templateId?: string): PendingQuoteData {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const aiData = JSON.parse(cleaned) as AiQuoteData;

  let calculatedSubtotale = 0;

  const capitoli: QuoteChapter[] = (aiData.capitoli ?? []).map((cap) => {
    let capSubtotale = 0;
    const voci = (cap.voci ?? []).map((v) => {
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

    calculatedSubtotale += Number(capSubtotale.toFixed(2));

    return {
      lettera: cap.lettera ?? "A",
      titolo: cap.titolo ?? "",
      osservazione: cap.osservazione ?? "Voce ordinaria",
      voci,
      subtotale: Number(capSubtotale.toFixed(2)),
    };
  });

  const scontoRaw = aiData.sconto;
  const scontoPercentuale = scontoRaw ? Number(scontoRaw.percentuale ?? 0) : 0;
  
  let importoScontato = 0;
  let sconto: QuoteDiscount | null = null;
  if (scontoPercentuale > 0) {
    importoScontato = Number((calculatedSubtotale * scontoPercentuale / 100).toFixed(2));
    sconto = {
      percentuale: scontoPercentuale,
      importoScontato,
    };
  }

  const imponibile = Number((calculatedSubtotale - importoScontato).toFixed(2));
  const ivaPercentualeVal = resolveQuoteTaxRate(aiData.iva_percentuale, profile?.province);
  const ivaValoreVal = Number((imponibile * ivaPercentualeVal / 100).toFixed(2));
  const totaleVal = Number((imponibile + ivaValoreVal).toFixed(2));

  const resolvedSnapshot: QuoteCompanySnapshot | null = profile
    ? {
        companyName: profile.companyName,
        vatNumber: profile.vatNumber ?? undefined,
        address: profile.address ?? undefined,
        phone: profile.phone ?? undefined,
        email: profile.email ?? undefined,
        logoUrl: profile.logoUrl ?? undefined,
      }
    : null;

  return {
    rawInput,
    titoloPreventivoRiga1: aiData.titolo_riga1 ?? "Project Quote & Itemized Estimate",
    titoloPreventivoRiga2: aiData.titolo_riga2 ?? "",
    numeroPreventivoData: aiData.numero_preventivo_data ?? "",
    clientData: { nome: aiData.cliente?.nome ?? "", indirizzo: aiData.cliente?.indirizzo ?? "" },
    companySnapshot: resolvedSnapshot,
    descrizioneGenerale: aiData.descrizione_generale ?? "",
    capitoli,
    sconto,
    condizioniPagamento: aiData.condizioni_pagamento ?? [
      "15% deposit upon contract signing",
      "35% upon delivery of materials and start of work",
      "35% upon substantial completion",
      "15% final balance upon completion and client walkthrough",
    ],
    subtotale: calculatedSubtotale.toFixed(2),
    ivaPercentuale: ivaPercentualeVal.toFixed(2),
    ivaValore: ivaValoreVal.toFixed(2),
    totale: totaleVal.toFixed(2),
    note: aiData.note ?? "Quote valid for 30 days from the issue date. Excludes permits, unforeseen conditions behind existing walls/floors, and any work not explicitly listed above.",
    capitolatoPro: !!(profile?.subscriptionStatus === "active" && (profile?.subscriptionPlan === "monthly_pro" || profile?.subscriptionPlan === "monthly_elite")),
    templateId,
  };
}

// ── Exported API ────────────────────────────────────────────────────────────────

/**
 * Calls the AI and returns quote data WITHOUT saving to the DB.
 * Use this for the WhatsApp preview-first flow.
 */
export async function buildQuoteFromAI({
  userId,
  rawInput,
  log,
  templateId,
  clientData,
  imageDataUrls,
}: {
  userId: string;
  rawInput: string;
  log: Logger;
  templateId?: string;
  clientData?: { nome: string; indirizzo: string };
  imageDataUrls?: string[];
}): Promise<PendingQuoteData> {
  const [profileRows, recentQuotes, catalogItems] = await Promise.all([
    db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)),
    db.select({ rawInput: quotesTable.rawInput, capitoli: quotesTable.capitoli, totale: quotesTable.totale })
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId))
      .orderBy(desc(quotesTable.createdAt))
      .limit(5),
    db.select()
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, userId))
      .orderBy(priceCatalogItemsTable.categoria, priceCatalogItemsTable.nome),
  ]);
  const [profile] = profileRows;

  const pastContext = buildPastContext(recentQuotes as { rawInput: string; capitoli: unknown; totale: string }[]);
  const catalogContext = buildCatalogContext(catalogItems);

  // Capitolato context: include for Elegante/Professionale templates
  const useCapitolato = templateId === "arosio" || templateId === "mariagrazia";

  // If client data is pre-filled, prepend it to the user message
  const clientPrefix = clientData?.nome
    ? `Cliente: ${clientData.nome}${clientData.indirizzo ? `, ${clientData.indirizzo}` : ""}.\n\n`
    : "";

  const hasImages = imageDataUrls && imageDataUrls.length > 0;

  const userContent = hasImages
    ? [
        { type: "text" as const, text: `${clientPrefix}${rawInput}` },
        ...imageDataUrls.map(img => ({
          type: "image_url" as const,
          image_url: { url: img, detail: "high" as const },
        })),
      ]
    : `${clientPrefix}${rawInput}`;

  const startTime = Date.now();
  trackEvent(userId, "quote_generation_started", {
    rawInputLength: rawInput.length,
    templateId,
    hasImages,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL ?? (hasImages ? "gpt-4o" : "gpt-4o-mini"),
      max_completion_tokens: 8192,
      temperature: 0.3,
      messages: [
        { role: "system", content: AI_PROMPT },
        { role: "system", content: REGIONAL_PRICING_GUIDANCE },
        { role: "system", content: DESCRIPTION_QUALITY_GUIDANCE },
        ...(catalogContext ? [{ role: "system" as const, content: catalogContext }] : []),
        ...(pastContext ? [{ role: "system" as const, content: pastContext }] : []),
        ...(useCapitolato ? [{ role: "system" as const, content: CAPITOLATO_CONTEXT }] : []),
        { role: "user", content: userContent },
      ],
    });

    const latencyMs = Date.now() - startTime;
    const usage = completion.usage;
    const content = completion.choices[0]?.message?.content ?? "{}";

    try {
      const result = parseAiResponse(content, rawInput, profile, templateId);
      // Override client data if pre-filled
      if (clientData?.nome) {
        result.clientData = clientData;
      }

      result.promptTokens = usage?.prompt_tokens ?? 0;
      result.completionTokens = usage?.completion_tokens ?? 0;
      result.totalTokens = usage?.total_tokens ?? 0;
      result.modelUsed = completion.model || process.env.AI_MODEL || (hasImages ? "gpt-4o" : "gpt-4o-mini");

      const isMini = result.modelUsed.includes("mini");
      const isGpt4 = result.modelUsed.includes("gpt-4o") && !isMini;
      const pCostRate = isMini ? 0.00000015 : isGpt4 ? 0.000005 : 0.00000059;
      const cCostRate = isMini ? 0.00000060 : isGpt4 ? 0.000015 : 0.00000079;
      result.apiCost = (result.promptTokens * pCostRate) + (result.completionTokens * cCostRate);

      recordAiUsage({ userId, model: result.modelUsed, kind: hasImages ? "ai_vision" : "ai_text", usage, relatedEntityType: "quote_generation" });

      flagIfAnomalousTotal(userId, result, log, "generation");

      trackEvent(userId, "quote_generation_completed", {
        latencyMs,
        model: result.modelUsed,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        chaptersCount: result.capitoli?.length || 0,
        totalAmount: result.totale,
      });
      return result;
    } catch {
      trackEvent(userId, "quote_generation_failed", {
        latencyMs,
        error: "Failed to parse AI JSON response",
        contentSnippet: content.slice(0, 200),
      });
      log.error({ content }, "Failed to parse AI JSON in buildQuoteFromAI");
      throw new Error("AI returned invalid JSON");
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    trackEvent(userId, "quote_generation_failed", {
      latencyMs,
      error: err?.message || String(err),
    });
    throw err;
  }
}

/**
 * Regenerates a quote by applying a natural-language correction to the current pending data.
 * Returns updated PendingQuoteData WITHOUT saving to DB.
 */
export async function regenerateWithCorrection({
  userId,
  current,
  correction,
  log,
}: {
  userId: string;
  current: PendingQuoteData;
  correction: string;
  log: Logger;
}): Promise<PendingQuoteData> {
  const [profileRows, catalogItems] = await Promise.all([
    db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)),
    db.select()
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, userId))
      .orderBy(priceCatalogItemsTable.categoria, priceCatalogItemsTable.nome),
  ]);
  const [profile] = profileRows;
  const catalogContext = buildCatalogContext(catalogItems);

  const useCapitolato = current.templateId === "arosio" || current.templateId === "mariagrazia";

  const currentJson = JSON.stringify({
    titolo_riga1: current.titoloPreventivoRiga1,
    titolo_riga2: current.titoloPreventivoRiga2,
    numero_preventivo_data: current.numeroPreventivoData,
    cliente: current.clientData,
    descrizione_generale: current.descrizioneGenerale,
    capitoli: current.capitoli.map(cap => ({
      lettera: cap.lettera,
      titolo: cap.titolo,
      osservazione: cap.osservazione,
      voci: cap.voci.map(v => ({
        descrizione: v.descrizione,
        um: v.um,
        quantita: v.quantita,
        prezzo_unitario: v.prezzoUnitario,
        totale: v.totale,
      })),
      subtotale: cap.subtotale,
    })),
    sconto: current.sconto
      ? { percentuale: current.sconto.percentuale, importo_scontato: current.sconto.importoScontato }
      : { percentuale: 0, importo_scontato: 0 },
    condizioni_pagamento: current.condizioniPagamento,
    subtotale: Number(current.subtotale),
    iva_percentuale: Number(current.ivaPercentuale),
    iva_valore: Number(current.ivaValore),
    totale: Number(current.totale),
    note: current.note,
  });

  const correctionPrompt = `Modify the following quote by applying this instruction: "${correction}"

CURRENT QUOTE (JSON):
${currentJson}

Return the COMPLETE updated quote in valid JSON with the same structure. Recalculate all subtotals, the tax, and the total. JSON ONLY, no extra text.`;

  const startTime = Date.now();
  trackEvent(userId, "quote_regeneration_started", {
    correctionLength: correction.length,
    currentChaptersCount: current.capitoli?.length || 0,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL ?? "gpt-4o-mini",
      max_completion_tokens: 8192,
      temperature: 0.3,
      messages: [
        { role: "system", content: AI_PROMPT },
        { role: "system", content: REGIONAL_PRICING_GUIDANCE },
        { role: "system", content: DESCRIPTION_QUALITY_GUIDANCE },
        ...(catalogContext ? [{ role: "system" as const, content: catalogContext }] : []),
        ...(useCapitolato ? [{ role: "system" as const, content: CAPITOLATO_CONTEXT }] : []),
        { role: "user", content: correctionPrompt },
      ],
    });

    const latencyMs = Date.now() - startTime;
    const usage = completion.usage;
    const content = completion.choices[0]?.message?.content ?? "{}";

    try {
      const result = parseAiResponse(content, current.rawInput, profile, current.templateId);
      
      result.promptTokens = usage?.prompt_tokens ?? 0;
      result.completionTokens = usage?.completion_tokens ?? 0;
      result.totalTokens = usage?.total_tokens ?? 0;
      result.modelUsed = completion.model || process.env.AI_MODEL || "gpt-4o-mini";

      const isMini = result.modelUsed.includes("mini");
      const isGpt4 = result.modelUsed.includes("gpt-4o") && !isMini;
      const pCostRate = isMini ? 0.00000015 : isGpt4 ? 0.000005 : 0.00000059;
      const cCostRate = isMini ? 0.00000060 : isGpt4 ? 0.000015 : 0.00000079;
      result.apiCost = (result.promptTokens * pCostRate) + (result.completionTokens * cCostRate);

      recordAiUsage({ userId, model: result.modelUsed, kind: "ai_text", usage, relatedEntityType: "quote_regeneration" });

      flagIfAnomalousTotal(userId, result, log, "regeneration");

      trackEvent(userId, "quote_regeneration_completed", {
        latencyMs,
        model: result.modelUsed,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        chaptersCount: result.capitoli?.length || 0,
        totalAmount: result.totale,
      });
      return result;
    } catch {
      trackEvent(userId, "quote_regeneration_failed", {
        latencyMs,
        error: "Failed to parse AI JSON response",
        contentSnippet: content.slice(0, 200),
      });
      log.error({ content }, "Failed to parse AI JSON in regenerateWithCorrection");
      throw new Error("AI returned invalid JSON during correction");
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    trackEvent(userId, "quote_regeneration_failed", {
      latencyMs,
      error: err?.message || String(err),
    });
    throw err;
  }
}

/**
 * Saves a PendingQuoteData to the database and returns the saved row.
 */
export async function saveQuoteToDb({
  userId,
  data,
  source,
  templateId,
}: {
  userId: string;
  data: PendingQuoteData;
  source: string;
  templateId?: string;
}): Promise<typeof quotesTable.$inferSelect> {
  const resolvedTemplateId = templateId ?? data.templateId ?? "standard";

  const quote = await db.transaction(async (tx) => {
    // Row lock the user's business profile record
    await tx.execute(sql`SELECT user_id FROM ${businessProfilesTable} WHERE user_id = ${userId} FOR UPDATE`);

    let numeroPreventivoData = data.numeroPreventivoData;
    if (!numeroPreventivoData) {
      const year = new Date().getFullYear();
      const [countResult] = await tx
        .select({ count: count() })
        .from(quotesTable)
        .where(eq(quotesTable.userId, userId));
      const quoteCount = Number(countResult?.count ?? 0);
      const nextNumber = quoteCount + 1;
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, "0");
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      numeroPreventivoData = `No. ${nextNumber}.${year} - ${dd}/${mm}/${year}`;
    }

    const [q] = await tx.insert(quotesTable).values({
      userId,
      rawInput: data.rawInput,
      clientData: data.clientData,
      companySnapshot: data.companySnapshot,
      descrizioneGenerale: data.descrizioneGenerale,
      items: [],
      capitoli: data.capitoli,
      sconto: data.sconto,
      condizioniPagamento: data.condizioniPagamento,
      capitolatoPro: data.capitolatoPro,
      titoloPreventivoRiga1: data.titoloPreventivoRiga1,
      titoloPreventivoRiga2: data.titoloPreventivoRiga2,
      numeroPreventivoData,
      subtotale: data.subtotale,
      ivaPercentuale: data.ivaPercentuale,
      ivaValore: data.ivaValore,
      totale: data.totale,
      note: data.note,
      status: "draft",
      source,
      templateId: resolvedTemplateId,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalTokens: data.totalTokens,
      modelUsed: data.modelUsed,
      apiCost: data.apiCost !== undefined ? data.apiCost.toFixed(6) : null,
    }).returning();

    if (!q) {
      throw new Error("Failed to insert quote");
    }

    // Set trialStartedAt only if not already set — do NOT overwrite an existing value
    const [existingProfile] = await tx
      .select({ trialStartedAt: businessProfilesTable.trialStartedAt })
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));
    if (!existingProfile?.trialStartedAt) {
      await tx
        .update(businessProfilesTable)
        .set({ trialStartedAt: new Date() })
        .where(eq(businessProfilesTable.userId, userId));
    }

    return q;
  });

  await linkQuoteToClient(quote);

  return quote;
}

/**
 * Legacy interface: generates a quote AND saves it to DB in one step.
 * Used by the web flow and existing callers.
 */
export async function generateQuoteFromText({
  userId,
  rawInput,
  log,
  source = "web",
}: {
  userId: string;
  rawInput: string;
  log: Logger;
  source?: string;
}): Promise<typeof quotesTable.$inferSelect> {
  const data = await buildQuoteFromAI({ userId, rawInput, log });
  return saveQuoteToDb({ userId, data, source });
}

// ── Guardrails ──────────────────────────────────────────────────────────────────

/**
 * Cheap sanity check on AI-generated totals: catches the failure mode where the
 * model returns a near-zero or wildly small total despite producing real line
 * items (e.g. malformed prezzo_unitario). Doesn't block generation — just makes
 * the anomaly visible in telemetry/logs instead of silently reaching the user.
 */
function flagIfAnomalousTotal(userId: string, result: PendingQuoteData, log: Logger, eventSuffix: string): void {
  const totale = Number(result.totale);
  const voceCount = result.capitoli.reduce((n, c) => n + c.voci.length, 0);
  if (voceCount > 0 && totale < 50) {
    log.warn({ userId, totale, voceCount, chaptersCount: result.capitoli.length }, "Suspiciously low quote total from AI");
    trackEvent(userId, `quote_${eventSuffix}_anomaly`, {
      reason: "total_too_low",
      totale,
      voceCount,
      chaptersCount: result.capitoli.length,
    });
  }
}

// ── Context builders ────────────────────────────────────────────────────────────

function buildPastContext(quotes: { rawInput: string; capitoli: unknown; totale: string }[]): string {
  const examples = quotes
    .filter(q => Array.isArray(q.capitoli) && (q.capitoli as QuoteChapter[]).length > 0)
    .slice(0, 3)
    .map(q => {
      const caps = q.capitoli as QuoteChapter[];
      const voci = caps.flatMap(c => c.voci).slice(0, 6);
      const lines = voci.map(v => `  - ${v.descrizione} (${v.um}): ${v.prezzoUnitario}$/unit`).join("\n");
      const tot = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(q.totale));
      return `Job: "${q.rawInput.slice(0, 100).replace(/\n/g, " ")}"\nTotal: ${tot}\nPrices:\n${lines}`;
    });
  if (examples.length === 0) return "";
  return `QUOTE HISTORY (use as a reference for price consistency):\n\n${examples.join("\n\n---\n\n")}`;
}

function buildCatalogContext(items: { nome: string; um: string; prezzoUnitario: string; categoria: string | null; note: string | null }[]): string {
  if (items.length === 0) return "";
  return `CUSTOM PRICE LIST (use as the PRIORITY reference):\n${items.map(item => `  - ${item.nome} (${item.um}): ${Number(item.prezzoUnitario).toFixed(2)}$/unit${item.categoria ? ` [${item.categoria}]` : ""}`).join("\n")}`;
}

type AiQuoteData = {
  titolo_riga1?: string;
  titolo_riga2?: string;
  numero_preventivo_data?: string;
  cliente?: { nome?: string; indirizzo?: string };
  descrizione_generale?: string;
  capitoli?: Array<{
    lettera?: string;
    titolo?: string;
    osservazione?: string;
    voci?: Array<{ descrizione?: string; um?: string; quantita?: number; prezzo_unitario?: number; totale?: number }>;
    subtotale?: number;
  }>;
  sconto?: { percentuale?: number; importo_scontato?: number } | null;
  condizioni_pagamento?: string[];
  subtotale?: number;
  iva_percentuale?: number;
  iva_valore?: number;
  totale?: number;
  note?: string;
};
