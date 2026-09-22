import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import {
  db,
  clientsTable,
  clientPortalSessionsTable,
  clientMessagesTable,
  quotesTable,
  contractsTable,
  contractSignersTable,
  invoicesTable,
  projectsTable,
  milestonesTable,
  jobPhotosTable,
  businessProfilesTable,
  hasFeature,
  type Client,
  type BusinessProfile,
  type ClientMessage,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getBaseUrl } from "../lib/baseUrl.js";
import { invoiceToken } from "../invoices/service.js";
import { balanceCents } from "../invoices/math.js";
import { getConnectAccount } from "../invoices/stripeConnect.js";

// ── Phase 76: client portal ─────────────────────────────────────────────────
// The portal link token is deterministic — an HMAC of the client id with the
// server secret, exactly like invoice links — so the invoice page, the signing
// page and the quote page can all rebuild it; only its hash is stored (for
// the lookup) and nothing is readable with the token alone: the client proves
// the mailbox with a 6-digit emailed code and then holds a session token.

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function linkSecret(): string {
  const secret = process.env.INVOICE_LINK_SECRET ?? process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) throw new Error("No server secret configured for portal links (set INVOICE_LINK_SECRET)");
  return secret;
}

export function portalToken(client: Pick<Client, "id" | "userId">): string {
  return createHmac("sha256", linkSecret()).update(`portal:${client.userId}:${client.id}`).digest("base64url");
}

export function portalUrl(rawToken: string): string {
  return `${getBaseUrl()}/portal/${rawToken}`;
}

/** The client's portal URL, issuing (storing the hash of) the link on first use. Null when the client has no email — nobody could pass the code gate. */
export async function ensurePortalLink(client: Pick<Client, "id" | "userId" | "email" | "portalTokenHash" | "archivedAt">): Promise<string | null> {
  if (!client.email || client.archivedAt) return null;
  const raw = portalToken(client);
  if (client.portalTokenHash !== hashToken(raw)) {
    await db.update(clientsTable).set({ portalTokenHash: hashToken(raw) }).where(eq(clientsTable.id, client.id));
  }
  return portalUrl(raw);
}

/** Convenience for the document pages (/i, /sign, /p): the portal link for a row's client_id, or null. */
export async function portalLinkForClient(clientId: string | null | undefined): Promise<string | null> {
  if (!clientId) return null;
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) return null;
  return ensurePortalLink(client);
}

export function maskEmail(email: string): string {
  return email.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
}

// ── OTP ─────────────────────────────────────────────────────────────────────

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

export function newOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function otpHash(clientId: string, code: string): string {
  return createHash("sha256").update(`portal:${clientId}:${code}`).digest("hex");
}

/** Constant-time check of a submitted code against the stored hash. */
export function otpMatches(client: Pick<Client, "id" | "portalOtpHash">, code: string): boolean {
  if (!client.portalOtpHash) return false;
  const expected = Buffer.from(client.portalOtpHash, "hex");
  const provided = createHash("sha256").update(`portal:${client.id}:${code}`).digest();
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

// ── Sessions ────────────────────────────────────────────────────────────────

const SESSION_DAYS = 30;

export async function issueSession(client: Client, meta: { ip?: string | null; userAgent?: string | null }): Promise<{ raw: string; expiresAt: Date }> {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(clientPortalSessionsTable).values({ userId: client.userId, clientId: client.id, tokenHash: hashToken(raw), expiresAt, lastSeenAt: new Date(), ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 500) ?? null });
  await db.update(clientsTable).set({ portalLastSeenAt: new Date() }).where(eq(clientsTable.id, client.id));
  return { raw, expiresAt };
}

/** A live session for this client, or null. Touches `last_seen_at` (at most once a minute). */
export async function resolveSession(client: Pick<Client, "id">, rawSession: string | undefined): Promise<{ id: string; expiresAt: Date } | null> {
  if (!rawSession || rawSession.length < 20 || rawSession.length > 200) return null;
  const [s] = await db.select().from(clientPortalSessionsTable).where(and(eq(clientPortalSessionsTable.tokenHash, hashToken(rawSession)), eq(clientPortalSessionsTable.clientId, client.id)));
  if (!s || s.revokedAt || s.expiresAt < new Date()) return null;
  if (!s.lastSeenAt || s.lastSeenAt.getTime() < Date.now() - 60_000) {
    await db.update(clientPortalSessionsTable).set({ lastSeenAt: new Date() }).where(eq(clientPortalSessionsTable.id, s.id));
    await db.update(clientsTable).set({ portalLastSeenAt: new Date() }).where(eq(clientsTable.id, client.id));
  }
  return { id: s.id, expiresAt: s.expiresAt };
}

