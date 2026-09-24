// Shared by the internal `/api/quotes/manual` route and the Phase 19 public
// API's `POST /v1/public/quotes` — the only two places a quote is created
// from structured input rather than AI parsing. Extracted so the two never
// drift on quota enforcement or server-side total recalculation.
import { db, quotesTable, businessProfilesTable, quoteClientDataSchema, quoteCompanySnapshotSchema, quoteChapterSchema, normalizeProvince, getTaxProfile, type QuoteChapter, type QuoteCompanySnapshot, type QuoteClientData } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { PLANS } from "../routes/payments.js";
import { generateNumeroPreventivo } from "../lib/quoteNumber.js";
import { linkQuoteToClient } from "../lib/clients.js";
import { currentActorId } from "../lib/requestContext.js";
import { z } from "zod";
import { CreateManualQuoteBody } from "@workspace/api-zod";

/**
 * Phase 97: the request body of both manual-create routes (in-app and the
 * public API). A bad company snapshot is still ignored in favour of the saved
 * profile, as before, rather than refused.
 */
export const ManualQuoteBodySchema = CreateManualQuoteBody.extend({ companySnapshot: z.unknown().optional() });

/** The error string the routes answered with before the body was parsed up front. */
export function manualQuoteBodyError(err: z.ZodError): string {
  const field = err.issues[0]?.path[0];
  return field === "capitoli" ? "Invalid capitoli" : field === "clientData" ? "Invalid clientData" : "Invalid parameters";
}

export type ManualQuoteInput = {
  capitoli?: unknown;
  clientData?: unknown;
  companySnapshot?: unknown;
  templateId?: string;
  titoloPreventivoRiga1?: string;
  titoloPreventivoRiga2?: string;
  descrizioneGenerale?: string;
  /** Total sales-tax rate. Omitted → the statutory rate of `province`; 0 → tax-exempt. */
  ivaPercentuale?: number;
  /** Province the work is performed in (drives the tax components and the contract template). Defaults to the client's, then the company's. */
  province?: string | null;
  condizioniPagamento?: string[];
  note?: string;
};

export type ManualQuoteResult =
  | { ok: true; quote: typeof quotesTable.$inferSelect }
  | { ok: false; status: number; error: string; details?: unknown };

