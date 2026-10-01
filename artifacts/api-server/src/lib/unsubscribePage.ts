import { db, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";

/**
 * Pocket 125.10: the page a client lands on from an unsubscribe link, built from the
 * Unsubscribe board's "done" screen (docs/pocket-design/Unsubscribe.dc.html): the company
 * header, a check, "No more {x} by email", an Unsubscribed pill and the note that invoices
 * still arrive. Tokens are handoff/tokens/tokens.css (light and night follow the phone).
 * The unsubscribe itself still happens on the GET (CASL: it takes effect without delay), so
 * the board's channel choice and "Resubscribe" are not offered here.
 */

export type UnsubscribeKind = "reminders" | "followups" | "marketing";
type Lang = "en" | "fr";

const TEXT: Record<Lang, {
  from: string; unsubscribed: string; stillTitle: string; still: string; sentWith: string; invalid: string; missing: string; error: string;
  title: Record<UnsubscribeKind, string>; sub: Record<UnsubscribeKind, string>;
}> = {
  en: {
    from: "From",
    unsubscribed: "Unsubscribed",
    stillTitle: "Invoices still arrive.",
    still: "So do receipts and documents to sign, while you have work with us.",
    sentWith: "Sent with quoteAI",
    invalid: "This unsubscribe link is no longer valid.",
    missing: "Missing unsubscribe link.",
    error: "Something went wrong. Please try again later.",
    title: { reminders: "No more reminders by email", followups: "No more follow-ups by email", marketing: "No more review requests or photos by email" },
    sub: { reminders: "You won't receive any more reminders about this quote.", followups: "You won't receive any more follow-up messages from us.", marketing: "You won't receive any more review requests or shared photos from us." },
  },
  fr: {
    from: "De la part de",
    unsubscribed: "Désabonné",
    stillTitle: "Les factures arrivent toujours.",
    still: "Tout comme les reçus et les documents à signer, tant que nous avons des travaux avec vous.",
    sentWith: "Envoyé avec quoteAI",
    invalid: "Ce lien de désabonnement n'est plus valide.",
    missing: "Lien de désabonnement manquant.",
    error: "Une erreur s'est produite. Veuillez réessayer plus tard.",
    title: { reminders: "Plus de rappels par courriel", followups: "Plus de relances par courriel", marketing: "Plus de demandes d'avis ni de photos par courriel" },
    sub: { reminders: "Vous ne recevrez plus de rappels au sujet de cette soumission.", followups: "Vous ne recevrez plus de messages de relance de notre part.", marketing: "Vous ne recevrez plus de demandes d'avis ni de photos partagées de notre part." },
  },
};

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** The client's language when we know it, else the browser's, else English. */
export function pickLang(req: Request, preferred?: string | null): Lang {
  if (preferred === "fr" || preferred === "en") return preferred;
  return req.acceptsLanguages(["en", "fr"]) === "fr" ? "fr" : "en";
}

export async function companyNameForUser(userId: string): Promise<string> {
  try {
    const [p] = await db.select({ companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    return p?.companyName?.trim() ?? "";
  } catch {
    return "";
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Q";
  return ((parts[0]![0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] ?? "" : "")).toUpperCase();
}

const CSS = `
@font-face{font-family:'QDigits';src:url('/fonts/manrope-digits.woff2') format('woff2');font-weight:200 800;unicode-range:U+0030-0039,U+0024,U+0025,U+002B,U+2212,U+00B0}
@font-face{font-family:'Geist';src:url('/fonts/geist-latin-wght-normal.woff2') format('woff2-variations');font-weight:300 600}
:root{color-scheme:light dark;--ground:#f2f2f8;--card:#ffffff;--sunk:#e8e7f2;--ink:#141416;--inv:#141416;--on-inv:#ffffff;--t2:#3c3c43;--muted:#66666e;--faint:#8a8a90;--line:#e8e7f1;--ring:rgba(20,20,22,.05);--ok:#1f7a45;--ok-soft:#e8f3ee;--fade:linear-gradient(0deg,#ece6f8 0,#f0edf9 220px,#f3f5f8 560px)}
@media (prefers-color-scheme:dark){:root{--ground:#0c0c0e;--card:#18181b;--sunk:#26262b;--ink:#f3f2ef;--inv:#f3f2ef;--on-inv:#141416;--t2:#d0cfd5;--muted:#a09fa7;--faint:#7c7b83;--line:rgba(255,255,255,.07);--ring:rgba(255,255,255,.07);--ok:#62d498;--ok-soft:rgba(52,195,117,.16);--fade:none}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--fade),var(--ground);background-attachment:fixed;color:var(--ink);font-family:QDigits,Geist,-apple-system,"SF Pro Text","Segoe UI",sans-serif;font-size:15px;line-height:1.4;letter-spacing:-0.01em;-webkit-font-smoothing:antialiased}
main{max-width:520px;margin:0 auto;padding-bottom:40px}
header{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}
.mark{width:40px;height:40px;border-radius:12px;background:var(--inv);color:var(--on-inv);display:flex;align-items:center;justify-content:center;font-size:13.5px;font-weight:600;letter-spacing:-0.02em;flex-shrink:0}
.t{display:flex;flex-direction:column;gap:1px;min-width:0}.t span{font-size:12.5px;color:var(--muted)}.t b{font-size:15px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card{margin:40px 16px 0;padding:28px 20px 20px;display:flex;flex-direction:column;align-items:center;text-align:center;background:var(--card);border-radius:22px;box-shadow:0 0 0 1px var(--ring)}
.disc{width:64px;height:64px;border-radius:50%;background:var(--ok-soft);display:flex;align-items:center;justify-content:center;color:var(--ok)}
h1{margin:16px 0 0;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.035em;text-wrap:balance}
.sub{margin:8px 0 0;font-size:13.5px;color:var(--muted);line-height:1.5;max-width:290px}
.st{display:inline-flex;align-items:center;gap:5px;height:24px;margin-top:14px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:600;background:var(--sunk);color:var(--muted)}
.note{width:100%;margin-top:20px;padding-top:16px;border-top:1px solid var(--line);text-align:left;font-size:13.5px;color:var(--t2);line-height:1.45}.note b{font-weight:600}
.msg{margin:40px 16px 0;padding:20px;background:var(--card);border-radius:22px;box-shadow:0 0 0 1px var(--ring);text-align:center;font-size:14.5px;color:var(--t2)}
.foot{margin:24px 16px 0;text-align:center;font-size:12.5px;color:var(--faint)}
`;

function shell(lang: Lang, company: string, body: string): string {
  const T = TEXT[lang];
  return `<!DOCTYPE html><html lang="${lang === "fr" ? "fr-CA" : "en-CA"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex"><title>${escapeHtml(company ? `${T.unsubscribed} · ${company}` : T.unsubscribed)}</title><style>${CSS}</style></head><body><main>${
    company ? `<header><span class="mark" aria-hidden="true">${escapeHtml(initials(company))}</span><span class="t"><span>${escapeHtml(T.from)}</span><b>${escapeHtml(company)}</b></span></header>` : ""
  }${body}<p class="foot">${escapeHtml(T.sentWith)}</p></main></body></html>`;
}

/** The "you are unsubscribed" page. */
export function unsubscribeDonePage(opts: { lang: Lang; kind: UnsubscribeKind; company?: string }): string {
  const T = TEXT[opts.lang];
  const check = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;
  const off = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m6 18 12-12"/></svg>`;
  return shell(opts.lang, opts.company ?? "", `<div class="card" role="status"><span class="disc">${check}</span><h1>${escapeHtml(T.title[opts.kind])}</h1><p class="sub">${escapeHtml(T.sub[opts.kind])}</p><span class="st">${off}${escapeHtml(T.unsubscribed)}</span><div class="note"><b>${escapeHtml(T.stillTitle)}</b> ${escapeHtml(T.still)}</div></div>`);
}

/** A plain refusal (missing or stale link, or a server error) in the same shell. */
export function unsubscribeMessagePage(lang: Lang, which: "invalid" | "missing" | "error"): string {
  return shell(lang, "", `<p class="msg" role="alert">${escapeHtml(TEXT[lang][which])}</p>`);
}
