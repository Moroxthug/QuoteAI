import { db, incentivesCatalogTable, type IncentiveCatalogItem } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger.js";

const FETCH_TIMEOUT_MS = 8000;
const SNIPPET_MAX_CHARS = 2500;

// The "Daily AI Incentive Agent" used to ask the model to confirm whether a
// grant program was still active based solely on its own parametric knowledge
// (no internet access). Here we actually fetch the text of the official page
// linked to each grant program (when reachable) and pass it to the model as
// grounding, so the outcome at least partly reflects a real source. When the
// source isn't reachable, the grant program stays explicitly labeled as a
// "heuristic check" rather than a confirmation.
async function fetchOfficialSourceSnippet(url: string): Promise<{ ok: boolean; snippet: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QuoteAI-IncentiveBot/1.0)" },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return { ok: false, snippet: "" };
    }

    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return { ok: true, snippet: text.slice(0, SNIPPET_MAX_CHARS) };
  } catch (err) {
    logger.warn({ err, url }, "Could not fetch official incentive source for AI grounding");
    return { ok: false, snippet: "" };
  }
}

interface AiUpdatedStatusItem {
  id?: string;
  stato?: "active" | "expiring_soon";
  note_di_verifica?: string;
}

interface AiVerificationResult {
  updatedStatus?: AiUpdatedStatusItem[];
  riepilogoScansione?: string;
}

export interface IncentivesVerificationOutcome {
  updatedCount: number;
  sourcesFetched: number;
  sourcesTotal: number;
  summary: string;
  disclaimer: string;
}

const HEURISTIC_DISCLAIMER =
  "Preliminary heuristic check (AI + official sources when reachable). This does NOT constitute a legal verification: grant programs must be confirmed by a human operator before being shown as guaranteed to end clients.";

export async function runIncentivesVerification(
  activeIncentives: IncentiveCatalogItem[]
): Promise<IncentivesVerificationOutcome> {
  if (activeIncentives.length === 0) {
    return { updatedCount: 0, sourcesFetched: 0, sourcesTotal: 0, summary: "No active grant programs to verify.", disclaimer: HEURISTIC_DISCLAIMER };
  }

  const sourceLookups = await Promise.all(
    activeIncentives.map(async inc => {
      if (!inc.fonteUfficialeUrl) return { inc, ok: false, snippet: "" };
      const result = await fetchOfficialSourceSnippet(inc.fonteUfficialeUrl);
      return { inc, ...result };
    })
  );

  const sourcesFetched = sourceLookups.filter(s => s.ok).length;

  const bandiBlock = sourceLookups
    .map(({ inc, ok, snippet }) => {
      const fonteInfo = ok
        ? `Official source excerpt (${inc.fonteUfficialeUrl}): "${snippet || "(empty page)"}"`
        : `Official source not automatically reachable (${inc.fonteUfficialeUrl || "no URL registered"}) — rely only on general knowledge and flag this in note_di_verifica.`;
      return `- ID: ${inc.id} | Code: ${inc.codice} | Title: ${inc.titolo} | Current status: ${inc.stato} | Province: ${inc.province || "National"}\n  ${fonteInfo}`;
    })
    .join("\n");

  const prompt = `You are the AI agent responsible for the daily verification of Canadian construction grants and incentive programs for QuoteAI.
Here is the current list of grant programs in the database, with the extracted text of the corresponding official page when it was possible to retrieve it:
${bandiBlock}

Use the text extracted from the official source (when present) as the primary basis for verification. If the source could not be retrieved, do not invent confirmations: still set a plausible status, but state in note_di_verifica that this is only a heuristic check with no source consulted.
Indicate whether any grant program should be flagged as "expiring_soon" (closing soon / limited funding remaining) or confirmed as "active".
Return ONLY valid JSON in the following format:
{
  "updatedStatus": [
    { "id": "GRANT_PROGRAM_ID", "stato": "active" | "expiring_soon", "note_di_verifica": "Summary of the verification and any source consulted" }
  ],
  "riepilogoScansione": "Overall summary of the scan"
}`;

  let aiResult: AiVerificationResult = { updatedStatus: [], riepilogoScansione: "AI scan completed." };
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: "You are a legal reviewer and expert in Canadian public construction grant programs. You never state an official confirmation unless you have a supporting source excerpt." },
        { role: "user", content: prompt },
      ],
    });

    const cleaned = (completion.choices[0]?.message?.content || "{}")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    aiResult = JSON.parse(cleaned);
  } catch (err) {
    logger.warn({ err }, "Could not parse AI sync response cleanly, proceeding with timestamp-only update");
  }

  let updatedCount = 0;
  if (aiResult.updatedStatus && Array.isArray(aiResult.updatedStatus)) {
    for (const item of aiResult.updatedStatus) {
      if (item.id && (item.stato === "active" || item.stato === "expiring_soon")) {
        await db
          .update(incentivesCatalogTable)
          .set({
            stato: item.stato,
            isVerifiedByAi: true,
            lastCheckedAt: new Date(),
          })
          .where(eq(incentivesCatalogTable.id, item.id));
        updatedCount++;
        if (item.note_di_verifica) {
          logger.info({ incentiveId: item.id, note: item.note_di_verifica }, "AI incentive verification note");
        }
      }
    }
  } else {
    for (const inc of activeIncentives) {
      await db
        .update(incentivesCatalogTable)
        .set({ isVerifiedByAi: true, lastCheckedAt: new Date() })
        .where(eq(incentivesCatalogTable.id, inc.id));
      updatedCount++;
    }
  }

  const baseSummary = aiResult.riepilogoScansione || "Heuristic scan completed.";
  return {
    updatedCount,
    sourcesFetched,
    sourcesTotal: activeIncentives.length,
    summary: `${baseSummary} (official sources reached: ${sourcesFetched}/${activeIncentives.length})`,
    disclaimer: HEURISTIC_DISCLAIMER,
  };
}
