import { db, clientsTable, quotesTable, businessProfilesTable, clientDedupKey, normalizeProvince, paymentScheduleToText, type QuoteClientData } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Finds or creates the client record matching a quote's client data and
 * returns its id. Existing clients get their blank contact fields filled in
 * from the newer quote (never overwritten). Returns null when the quote has
 * no usable client name.
 */
export async function ensureClientForQuote(userId: string, clientData: QuoteClientData | null | undefined): Promise<string | null> {
  const name = (clientData?.nome ?? "").trim();
  if (!name) return null;

  const dedupKey = clientDedupKey({ name, email: clientData?.email, phone: clientData?.phone });
  const incoming = {
    email: clientData?.email?.trim() || null,
    phone: clientData?.phone?.trim() || null,
    address: clientData?.indirizzo?.trim() || null,
    city: clientData?.city?.trim() || null,
    province: normalizeProvince(clientData?.province) ?? null,
    postalCode: clientData?.postalCode?.trim() || null,
    businessNumber: clientData?.businessNumber?.trim() || clientData?.partitaIva?.trim() || null,
  };

  let [existing] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.userId, userId), eq(clientsTable.dedupKey, dedupKey)));
  // Phase 94: quote forms now collect email and phone. A client first saved by
  // name alone (every quote before this phase) is the same person, so fill in
  // their contact details instead of starting a second record.
  // Only when nothing on record contradicts the new details: a namesake with
  // their own email is someone else. The key is left alone (the client portal
  // addresses a client by md5(dedupKey)).
  if (!existing && (incoming.email || incoming.phone)) {
    const [byName] = await db
      .select()
      .from(clientsTable)
      .where(and(eq(clientsTable.userId, userId), eq(clientsTable.dedupKey, clientDedupKey({ name }))));
    const same = (a: string | null, b: string | null) => !a || !b || a.trim().toLowerCase() === b.toLowerCase();
    if (byName && same(byName.email, incoming.email) && same(byName.phone, incoming.phone)) {
      existing = byName;
    }
  }

  if (existing) {
    const fill: Partial<typeof existing> = {};
    for (const key of Object.keys(incoming) as (keyof typeof incoming)[]) {
      if (!existing[key] && incoming[key]) fill[key] = incoming[key] as never;
    }
    if (Object.keys(fill).length > 0) {
      await db.update(clientsTable).set(fill).where(eq(clientsTable.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(clientsTable)
    .values({
      userId,
      name,
      type: incoming.businessNumber ? "business" : "individual",
      // Phase 71: a client in Québec defaults to French documents (contracts,
      // invoices and now quotes all read this); editable on the client record.
      preferredLanguage: incoming.province === "QC" ? "fr" : "en",
      dedupKey,
      ...incoming,
    })
    .onConflictDoNothing({ target: [clientsTable.userId, clientsTable.dedupKey] })
    .returning();

  if (created) return created.id;
  // Lost a race with a concurrent insert: read it back.
  const [raced] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.userId, userId), eq(clientsTable.dedupKey, dedupKey)));
  return raced?.id ?? null;
}

/**
 * Post-insert hook for freshly created quotes:
 *  - links the quote to its client record,
 *  - stamps the work province (client's, else the company's),
 *  - applies the company's default payment schedule (unless the quote is a
 *    duplicate, whose terms were copied on purpose).
 * Never throws — a missing link is repaired on the next save and must not
 * fail quote creation.
 */
export async function linkQuoteToClient(
  quote: { id: string; userId: string; clientData: QuoteClientData | null; province?: string | null },
  fallbackProvince?: string | null,
  options: { applyDefaultTerms?: boolean } = {},
): Promise<void> {
  try {
    const [profile] = await db
      .select({ province: businessProfilesTable.province, defaultPaymentSchedule: businessProfilesTable.defaultPaymentSchedule })
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, quote.userId));

    const clientId = await ensureClientForQuote(quote.userId, quote.clientData);
    const province =
      quote.province ??
      normalizeProvince(quote.clientData?.province) ??
      normalizeProvince(fallbackProvince) ??
      normalizeProvince(profile?.province) ??
      null;

    const updates: Partial<typeof quotesTable.$inferInsert> = { clientId, province };
    const applyDefault = options.applyDefaultTerms ?? true;
    if (applyDefault && profile?.defaultPaymentSchedule && profile.defaultPaymentSchedule.terms.length > 0) {
      updates.paymentSchedule = { ...profile.defaultPaymentSchedule, derived: false };
      updates.condizioniPagamento = paymentScheduleToText(profile.defaultPaymentSchedule);
    }

    await db.update(quotesTable).set(updates).where(eq(quotesTable.id, quote.id));
    // Callers serialize the row they inserted; keep it in sync with the DB.
    Object.assign(quote, updates);
  } catch (err) {
    logger.error({ err, quoteId: quote.id }, "Failed to link quote to client");
  }
}
