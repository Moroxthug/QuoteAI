import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  db,
  smsMessagesTable,
  smsOptOutsTable,
  usageEventsTable,
  leadsTable,
  leadEventsTable,
  clientsTable,
  effectivePlan,
  MONTHLY_USAGE_ALLOWANCE,
  type BusinessProfile,
  type SmsPurpose,
} from "@workspace/db";
import { isIntegrationConfigured } from "./integrationAvailability.js";
import { recordUsageEvent } from "./usage.js";
import { logger } from "./logger.js";

// ── Phase 74: SMS channel (Twilio) with CASL baked in ───────────────────────
// One choke point for every text QuoteAI sends. Every outbound message is
// composed here so it always carries (1) the contractor's identity and a
// contact number and (2) a working opt-out ("Reply STOP"), and every send is
// gated on: Twilio configured → phone valid → not opted out → plan allowance.
// Skips and failures are logged to sms_messages just like sends, so the
// Settings → SMS log explains why a customer did not get a text.
//
// The number is the platform's (TWILIO_FROM_NUMBER), shared by every
// contractor — STOP therefore opts a phone out of *all* QuoteAI texts, which
// is also what Twilio/the carriers enforce on their side.

export type Lang = "en" | "fr";

export type SmsSendResult =
  | { ok: true; sid: string | null; segments: number; body: string }
  | { ok: false; reason: "not_configured" | "invalid_phone" | "opted_out" | "allowance_exceeded" | "send_failed" };

/** Twilio bills a Canadian SMS segment at about US$0.0079 (Sept 2026); approximated in USD cents. */
const SMS_SEGMENT_COST_CENTS = 0.8;

/** Keywords Twilio treats as opt-out; the French ones are ours (Twilio's list is English-only). */
const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "ARRET", "ARRÊT", "DESABONNER", "DÉSABONNER", "DESINSCRIRE", "DÉSINSCRIRE"] as const;
const START_KEYWORDS = ["START", "UNSTOP", "YES", "OUI", "DEBUT", "DÉBUT", "REPRENDRE"] as const;

export function isSmsConfigured(): boolean {
  return isIntegrationConfigured("twilio");
}

/** Last four digits of the platform number, for the Settings card ("texts come from +1 ••• ••• 0199"). */
export function smsFromNumberHint(): string | null {
  const from = normalizePhone(process.env.TWILIO_FROM_NUMBER ?? "");
  return from ? `${from.slice(0, 2)} ••• ••• ${from.slice(-4)}` : null;
}

/**
 * North-American E.164 normaliser. Accepts "(613) 555-0100", "613.555.0100",
 * "+1 613 555 0100", "1-613-555-0100"; returns null for anything that is not
 * ten digits after an optional country code 1 (international numbers are
 * kept only when written with an explicit "+").
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    return null;
  }
  if (digits.length === 10 && digits[0] !== "0" && digits[0] !== "1") return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1") && digits[1] !== "0" && digits[1] !== "1") return `+${digits}`;
  return null;
}

/** Formats a stored E.164 number for humans: +16135550100 → (613) 555-0100. */
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

const GSM7 = /^[A-Za-z0-9 @£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/;

/**
 * Carrier segments for a body: 160 chars per single GSM-7 segment (153 when
 * concatenated), 70/67 for UCS-2 (any character outside the GSM-7 set — most
 * French accents other than é/è/à/ù fall here). This is what Twilio bills.
 */
export function smsSegments(body: string): number {
  if (body.length === 0) return 1;
  const gsm = GSM7.test(body);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return body.length <= single ? 1 : Math.ceil(body.length / multi);
}

/** Longest body a purpose may produce before the identity/opt-out lines — keeps every text within two segments. */
const MAX_BODY_CHARS = 200;

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  // Three dots, not "…": the ellipsis character is outside GSM-7 and would double the segment count.
  return clean.length <= max ? clean : `${clean.slice(0, max - 3).trimEnd()}...`;
}

/**
 * The CASL block: who is texting (business name + a way to reach them) and
 * how to stop. Prepended/appended to every outbound message without
 * exception — callers pass the message body only.
 */
export function composeSms(params: { profile: Pick<BusinessProfile, "companyName" | "phone">; body: string; lang: Lang; optOut?: boolean }): string {
  const company = truncate(params.profile.companyName || "QuoteAI", 40);
  const contact = normalizePhone(params.profile.phone);
  const identity = contact ? `${company} (${formatPhone(contact)})` : company;
  const body = truncate(params.body, MAX_BODY_CHARS);
  const footer = params.optOut === false ? "" : params.lang === "fr" ? " Répondez STOP pour ne plus recevoir de textos." : " Reply STOP to opt out.";
  return `${identity}: ${body}${footer}`;
}