export async function revokeSession(rawSession: string): Promise<void> {
  await db.update(clientPortalSessionsTable).set({ revokedAt: new Date() }).where(eq(clientPortalSessionsTable.tokenHash, hashToken(rawSession)));
}

// ── Overview ────────────────────────────────────────────────────────────────
// What the client sees. Same visibility rules as the individual public pages:
// quotes only once unlocked, contracts only once sent, invoices only once
// sent — drafts never leak through the portal.

export type PortalQuote = { id: string; number: string; title: string; total: number; status: "unlocked" | "accepted"; acceptedAt: string | null; createdAt: string; url: string };
export type PortalContract = { id: string; contractNumber: string; kind: string; title: string; status: string; total: number; sentAt: string | null; signedAt: string | null; expiresAt: string | null; canSign: boolean; jobId: string | null };
export type PortalInvoice = { id: string; number: string; type: string; status: string; title: string; issueDate: string; dueDate: string; totalCents: number; paidCents: number; balanceCents: number; canPayByCard: boolean; etransferEmail: string | null; jobId: string | null; url: string | null; paidAt: string | null };
type PortalMilestone = { id: string; title: string; status: string; plannedStart: string | null; plannedEnd: string | null; actualEnd: string | null };
type PortalPhoto = { id: string; caption: string; createdAt: string; milestoneId: string | null };
export type PortalJob = { id: string; name: string; address: string; status: string; progressPercent: number; plannedStart: string | null; plannedEnd: string | null; completedAt: string | null; milestones: PortalMilestone[]; photos: PortalPhoto[] };
export type PortalMessage = { id: string; sender: "contractor" | "client"; senderName: string; body: string; jobId: string | null; jobName: string | null; createdAt: string; readAt: string | null };

export function serializeMessage(m: ClientMessage, jobNames: Map<string, string>): PortalMessage {
  return { id: m.id, sender: m.sender, senderName: m.senderName, body: m.body, jobId: m.projectId, jobName: m.projectId ? (jobNames.get(m.projectId) ?? null) : null, createdAt: m.createdAt.toISOString(), readAt: m.readAt?.toISOString() ?? null };
}

/** Which contract statuses a customer can act on from the portal. */
export function contractCanSign(contract: { status: string; expiresAt: Date | null }, signer: { email: string; status: string } | undefined, clientEmail: string | null): boolean {
  if (!signer || !clientEmail) return false;
  if (contract.status !== "sent" && contract.status !== "viewed") return false;
  if (contract.expiresAt && contract.expiresAt < new Date()) return false;
  if (signer.status === "signed" || signer.status === "declined") return false;
  return signer.email.trim().toLowerCase() === clientEmail.trim().toLowerCase();
}

export const PORTAL_INVOICE_STATUSES = ["sent", "viewed", "pending_confirmation", "partially_paid", "paid", "overdue"] as const;
export const PORTAL_CONTRACT_STATUSES = ["sent", "viewed", "signed", "expired", "declined"] as const;