export async function createManualQuote(userId: string, input: ManualQuoteInput): Promise<ManualQuoteResult> {
  const [profile] = await db
    .select({
      subscriptionPlan: businessProfilesTable.subscriptionPlan,
      subscriptionStatus: businessProfilesTable.subscriptionStatus,
      trialStartedAt: businessProfilesTable.trialStartedAt,
      province: businessProfilesTable.province,
    })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, userId));

  if (profile?.subscriptionStatus === "active" && profile.subscriptionPlan) {
    const plan = PLANS.find((p) => p.id === profile.subscriptionPlan);
    if (plan?.quotaPerMonth != null) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const [{ cnt }] = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(quotesTable)
        .where(sql`${quotesTable.userId} = ${userId} AND ${quotesTable.createdAt} >= ${monthStart.toISOString()} AND ${quotesTable.createdAt} < ${nextMonth.toISOString()}`);
      if (cnt >= plan.quotaPerMonth) {
        return { ok: false, status: 429, error: `Monthly quota reached. You've used all ${plan.quotaPerMonth} quotes included in the ${plan.name} plan this month.` };
      }
    }
  }

  const capitoliResult = quoteChapterSchema.array().safeParse(input.capitoli);
  if (!capitoliResult.success) {
    return { ok: false, status: 400, error: "Invalid capitoli", details: capitoliResult.error };
  }
  const capitoli = capitoliResult.data as QuoteChapter[];

  let clientDataInput: QuoteClientData | undefined;
  if (input.clientData) {
    const r = quoteClientDataSchema.safeParse(input.clientData);
    if (!r.success) return { ok: false, status: 400, error: "Invalid clientData", details: r.error };
    clientDataInput = r.data;
  }

  let resolvedSnapshot: QuoteCompanySnapshot | null = null;
  if (input.companySnapshot) {
    const r = quoteCompanySnapshotSchema.safeParse(input.companySnapshot);
    if (r.success) resolvedSnapshot = r.data;
  }
  if (!resolvedSnapshot) {
    const [bp] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (bp) {
      resolvedSnapshot = {
        companyName: bp.companyName,
        vatNumber: bp.vatNumber ?? undefined,
        address: bp.address ?? undefined,
        phone: bp.phone ?? undefined,
        email: bp.email ?? undefined,
        logoUrl: bp.logoUrl ?? undefined,
      };
    }
  }

  // Recalculate totals server-side (never trust the caller).
  const recalcCapitoli = capitoli.map((cap) => {
    const voci = cap.voci.map((v) => ({ ...v, totale: Math.round(v.quantita * v.prezzoUnitario * 100) / 100 }));
    const subtotale = voci.reduce((s, v) => s + v.totale, 0);
    return { ...cap, voci, subtotale: Math.round(subtotale * 100) / 100 };
  });

  const subtotale = recalcCapitoli.reduce((s, c) => s + c.subtotale, 0);
  // Phase 71: the province decides the taxes (GST+QST in Québec, GST+PST in
  // BC, HST in Ontario…) unless the caller sends an explicit rate; 0 is
  // tax-exempt. The old fallback was the Italian 22 %.
  const province = normalizeProvince(input.province) ?? normalizeProvince(clientDataInput?.province) ?? normalizeProvince(profile?.province) ?? null;
  const ivaPercentuale = typeof input.ivaPercentuale === "number" && input.ivaPercentuale >= 0 ? input.ivaPercentuale : (province ? getTaxProfile(province).totalRate : 0);
  const ivaValore = Math.round(subtotale * (ivaPercentuale / 100) * 100) / 100;
  const totale = Math.round((subtotale + ivaValore) * 100) / 100;

  const [quote] = await db.transaction(async (tx) => {
    // Row lock the user's business profile record to prevent concurrent quote creation.
    await tx.execute(sql`SELECT user_id FROM ${businessProfilesTable} WHERE user_id = ${userId} FOR UPDATE`);

    const numeroPreventivoData = await generateNumeroPreventivo(userId);

    return tx
      .insert(quotesTable)
      .values({
        userId,
        createdByUserId: currentActorId(),
        rawInput: `[Manual quote] ${input.titoloPreventivoRiga2 ?? input.descrizioneGenerale ?? ""}`.trim(),
        capitoli: recalcCapitoli,
        clientData: clientDataInput ?? { nome: "", indirizzo: "" },
        companySnapshot: resolvedSnapshot,
        templateId: (["standard", "arosio", "mariagrazia"].includes(input.templateId ?? "") ? input.templateId : "standard") as "standard" | "arosio" | "mariagrazia",
        titoloPreventivoRiga1: input.titoloPreventivoRiga1 ?? "Project Quote & Itemized Estimate",
        titoloPreventivoRiga2: input.titoloPreventivoRiga2 ?? "",
        descrizioneGenerale: input.descrizioneGenerale ?? "",
        numeroPreventivoData,
        subtotale: subtotale.toFixed(2),
        ivaPercentuale: ivaPercentuale.toFixed(3),
        ivaValore: ivaValore.toFixed(2),
        totale: totale.toFixed(2),
        province,
        condizioniPagamento: Array.isArray(input.condizioniPagamento) ? input.condizioniPagamento : ["30% deposit on signing", "40% at mid-project milestone", "30% on completion"],
        note: input.note ?? "Quote valid for 30 days",
        status: "draft",
      })
      .returning();
  });

  await linkQuoteToClient(quote!, profile?.province);

  if (!profile?.trialStartedAt) {
    await db.update(businessProfilesTable).set({ trialStartedAt: new Date() }).where(eq(businessProfilesTable.userId, userId));
  }

  return { ok: true, quote: quote! };
}