async function isOptedOut(phone: string): Promise<boolean> {
  const [row] = await db.select({ id: smsOptOutsTable.id }).from(smsOptOutsTable).where(eq(smsOptOutsTable.phone, phone)).limit(1);
  return !!row;
}

/** Segments sent this calendar month (UTC) — the metered quantity the allowance is compared against. */
export async function smsUsedThisMonth(userId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ used: sql<string>`COALESCE(SUM(${usageEventsTable.quantity}), 0)` })
    .from(usageEventsTable)
    .where(and(eq(usageEventsTable.userId, userId), eq(usageEventsTable.kind, "sms"), gte(usageEventsTable.createdAt, monthStart)));
  return Math.round(Number(row?.used ?? 0));
}

export function smsAllowance(profile: BusinessProfile | null | undefined): number | null {
  return MONTHLY_USAGE_ALLOWANCE[effectivePlan(profile)].smsMessages;
}

async function logMessage(row: {
  userId: string | null;
  direction: "outbound" | "inbound";
  purpose: SmsPurpose;
  status: "sent" | "failed" | "skipped" | "received";
  phone: string;
  body: string;
  segments?: number;
  language?: Lang;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  providerSid?: string | null;
  error?: string | null;
}): Promise<void> {
  try {
    await db.insert(smsMessagesTable).values({
      userId: row.userId,
      direction: row.direction,
      purpose: row.purpose,
      status: row.status,
      phone: row.phone,
      body: row.body,
      segments: row.segments ?? smsSegments(row.body),
      language: row.language ?? "en",
      relatedEntityType: row.relatedEntityType ?? null,
      relatedEntityId: row.relatedEntityId ?? null,
      providerSid: row.providerSid ?? null,
      error: row.error ?? null,
    });
  } catch (err) {
    logger.warn({ err }, "Could not log SMS message");
  }
}

type TwilioSendResult = { ok: true; sid: string | null } | { ok: false; error: string };