export async function buildOverview(client: Client, profile: BusinessProfile | undefined): Promise<{ quotes: PortalQuote[]; contracts: PortalContract[]; invoices: PortalInvoice[]; jobs: PortalJob[]; messages: PortalMessage[] }> {
  const [quotes, contracts, invoices, projects] = await Promise.all([
    db.select().from(quotesTable).where(and(eq(quotesTable.clientId, client.id), inArray(quotesTable.status, ["unlocked", "accepted"]), isNull(quotesTable.archivedAt))).orderBy(desc(quotesTable.createdAt)),
    db.select().from(contractsTable).where(and(eq(contractsTable.clientId, client.id), inArray(contractsTable.status, [...PORTAL_CONTRACT_STATUSES]), isNull(contractsTable.archivedAt))).orderBy(desc(contractsTable.createdAt)),
    db.select().from(invoicesTable).where(and(eq(invoicesTable.clientId, client.id), inArray(invoicesTable.status, [...PORTAL_INVOICE_STATUSES]), isNull(invoicesTable.archivedAt))).orderBy(desc(invoicesTable.issueDate)),
    db.select().from(projectsTable).where(and(eq(projectsTable.clientId, client.id), isNull(projectsTable.archivedAt), ne(projectsTable.setupStatus, "pending_review"))).orderBy(desc(projectsTable.createdAt)),
  ]);

  const projectIds = projects.map((p) => p.id);
  const milestones = projectIds.length ? await db.select().from(milestonesTable).where(inArray(milestonesTable.projectId, projectIds)).orderBy(asc(milestonesTable.sortOrder)) : [];
  const photos = projectIds.length ? await db.select().from(jobPhotosTable).where(inArray(jobPhotosTable.projectId, projectIds)).orderBy(asc(jobPhotosTable.sortOrder), asc(jobPhotosTable.createdAt)) : [];
  const signers = contracts.length ? await db.select().from(contractSignersTable).where(and(inArray(contractSignersTable.contractId, contracts.map((c) => c.id)), eq(contractSignersTable.role, "customer"))) : [];

  const conn = profile && hasFeature(profile, "invoice_card_payments") ? await getConnectAccount(client.userId) : null;
  const canPayByCard = !!conn?.chargesEnabled;
  const jobNames = new Map(projects.map((p) => [p.id, p.name]));

  const messages = await db.select().from(clientMessagesTable).where(eq(clientMessagesTable.clientId, client.id)).orderBy(asc(clientMessagesTable.createdAt)).limit(300);
  // Loading the portal counts as reading what the company wrote.
  const unread = messages.filter((m) => m.sender === "contractor" && !m.readAt).map((m) => m.id);
  if (unread.length) {
    const now = new Date();
    await db.update(clientMessagesTable).set({ readAt: now }).where(inArray(clientMessagesTable.id, unread));
    for (const m of messages) if (unread.includes(m.id)) m.readAt = now;
  }

  return {
    quotes: quotes.map((q) => ({
      id: q.id,
      number: q.numeroPreventivoData ?? "",
      title: q.titoloPreventivoRiga2 || q.descrizioneGenerale || q.titoloPreventivoRiga1 || "",
      total: Number(q.totale),
      status: q.status as "unlocked" | "accepted",
      acceptedAt: q.acceptedAt?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
      url: `${getBaseUrl()}/p/${q.id}`,
    })),
    contracts: contracts.map((c) => {
      const signer = signers.find((s) => s.contractId === c.id);
      return {
        id: c.id,
        contractNumber: c.contractNumber,
        kind: c.kind,
        title: c.document.title,
        status: c.status,
        total: c.variables.total,
        sentAt: c.sentAt?.toISOString() ?? null,
        signedAt: c.signedAt?.toISOString() ?? null,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        canSign: contractCanSign(c, signer, client.email),
        jobId: c.projectId && jobNames.has(c.projectId) ? c.projectId : null,
      };
    }),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      type: inv.type,
      status: inv.status,
      title: inv.title,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      totalCents: inv.totalCents,
      paidCents: inv.paidCents,
      balanceCents: balanceCents(inv),
      canPayByCard: canPayByCard && inv.type !== "credit_note" && balanceCents(inv) > 0 && inv.status !== "paid",
      etransferEmail: inv.paymentInstructions?.etransferEmail ?? null,
      jobId: inv.projectId && jobNames.has(inv.projectId) ? inv.projectId : null,
      url: inv.publicTokenHash ? `${getBaseUrl()}/i/${invoiceToken(inv)}` : null,
      paidAt: inv.paidAt?.toISOString() ?? null,
    })),
    jobs: projects.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      status: p.status,
      progressPercent: p.progressPercent,
      plannedStart: p.plannedStart?.toISOString() ?? null,
      plannedEnd: p.plannedEnd?.toISOString() ?? null,
      completedAt: p.completedAt?.toISOString() ?? null,
      milestones: milestones.filter((m) => m.projectId === p.id).map((m) => ({ id: m.id, title: m.title, status: m.status, plannedStart: m.plannedStart?.toISOString() ?? null, plannedEnd: m.plannedEnd?.toISOString() ?? null, actualEnd: m.actualEnd?.toISOString() ?? null })),
      photos: photos.filter((ph) => ph.projectId === p.id).map((ph) => ({ id: ph.id, caption: ph.caption, createdAt: ph.createdAt.toISOString(), milestoneId: ph.milestoneId })),
    })),
    messages: messages.map((m) => serializeMessage(m, jobNames)),
  };
}

/** Company + client header shown before and after the code gate. */
export async function portalHeader(client: Client): Promise<{ profile: BusinessProfile | undefined; company: { name: string; logoUrl: string | null; email: string | null; phone: string | null }; language: "en" | "fr" }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, client.userId));
  return {
    profile,
    company: { name: profile?.companyName || "", logoUrl: profile?.logoUrl ?? null, email: profile?.email ?? null, phone: profile?.phone ?? null },
    language: client.preferredLanguage === "fr" ? "fr" : "en",
  };
}

/** Unread client replies for the company, optionally for one client. */
export async function unreadClientMessageCount(userId: string, clientId?: string): Promise<number> {
  const rows = await db
    .select({ id: clientMessagesTable.id })
    .from(clientMessagesTable)
    .where(and(eq(clientMessagesTable.userId, userId), eq(clientMessagesTable.sender, "client"), isNull(clientMessagesTable.readAt), ...(clientId ? [eq(clientMessagesTable.clientId, clientId)] : [])));
  return rows.length;
}

