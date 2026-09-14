import { logger } from "./logger.js";

// Thin wrapper over Google's OAuth2 + Gmail API, send-only. Same "plain fetch
// against the vendor's REST API" approach as googleCalendarClient.ts. Scope
// is deliberately limited to gmail.send — a Google "sensitive" scope (standard
// OAuth verification) rather than "restricted" (gmail.readonly/modify, which
// requires an annual CASA security assessment) — this client never reads a
// mailbox, only sends through it.

const CLIENT_ID = process.env.GMAIL_SEND_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GMAIL_SEND_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.GMAIL_SEND_REDIRECT_URI ?? "";

if (!CLIENT_ID || !CLIENT_SECRET) {
  logger.error("WARNING: GMAIL_SEND_CLIENT_ID/GMAIL_SEND_CLIENT_SECRET are not set. Connected Gmail sending will fail.");
}

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const SCOPE = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email";

export function buildGmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

export type GmailTokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function tokenRequest(body: URLSearchParams): Promise<GmailTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<GmailTokenResponse>;
}

export function exchangeGmailCode(code: string): Promise<GmailTokenResponse> {
  return tokenRequest(new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }));
}

export function refreshGmailToken(refreshToken: string): Promise<GmailTokenResponse> {
  return tokenRequest(new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }));
}

export async function revokeGmailToken(token: string): Promise<void> {
  try {
    await fetch(REVOKE_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `token=${encodeURIComponent(token)}` });
  } catch (err) {
    logger.warn({ err }, "Gmail token revoke failed (ignoring — disconnect still proceeds)");
  }
}

export async function getGmailAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return "";
  const data = (await res.json()) as { email?: string };
  return data.email ?? "";
}

function encodeHeaderWord(value: string): string {
  // RFC 2047 — only needed when the display name carries non-ASCII characters.
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function quoteDisplayName(name: string): string {
  const cleaned = name.replace(/[\r\n"]/g, "").trim();
  return `"${encodeHeaderWord(cleaned)}"`;
}

export type GmailAttachment = { filename: string; content: string /* base64 */; contentType?: string };

/** Builds a base64url-encoded RFC 2822 MIME message for the Gmail API's `users.messages.send`. */
function buildRawMessage(params: {
  fromAddress: string;
  fromName: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: GmailAttachment[];
}): string {
  const boundary = `qai_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ${quoteDisplayName(params.fromName)} <${params.fromAddress}>`,
    `To: ${params.to}`,
    ...(params.replyTo ? [`Reply-To: ${params.replyTo}`] : []),
    `Subject: ${encodeHeaderWord(params.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const htmlPart = [`--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(params.html, "utf8").toString("base64")].join("\r\n");

  const attachmentParts = (params.attachments ?? []).map((att) =>
    [
      `--${boundary}`,
      `Content-Type: ${att.contentType ?? "application/pdf"}; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
      att.content,
    ].join("\r\n"),
  );

  const message = [headers.join("\r\n"), "", htmlPart, ...attachmentParts, `--${boundary}--`, ""].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

/** Sends one email through the connected Gmail account. Throws on failure — callers fall back to Resend. */
export async function sendGmailMessage(params: {
  accessToken: string;
  fromAddress: string;
  fromName: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: GmailAttachment[];
}): Promise<void> {
  const raw = buildRawMessage(params);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${params.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
}