/** Plain REST call (no SDK): POST form fields with Basic auth, exactly what e2e stubs at the fetch boundary. */
async function twilioSend(to: string, body: string): Promise<TwilioSendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = normalizePhone(process.env.TWILIO_FROM_NUMBER) ?? process.env.TWILIO_FROM_NUMBER!;
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL;
  if (statusCallback) form.set("StatusCallback", statusCallback);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok) return { ok: false, error: `twilio ${res.status}${json.code ? ` (${json.code})` : ""}: ${json.message ?? "send failed"}` };
    return { ok: true, sid: json.sid ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

/**
 * Sends one text on behalf of a contractor. `body` is the message only — the
 * identity line and the STOP footer are added here. Returns a reason on every
 * non-send so callers can fall back (usually to email) or surface it.
 */
export async function sendSms(params: {
  profile: BusinessProfile;
  to: string | null | undefined;
  body: string;
  lang: Lang;
  purpose: SmsPurpose;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Promise<SmsSendResult> {
  const { profile, lang, purpose } = params;
  const userId = profile.userId;
  const phone = normalizePhone(params.to);
  const text = composeSms({ profile, body: params.body, lang });
  const base = { userId, direction: "outbound" as const, purpose, language: lang, relatedEntityType: params.relatedEntityType ?? null, relatedEntityId: params.relatedEntityId ?? null };

  if (!phone) {
    await logMessage({ ...base, status: "skipped", phone: (params.to ?? "").trim() || "-", body: text, error: "invalid_phone" });
    return { ok: false, reason: "invalid_phone" };
  }
  if (!isSmsConfigured()) {
    await logMessage({ ...base, status: "skipped", phone, body: text, error: "not_configured" });
    return { ok: false, reason: "not_configured" };
  }
  if (await isOptedOut(phone)) {
    await logMessage({ ...base, status: "skipped", phone, body: text, error: "opted_out" });
    return { ok: false, reason: "opted_out" };
  }
  const segments = smsSegments(text);
  const allowance = smsAllowance(profile);
  if (allowance !== null) {
    const used = await smsUsedThisMonth(userId);
    if (used + segments > allowance) {
      await logMessage({ ...base, status: "skipped", phone, body: text, segments, error: "allowance_exceeded" });
      return { ok: false, reason: "allowance_exceeded" };
    }
  }

  const sent = await twilioSend(phone, text);
  if (!sent.ok) {
    logger.error({ userId, phone, purpose, error: sent.error }, "SMS send failed");
    await logMessage({ ...base, status: "failed", phone, body: text, segments, error: sent.error });
    return { ok: false, reason: "send_failed" };
  }
  await logMessage({ ...base, status: "sent", phone, body: text, segments, providerSid: sent.sid });
  await recordUsageEvent({ userId, kind: "sms", quantity: segments, unitCostCents: SMS_SEGMENT_COST_CENTS, relatedEntityType: params.relatedEntityType, relatedEntityId: params.relatedEntityId });
  return { ok: true, sid: sent.sid, segments, body: text };
}

// ── Inbound (Twilio → us) ───────────────────────────────────────────────────

/**
 * Twilio signs every webhook: HMAC-SHA1(auth token) over the exact URL it
 * called plus every POST field appended as key+value in key order, base64.
 * The URL must be the one configured in the Twilio console — behind Vercel
 * that is the public https URL, so callers pass it explicitly.
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", authToken).update(data).digest("base64");
}

export function verifyTwilioSignature(signature: string | undefined, url: string, params: Record<string, string>): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const expected = Buffer.from(twilioSignature(token, url, params));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type InboundOutcome = { kind: "opt_out"; keyword: string } | { kind: "opt_in"; keyword: string } | { kind: "reply" };

function classifyKeyword(body: string): InboundOutcome {
  const word = body.trim().toUpperCase().replace(/[.!]+$/, "");
  if ((STOP_KEYWORDS as readonly string[]).includes(word)) return { kind: "opt_out", keyword: word };
  if ((START_KEYWORDS as readonly string[]).includes(word)) return { kind: "opt_in", keyword: word };
  return { kind: "reply" };
}

/** The contractor who most recently texted this number — the best owner for a reply or a STOP. */
async function lastSenderTo(phone: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: smsMessagesTable.userId })
    .from(smsMessagesTable)
    .where(and(eq(smsMessagesTable.phone, phone), eq(smsMessagesTable.direction, "outbound"), eq(smsMessagesTable.status, "sent")))
    .orderBy(sql`${smsMessagesTable.createdAt} DESC`)
    .limit(1);
  return row?.userId ?? null;
}

/**
 * Records an inbound text and applies its effect: STOP → phone-wide opt-out +
 * every lead/client with that number flips to unsubscribed (CASL: "without
 * delay"); START → opt-out removed; anything else → stored as a reply for
 * the contractor who last texted the number. Returns what happened so the
 * webhook can notify.
 */
export async function handleInboundSms(params: { from: string; body: string; providerSid?: string | null }): Promise<InboundOutcome & { userId: string | null; phone: string }> {
  const phone = normalizePhone(params.from) ?? params.from;
  const userId = await lastSenderTo(phone);
  const outcome = classifyKeyword(params.body);

  if (outcome.kind === "opt_out") {
    await db
      .insert(smsOptOutsTable)
      .values({ phone, source: "stop_keyword", keyword: outcome.keyword, userId })
      .onConflictDoUpdate({ target: smsOptOutsTable.phone, set: { keyword: outcome.keyword, optedOutAt: new Date(), userId } });
    await unsubscribeEverythingWithPhone(phone);
  } else if (outcome.kind === "opt_in") {
    await db.delete(smsOptOutsTable).where(eq(smsOptOutsTable.phone, phone));
  }

  await logMessage({
    userId,
    direction: "inbound",
    purpose: outcome.kind === "reply" ? "reply" : outcome.kind,
    status: "received",
    phone,
    body: params.body.slice(0, 1600),
    providerSid: params.providerSid ?? null,
  });
  return { ...outcome, userId, phone };
}

/**
 * A STOP is an opt-out from the *person*, not from one contractor's
 * sequence: every lead and client row carrying that number stops receiving
 * automated messages on every channel. Phone columns are free text, so the
 * match normalises on the fly (digits only, last ten).
 */
async function unsubscribeEverythingWithPhone(phone: string): Promise<void> {
  const last10 = phone.replace(/\D/g, "").slice(-10);
  if (last10.length !== 10) return;
  const now = new Date();
  const leads = await db
    .update(leadsTable)
    .set({ status: "unsubscribed", unsubscribedAt: now, nextFollowUpAt: null })
    .where(and(sql`right(regexp_replace(coalesce(${leadsTable.phone}, ''), '\\D', '', 'g'), 10) = ${last10}`, sql`${leadsTable.unsubscribedAt} IS NULL`))
    .returning({ id: leadsTable.id, userId: leadsTable.userId });
  for (const lead of leads) {
    await db.insert(leadEventsTable).values({ leadId: lead.id, userId: lead.userId, type: "unsubscribed", channel: "sms", payload: { via: "sms_stop" } });
  }
  await db
    .update(clientsTable)
    .set({ marketingUnsubscribedAt: now })
    .where(and(sql`right(regexp_replace(coalesce(${clientsTable.phone}, ''), '\\D', '', 'g'), 10) = ${last10}`, sql`${clientsTable.marketingUnsubscribedAt} IS NULL`));
}

/** Manual opt-out from the dashboard (a customer asked in person / by email). */
export async function optOutPhone(phone: string, userId: string): Promise<void> {
  await db
    .insert(smsOptOutsTable)
    .values({ phone, source: "manual", userId })
    .onConflictDoNothing();
  await unsubscribeEverythingWithPhone(phone);
}

