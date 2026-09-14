import { randomBytes, createHash } from "node:crypto";
import {
  db,
  contractsTable,
  contractSignersTable,
  contractEventsTable,
  contractSequencesTable,
  quotesTable,
  businessProfilesTable,
  clientsTable,
  authUsersTable,
  computeTax,
  normalizeProvince,
  derivePaymentScheduleFromText,
  type Contract,
  type ContractSigner,
  type ContractEvent,
  type ContractVariables,
  type ContractDocument,
  type QuoteChapter,
  type QuoteClientData,
  type QuoteCompanySnapshot,
  type QuoteDiscount,
} from "@workspace/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { raiseAutomation } from "../lib/automation.js";
import { writeAudit } from "../lib/notifications.js";
import { sendContractSigningEmail, sendContractSignedEmail } from "../lib/emailContracts.js";
import { buildContractDocument, fallbackScope, fallbackSchedule, templateKeyForProvince, refreshLockedSections, type Lang, type TemplateKey } from "./templates.js";
import { buildContractPdf } from "./pdf.js";

const storage = new ObjectStorageService();

export const SIGNING_LINK_DAYS = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function nextContractNumber(userId: string): Promise<string> {
  const [row] = await db
    .insert(contractSequencesTable)
    .values({ userId, next: 2 })
    .onConflictDoUpdate({ target: contractSequencesTable.userId, set: { next: sql`${contractSequencesTable.next} + 1` } })
    .returning({ next: contractSequencesTable.next });
  const n = (row?.next ?? 2) - 1;
  return `CTR-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
}

export async function logContractEvent(params: {
  contractId: string;
  type: string;
  actor: "contractor" | "customer" | "system";
  signerId?: string | null;
  detail?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await db.insert(contractEventsTable).values({
    contractId: params.contractId,
    type: params.type,
    actor: params.actor,
    signerId: params.signerId ?? null,
    detail: params.detail ?? null,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
  });
}

export async function loadContract(id: string): Promise<{ contract: Contract; signers: ContractSigner[]; events: ContractEvent[] } | null> {
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!contract) return null;
  const [signers, events] = await Promise.all([
    db.select().from(contractSignersTable).where(eq(contractSignersTable.contractId, id)).orderBy(asc(contractSignersTable.createdAt)),
    db.select().from(contractEventsTable).where(eq(contractEventsTable.contractId, id)).orderBy(asc(contractEventsTable.createdAt)),
  ]);
  return { contract, signers, events };
}

// ── Variables from quote ─────────────────────────────────────────────────────

type QuoteRow = typeof quotesTable.$inferSelect;
type ProfileRow = typeof businessProfilesTable.$inferSelect;

export function buildVariablesFromQuote(params: {
  quote: QuoteRow;
  profile: ProfileRow | undefined;
  client: typeof clientsTable.$inferSelect | undefined;
  contractNumber: string;
  province: string;
  language: Lang;
  overrides?: Partial<Pick<ContractVariables, "startDate" | "estimatedDurationWeeks" | "warrantyMonths" | "directAgreement" | "englishRequestedInQuebec">>;
}): ContractVariables {
  const { quote, profile, client } = params;
  const snap = (quote.companySnapshot as QuoteCompanySnapshot | null) ?? null;
  const cd = (quote.clientData ?? { nome: "", indirizzo: "" }) as QuoteClientData;
  const chapters = (Array.isArray(quote.capitoli) ? quote.capitoli : []) as QuoteChapter[];
  const discount = quote.sconto as QuoteDiscount | null;

  const priceLines = chapters.length > 0
    ? chapters.map((c) => ({ label: `${c.lettera}. ${c.titolo}`, amount: Number(c.subtotale) }))
    : (Array.isArray(quote.items) ? quote.items : []).map((i) => ({ label: i.descrizione, amount: Number(i.totale) }));

  const grossSubtotal = priceLines.reduce((s, l) => s + l.amount, 0);
  const discountAmount = discount && discount.percentuale > 0 ? Number(discount.importoScontato) : 0;
  const subtotal = Math.round((grossSubtotal - discountAmount) * 100) / 100;

  // Tax: use the quote's stored rate when it matches the province profile,
  // otherwise recompute from the province (keeps GST/QST split correct).
  const taxCalc = computeTax(subtotal, params.province);
  const storedRate = Number(quote.ivaPercentuale);
  const useProfile = Math.abs(taxCalc.profile.totalRate - storedRate) < 0.01 || storedRate === 0;
  const taxLines = useProfile
    ? taxCalc.lines.map((l) => ({ code: l.code, label: l.label, rate: l.rate, amount: l.amount }))
    : [{ code: "TAX", label: params.language === "fr" ? "Taxes" : "Sales tax", rate: storedRate, amount: Math.round(subtotal * storedRate) / 100 }];
  const taxTotal = Math.round(taxLines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const total = Math.round((subtotal + taxTotal) * 100) / 100;

  const paymentSchedule = quote.paymentSchedule ?? derivePaymentScheduleFromText(quote.condizioniPagamento, total);

  const siteAddress = [cd.indirizzo, cd.city, cd.province, cd.postalCode].filter(Boolean).join(", ") || client?.address || "";

  return {
    contractNumber: params.contractNumber,
    quoteNumber: quote.numeroPreventivoData || `No. ${quote.id.slice(0, 4).toUpperCase()}`,
    contractor: {
      name: snap?.companyName || profile?.companyName || "",
      address: snap?.address || profile?.address || undefined,
      email: snap?.email || profile?.email || undefined,
      phone: snap?.phone || profile?.phone || undefined,
      businessNumber: profile?.gstHstNumber || snap?.vatNumber || profile?.vatNumber || undefined,
      licenceNumber: profile?.licenceNumber || undefined,
      province: normalizeProvince(profile?.province) ?? undefined,
    },
    customer: {
      name: cd.nome || client?.name || "",
      address: cd.indirizzo || client?.address || undefined,
      city: cd.city || client?.city || undefined,
      province: normalizeProvince(cd.province) ?? client?.province ?? undefined,
      postalCode: cd.postalCode || client?.postalCode || undefined,
      email: cd.email || client?.email || undefined,
      phone: cd.phone || client?.phone || undefined,
      businessNumber: cd.businessNumber || cd.partitaIva || client?.businessNumber || undefined,
    },
    siteAddress,
    province: params.province,
    projectTitle: quote.titoloPreventivoRiga2 || quote.descrizioneGenerale?.slice(0, 120) || (params.language === "fr" ? "Travaux de rénovation" : "Renovation work"),
    priceLines,
    discount: discountAmount > 0 && discount ? { percent: Number(discount.percentuale), amount: discountAmount } : null,
    subtotal,
    taxLines,
    taxTotal,
    total,
    paymentSchedule,
    startDate: params.overrides?.startDate ?? null,
    estimatedDurationWeeks: params.overrides?.estimatedDurationWeeks ?? null,
    warrantyMonths: params.overrides?.warrantyMonths ?? 12,
    englishRequestedInQuebec: params.overrides?.englishRequestedInQuebec ?? (params.province === "QC" && params.language === "en"),
    directAgreement: params.overrides?.directAgreement ?? true,
  };
}

// ── AI drafting ──────────────────────────────────────────────────────────────

async function draftWithAi(quote: QuoteRow, vars: ContractVariables, lang: Lang): Promise<{ scope: string; schedule: string; durationWeeks: number | null }> {
  const chapters = (Array.isArray(quote.capitoli) ? quote.capitoli : []) as QuoteChapter[];
  const quoteText = chapters
    .map((c) => `${c.lettera}. ${c.titolo}\n${c.voci.map((v) => `  - ${v.descrizione} (${v.quantita} ${v.um})`).join("\n")}${c.osservazione ? `\n  Note: ${c.osservazione}` : ""}`)
    .join("\n");
  const system = lang === "fr"
    ? `Tu es un rédacteur de contrats de construction au Canada. À partir d'une soumission, rédige en français, pour un contrat d'entreprise, (1) la section « Description des travaux » et (2) la section « Échéancier ». Style clair, précis, sans jargon juridique, sans prix. Réponds UNIQUEMENT en JSON.`
    : `You draft construction contracts in Canada. From a quote, write, for a services agreement, (1) the "Scope of Work" section and (2) the "Schedule" section. Clear, precise, plain language, no legalese, no prices. Reply with JSON ONLY.`;
  const user = `${lang === "fr" ? "Soumission" : "Quote"} ${vars.quoteNumber} — ${vars.projectTitle}
${lang === "fr" ? "Adresse du chantier" : "Site address"}: ${vars.siteAddress}
${lang === "fr" ? "Description générale" : "General description"}: ${quote.descrizioneGenerale || "-"}
${lang === "fr" ? "Notes" : "Notes"}: ${quote.note || "-"}
${quoteText}

${lang === "fr"
  ? `Retourne: {"scope": "<texte markdown-lite: paragraphes séparés par une ligne vide, puces '- ' par poste de travail, **gras** permis; termine par une liste 'Exclusions' réaliste>", "schedule": "<1-2 paragraphes: phases principales dans l'ordre, dépendances (permis, matériaux), et que les dates sont des estimations>", "duration_weeks": <entier estimé ou null>}`
  : `Return: {"scope": "<markdown-lite text: paragraphs separated by a blank line, '- ' bullets per work item, **bold** allowed; end with a realistic 'Exclusions' list>", "schedule": "<1-2 paragraphs: main phases in order, dependencies (permits, materials), and that dates are estimates>", "duration_weeks": <estimated integer or null>}`}`;

  const completion = await openai.chat.completions.create({
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    max_completion_tokens: 2500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { scope?: string; schedule?: string; duration_weeks?: number | null };
  if (!parsed.scope || !parsed.schedule) throw new Error("AI draft incomplete");
  return {
    scope: String(parsed.scope).trim(),
    schedule: String(parsed.schedule).trim(),
    durationWeeks: typeof parsed.duration_weeks === "number" && parsed.duration_weeks > 0 ? Math.round(parsed.duration_weeks) : null,
  };
}

// ── Create from quote ────────────────────────────────────────────────────────

export async function createContractFromQuote(params: {
  userId: string;
  quoteId: string;
  language?: Lang;
  province?: string | null;
  actor: "contractor" | "system";
}): Promise<{ contract: Contract; created: boolean }> {
  const [quote] = await db.select().from(quotesTable).where(and(eq(quotesTable.id, params.quoteId), eq(quotesTable.userId, params.userId)));
  if (!quote) throw new Error("Quote not found");

  const [existing] = await db
    .select()
    .from(contractsTable)
    .where(and(eq(contractsTable.quoteId, quote.id), sql`${contractsTable.status} NOT IN ('voided','declined','expired')`))
    .limit(1);
  if (existing) return { contract: existing, created: false };

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, params.userId));
  const client = quote.clientId ? (await db.select().from(clientsTable).where(eq(clientsTable.id, quote.clientId)))[0] : undefined;

  const province =
    normalizeProvince(params.province) ??
    normalizeProvince(quote.province) ??
    normalizeProvince((quote.clientData as QuoteClientData | null)?.province) ??
    normalizeProvince(profile?.province) ??
    "ON";
  const language: Lang = params.language ?? (client?.preferredLanguage as Lang | undefined) ?? (province === "QC" ? "fr" : "en");
  const templateKey: TemplateKey = templateKeyForProvince(province);
  const contractNumber = await nextContractNumber(params.userId);

  let vars = buildVariablesFromQuote({ quote, profile, client, contractNumber, province, language });

  let scope = fallbackScope(vars, language);
  let schedule = fallbackSchedule(vars, language);
  try {
    const ai = await draftWithAi(quote, vars, language);
    scope = ai.scope;
    schedule = ai.schedule;
    if (ai.durationWeeks) vars = { ...vars, estimatedDurationWeeks: ai.durationWeeks };
  } catch (err) {
    logger.warn({ err, quoteId: quote.id }, "AI contract draft failed — using deterministic fallback sections");
  }

  const document = buildContractDocument({ templateKey, language, variables: vars, scopeBody: scope, scheduleBody: schedule });

  const [contract] = await db
    .insert(contractsTable)
    .values({
      userId: params.userId,
      quoteId: quote.id,
      clientId: quote.clientId ?? null,
      contractNumber,
      status: "draft",
      province,
      language,
      templateKey,
      document,
      variables: vars,
      contractValueCents: Math.round(vars.total * 100),
      holdbackEnabled: vars.paymentSchedule.holdback.enabled,
      holdbackPercent: vars.paymentSchedule.holdback.percent,
    })
    .returning();

  // Both signer rows exist from the start; the customer's token is minted at send time.
  await db.insert(contractSignersTable).values([
    { contractId: contract!.id, role: "contractor", name: vars.contractor.name, email: vars.contractor.email || profile?.email || "" },
    { contractId: contract!.id, role: "customer", name: vars.customer.name, email: vars.customer.email || client?.email || "" },
  ]);
  await logContractEvent({ contractId: contract!.id, type: "created", actor: params.actor, detail: { templateKey, language, byAi: true } });
  await writeAudit({ userId: params.userId, actorType: params.actor === "system" ? "system" : "user", entityType: "contract", entityId: contract!.id, action: "created", diff: { quoteId: quote.id } });

  return { contract: contract!, created: true };
}

// ── Editing ──────────────────────────────────────────────────────────────────

export function applyVariableEdits(contract: Contract, edits: Partial<Pick<ContractVariables, "startDate" | "estimatedDurationWeeks" | "warrantyMonths" | "directAgreement" | "englishRequestedInQuebec">> & { holdbackEnabled?: boolean; holdbackPercent?: number; customerEmail?: string; customerName?: string }): { variables: ContractVariables; document: ContractDocument } {
  const v: ContractVariables = JSON.parse(JSON.stringify(contract.variables));
  if (edits.startDate !== undefined) v.startDate = edits.startDate;
  if (edits.estimatedDurationWeeks !== undefined) v.estimatedDurationWeeks = edits.estimatedDurationWeeks;
  if (edits.warrantyMonths !== undefined) v.warrantyMonths = edits.warrantyMonths;
  if (edits.directAgreement !== undefined) v.directAgreement = edits.directAgreement;
  if (edits.englishRequestedInQuebec !== undefined) v.englishRequestedInQuebec = edits.englishRequestedInQuebec;
  if (edits.holdbackEnabled !== undefined) v.paymentSchedule.holdback.enabled = edits.holdbackEnabled;
  if (edits.holdbackPercent !== undefined) v.paymentSchedule.holdback.percent = edits.holdbackPercent;
  if (edits.customerEmail !== undefined) v.customer.email = edits.customerEmail;
  if (edits.customerName !== undefined) v.customer.name = edits.customerName;
  // Change-order documents have their own layout (jobs/changeOrders.ts); only the variables change.
  const document = contract.kind === "change_order" ? contract.document : refreshLockedSections(contract.document, v);
  return { variables: v, document };
}

// ── PDFs & storage ───────────────────────────────────────────────────────────

async function renderAndStore(contractId: string, kind: "unsigned" | "signed", withAudit: boolean): Promise<{ url: string; sha256: string; buffer: Buffer }> {
  const loaded = await loadContract(contractId);
  if (!loaded) throw new Error("Contract not found");
  const { contract, signers, events } = loaded;
  const { buffer, sha256 } = await buildContractPdf({
    document: contract.document,
    variables: contract.variables,
    signers,
    events,
    status: kind === "unsigned" ? "sent" : "signed",
    createdAt: contract.createdAt,
    unsignedPdfHash: contract.unsignedPdfHash,
    withAudit,
  });
  const url = await storage.uploadObjectBuffer({
    subPath: `contracts/${contract.userId}/${contract.id}/${kind}-${sha256.slice(0, 12)}.pdf`,
    buffer,
    contentType: "application/pdf",
  });
  return { url, sha256, buffer };
}

export async function contractPdfBuffer(contractId: string): Promise<{ buffer: Buffer; filename: string }> {
  const loaded = await loadContract(contractId);
  if (!loaded) throw new Error("Contract not found");
  const { contract, signers, events } = loaded;
  if (contract.signedPdfUrl) {
    const res = await storage.downloadPrivateObject(contract.signedPdfUrl.replace(/^\/objects\//, ""));
    return { buffer: Buffer.from(await res.arrayBuffer()), filename: `${contract.contractNumber}-signed.pdf` };
  }
  const { buffer } = await buildContractPdf({
    document: contract.document,
    variables: contract.variables,
    signers,
    events,
    status: contract.status,
    createdAt: contract.createdAt,
    unsignedPdfHash: contract.unsignedPdfHash,
    withAudit: false,
  });
  return { buffer, filename: `${contract.contractNumber}${contract.status === "draft" ? "-draft" : ""}.pdf` };
}

// ── Send ─────────────────────────────────────────────────────────────────────

export async function sendContractToCustomer(params: { contractId: string; userId: string; message?: string; ip?: string | null; userAgent?: string | null }): Promise<{ contract: Contract }> {
  const loaded = await loadContract(params.contractId);
  if (!loaded || loaded.contract.userId !== params.userId) throw new Error("Contract not found");
  const { contract, signers } = loaded;
  if (contract.status !== "draft" && contract.status !== "sent" && contract.status !== "viewed") throw new Error(`Cannot send a contract in status ${contract.status}`);

  const contractorSigner = signers.find((s) => s.role === "contractor");
  const customerSigner = signers.find((s) => s.role === "customer");
  if (!contractorSigner || contractorSigner.status !== "signed") throw new Error("SIGN_FIRST");
  if (!customerSigner) throw new Error("No customer signer");
  const toEmail = (contract.variables.customer.email || customerSigner.email || "").trim();
  if (!toEmail.includes("@")) throw new Error("CUSTOMER_EMAIL_MISSING");

  // Freeze what the customer will see: the unsigned PDF and its fingerprint.
  const isResend = contract.status !== "draft";
  let unsignedPdfHash = contract.unsignedPdfHash;
  let unsignedPdfUrl = contract.unsignedPdfUrl;
  if (!isResend || !unsignedPdfHash) {
    const stored = await renderAndStore(contract.id, "unsigned", false);
    unsignedPdfHash = stored.sha256;
    unsignedPdfUrl = stored.url;
  }

  const rawToken = newRawToken();
  const expiresAt = new Date(Date.now() + SIGNING_LINK_DAYS * 86_400_000);
  await db
    .update(contractSignersTable)
    .set({ tokenHash: hashToken(rawToken), tokenExpiresAt: expiresAt, email: toEmail, name: contract.variables.customer.name || customerSigner.name, status: "pending" })
    .where(eq(contractSignersTable.id, customerSigner.id));

  const [updated] = await db
    .update(contractsTable)
    .set({ status: "sent", sentAt: contract.sentAt ?? new Date(), expiresAt, unsignedPdfHash, unsignedPdfUrl })
    .where(eq(contractsTable.id, contract.id))
    .returning();

  const signUrl = `${getBaseUrl()}/sign/${rawToken}`;
  const [senderProfile] = await db.select({ logoUrl: businessProfilesTable.logoUrl, email: businessProfilesTable.email }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, params.userId));
  await sendContractSigningEmail({
    toEmail,
    userId: params.userId,
    customerName: contract.variables.customer.name,
    companyName: contract.variables.contractor.name,
    contractNumber: contract.contractNumber,
    total: contract.variables.total,
    signUrl,
    expiresAt,
    language: contract.language as Lang,
    message: params.message,
    companyLogoUrl: senderProfile?.logoUrl ?? null,
    replyTo: senderProfile?.email ?? null,
  });

  await logContractEvent({ contractId: contract.id, type: isResend ? "reminder_sent" : "sent", actor: "contractor", signerId: customerSigner.id, detail: { to: toEmail }, ip: params.ip, userAgent: params.userAgent });
  await writeAudit({ userId: params.userId, actorType: "user", actorId: params.userId, entityType: "contract", entityId: contract.id, action: isResend ? "resent" : "sent", ip: params.ip, userAgent: params.userAgent });
  return { contract: updated! };
}

// ── Finalize (all parties signed) ────────────────────────────────────────────

export async function finalizeContract(contractId: string): Promise<void> {
  const loaded = await loadContract(contractId);
  if (!loaded) return;
  const { contract, signers } = loaded;
  if (contract.status === "signed") return; // idempotent
  if (!signers.every((s) => s.status === "signed")) return;

  await logContractEvent({ contractId, type: "completed", actor: "system" });
  const stored = await renderAndStore(contractId, "signed", true);
  const signedAt = new Date();
  await db
    .update(contractsTable)
    .set({ status: "signed", signedAt, signedPdfHash: stored.sha256, signedPdfUrl: stored.url })
    .where(eq(contractsTable.id, contractId));
  if (contract.quoteId) {
    await db.update(quotesTable).set({ status: "accepted", acceptedAt: sql`coalesce(${quotesTable.acceptedAt}, now())` }).where(eq(quotesTable.id, contract.quoteId));
  }
  await writeAudit({ userId: contract.userId, actorType: "system", entityType: "contract", entityId: contractId, action: "executed", diff: { signedPdfHash: stored.sha256 } });

  const [owner] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, contract.userId));
  const recipients = [
    { email: contract.variables.customer.email || signers.find((s) => s.role === "customer")?.email, role: "customer" as const },
    { email: contract.variables.contractor.email || owner?.email, role: "contractor" as const },
  ].filter((r): r is { email: string; role: "customer" | "contractor" } => !!r.email && r.email.includes("@"));

  for (const r of recipients) {
    try {
      await sendContractSignedEmail({
        toEmail: r.email,
        userId: contract.userId,
        role: r.role,
        customerName: contract.variables.customer.name,
        companyName: contract.variables.contractor.name,
        contractNumber: contract.contractNumber,
        total: contract.variables.total,
        pdfBuffer: stored.buffer,
        language: contract.language as Lang,
        dashboardUrl: contract.kind === "change_order" && contract.projectId ? `${getBaseUrl()}/dashboard/jobs/${contract.projectId}?tab=changes` : `${getBaseUrl()}/dashboard/contracts/${contract.id}`,
        replyTo: contract.variables.contractor.email || owner?.email || null,
      });
    } catch (err) {
      logger.error({ err, contractId, to: r.email }, "Failed to email signed contract");
    }
  }

  // The contract.signed handler (Phase 2) sets up the job / applies the
  // change order and sends the single "signed — job set up" notification.
  await raiseAutomation({ event: "contract.signed", userId: contract.userId, entityType: "contract", entityId: contract.id });
}
