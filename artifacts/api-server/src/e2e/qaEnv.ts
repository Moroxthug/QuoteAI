// Shared bootstrap for the standalone QA scripts (walkthrough, cleanup, the
// Phase 67 visual/a11y sweep and PDF matrix): read `.env.staging`, fill the
// secrets the app refuses to boot without, and — unless a real AI key is
// present — point the AI client at a closed port so every call takes its
// deterministic fallback (same trick as vitest.e2e.setup.ts).
//
// Import this module first; it mutates process.env at import time, before
// `app.ts` builds its clients.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadDotenv(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2]!;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value !== "") process.env[m[1]!] ??= value;
  }
}

export const STAGING_ENV_PATH = resolve(import.meta.dirname, "../../../../.env.staging");

export function bootstrapQaEnv(label: string): void {
  loadDotenv(STAGING_ENV_PATH);
  process.env.BETTER_AUTH_SECRET ??= `${label}-secret-not-for-production-0000`;
  process.env.TOKEN_ENCRYPTION_KEY ??= "0".repeat(64);
  process.env.CRON_SECRET ??= `${label}-cron-secret`;
  process.env.LOG_LEVEL ??= "warn";
  process.env.RESEND_API_KEY ??= `re_${label}_mock`;
  // Vercel pulls Sensitive vars as empty strings, so the AI key is usually
  // absent locally. Without one, point the client at a closed port so every AI
  // call takes its deterministic fallback.
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = `${label}-no-ai`;
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "http://127.0.0.1:9/v1";
    if (process.env.LOG_LEVEL !== "silent") console.warn(`[${label}] no AI key set — AI features run their fallbacks (set GROQ_API_KEY to use real models)`);
  }
}

export type CapturedMail = { at: string; to: string[]; from: string; subject: string; links: string[]; html: string };

/**
 * Answer api.resend.com at the fetch boundary and keep every message. Returns
 * the mailbox; `onMail` runs per message (the walkthrough prints the links).
 */
export async function captureResend(onMail?: (mail: CapturedMail) => void): Promise<CapturedMail[]> {
  const { stubHost, json } = await import("./vendorStub.js");
  const mailbox: CapturedMail[] = [];
  stubHost("https://api.resend.com/", (req) => {
    const body = (req.json ?? {}) as { to?: string | string[]; from?: string; subject?: string; html?: string };
    const html = body.html ?? "";
    const links = [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&")))];
    const mail: CapturedMail = { at: new Date().toISOString(), to: Array.isArray(body.to) ? body.to : [body.to ?? ""], from: body.from ?? "", subject: body.subject ?? "", links, html };
    mailbox.push(mail);
    onMail?.(mail);
    return json(200, { id: `${label(mailbox.length)}` });
  });
  return mailbox;
}

const label = (n: number) => `captured-${n}`;
