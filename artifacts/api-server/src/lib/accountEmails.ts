// Phase 93 — the three emails an account gets from better-auth's lifecycle
// (verify the address, reset the password, welcome), in the language the
// person was using when they asked for them. They used to be English only,
// with the old purple gradient, emojis, and a welcome that promised trial
// terms no plan has. Same navy shell as the widget emails (Phase 92).

import { escapeHtml } from "./email";
import { getBaseUrl } from "./baseUrl";

export type AccountEmailLang = "en" | "fr";

/**
 * The SPA sends `x-quoteai-lang` on every auth call (lib/auth-client.ts), so
 * the language picked on the site wins over the browser's; the browser's
 * Accept-Language is the fallback for anything else.
 */
export function requestLang(headers: Headers | null | undefined): AccountEmailLang {
  const explicit = headers?.get("x-quoteai-lang")?.toLowerCase();
  if (explicit === "fr" || explicit === "en") return explicit;
  return /^fr\b/i.test(headers?.get("accept-language") ?? "") ? "fr" : "en";
}

const NAVY = "#101031";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LOGO_URL = () => `${getBaseUrl()}/quoteai-logo.png`;

function shell(lang: AccountEmailLang, title: string, body: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f8;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f5f8;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;background:#fff">
<tr><td style="background:${NAVY};padding:24px 36px;text-align:center"><img src="${LOGO_URL()}" alt="QuoteAI" height="32" /></td></tr>
<tr><td style="padding:32px 36px;color:${INK};font-size:15px;line-height:1.65">${body}</td></tr>
<tr><td style="background:#f9fafb;padding:18px 36px;border-top:1px solid #eef0f3;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6">${footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(url: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px auto"><tr><td align="center" style="border-radius:999px;background:${NAVY}">
<a href="${url}" style="display:inline-block;color:#fff;font-size:15px;font-weight:600;padding:13px 30px;border-radius:999px;text-decoration:none">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** The name is user-controlled and lands in HTML: always escaped. */
const hello = (lang: AccountEmailLang, name: string) => {
  const who = (name ?? "").trim();
  return lang === "fr" ? `Bonjour${who ? ` ${escapeHtml(who)}` : ""},` : `Hi${who ? ` ${escapeHtml(who)}` : ""},`;
};
const year = () => new Date().getFullYear();

export function verificationEmail(lang: AccountEmailLang, name: string, url: string): { subject: string; html: string } {
  const fr = lang === "fr";
  const subject = fr ? "Confirmez votre adresse courriel – QuoteAI" : "Verify your email – QuoteAI";
  const body = `<h1 style="margin:0 0 14px;font-size:21px;font-weight:700;color:${NAVY}">${fr ? "Confirmez votre adresse courriel" : "Verify your email address"}</h1>
<p style="margin:0">${hello(lang, name)}<br/>${fr ? "Cliquez sur le bouton ci-dessous pour confirmer votre adresse et ouvrir votre compte QuoteAI." : "Click the button below to confirm your address and open your QuoteAI account."}</p>
${button(url, fr ? "Confirmer mon adresse" : "Verify my email")}
<p style="margin:0;font-size:13px;color:${MUTED}">${fr ? "Le lien est valide pendant une heure. Vous n'avez pas créé de compte QuoteAI? Ignorez ce courriel." : "The link works for one hour. Didn't create a QuoteAI account? You can ignore this email."}</p>`;
  return { subject, html: shell(lang, subject, body, `&copy; ${year()} QuoteAI`) };
}

export function resetPasswordEmail(lang: AccountEmailLang, name: string, url: string): { subject: string; html: string } {
  const fr = lang === "fr";
  const subject = fr ? "Réinitialisez votre mot de passe – QuoteAI" : "Reset your password – QuoteAI";
  const body = `<h1 style="margin:0 0 14px;font-size:21px;font-weight:700;color:${NAVY}">${fr ? "Réinitialiser votre mot de passe" : "Reset your password"}</h1>
<p style="margin:0">${hello(lang, name)}<br/>${fr ? "Vous avez demandé à réinitialiser le mot de passe de votre compte QuoteAI." : "You asked to reset the password for your QuoteAI account."}</p>
${button(url, fr ? "Choisir un nouveau mot de passe" : "Choose a new password")}
<p style="margin:0;font-size:13px;color:${MUTED}">${fr ? "Vous n'avez rien demandé? Ignorez ce courriel : votre mot de passe ne change pas." : "Didn't ask for this? Ignore this email and your password stays the same."}</p>`;
  return { subject, html: shell(lang, subject, body, `&copy; ${year()} QuoteAI`) };
}

/** For the person who starts a company (employees joining one don't get it). */
export function welcomeEmail(lang: AccountEmailLang, name: string): { subject: string; html: string } {
  const fr = lang === "fr";
  const base = getBaseUrl();
  const subject = fr ? "Bienvenue sur QuoteAI" : "Welcome to QuoteAI";
  const steps = fr
    ? [
        ["Configurez votre entreprise", "Nom, province, licence et logo : ils figurent sur chaque soumission. Tout se modifie plus tard dans Paramètres."],
        ["Décrivez un travail", "Écrivez-le ou dictez-le; QuoteAI prépare une soumission détaillée avec les taxes de votre province."],
        ["Envoyez-la", "Votre client la consulte, l'accepte et la signe en ligne."],
      ]
    : [
        ["Set up your company", "Name, province, licence and logo: they go on every quote. You can change all of it later in Settings."],
        ["Describe a job", "Type it or say it; QuoteAI drafts an itemized quote with your province's taxes."],
        ["Send it", "Your client opens it, accepts it and signs it online."],
      ];
  const list = steps
    .map(([t, d], i) => `<tr><td valign="top" style="padding:0 12px 14px 0"><div style="width:24px;height:24px;border-radius:999px;background:${NAVY};color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px">${i + 1}</div></td><td style="padding:0 0 14px;font-size:14px"><strong style="color:${NAVY}">${escapeHtml(t)}</strong><br/><span style="color:${MUTED}">${escapeHtml(d)}</span></td></tr>`)
    .join("");
  const body = `<h1 style="margin:0 0 14px;font-size:21px;font-weight:700;color:${NAVY}">${fr ? "Votre compte est prêt" : "Your account is ready"}</h1>
<p style="margin:0 0 20px">${hello(lang, name)}<br/>${fr ? "Merci de vous être inscrit. Voici comment obtenir votre première soumission :" : "Thanks for signing up. Here is how to get your first quote out:"}</p>
<table cellpadding="0" cellspacing="0" role="presentation">${list}</table>
${button(`${base}/dashboard`, fr ? "Ouvrir mon tableau de bord" : "Open my dashboard")}
<p style="margin:0;font-size:13px;color:${MUTED};text-align:center">${fr ? "Des questions? Écrivez-nous à" : "Questions? Write to"} <a href="mailto:support@quoteai.ca" style="color:${NAVY}">support@quoteai.ca</a></p>`;
  const footer = fr ? `Vous recevez ce courriel parce que vous venez de créer un compte sur quoteai.ca.<br/>&copy; ${year()} QuoteAI` : `You're getting this email because you just created an account on quoteai.ca.<br/>&copy; ${year()} QuoteAI`;
  return { subject, html: shell(lang, subject, body, footer) };
}
