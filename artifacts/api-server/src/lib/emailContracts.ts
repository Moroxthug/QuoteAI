import { logger } from "./logger.js";
import { getBaseUrl } from "./baseUrl.js";
import { sendCustomerEmail } from "./connectedEmailSend.js";
import { resendOrThrow } from "./emailUtils.js";

export { resendOrThrow };

// ── Contract emails (Phase 1) ────────────────────────────────────────────────
// Kept in their own module so email.ts (quotes/subscriptions) stays readable.

const LOGO_URL = `${getBaseUrl()}/quoteai-logo.png`;
export const FROM = "QuoteAI <no-reply@quoteai.ca>";

export type EmailLang = "en" | "fr";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** The board's initials mark ("RR" for Rossi Renovations). */
function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Q";
  return ((parts[0]![0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "")).toUpperCase();
}

/**
 * Pocket 125.10: the one layout every client email shares, from the EmailQuote board
 * (docs/pocket-design/EmailQuote.dc.html): a quiet ground, one white card (22 radius), the
 * company's mark and name, the message, a tile for the figures, one full-width ink button.
 * Tokens are handoff/tokens/tokens.css as literals (email clients have no custom properties);
 * night follows the reader's setting where the client supports it. Digits are Manrope and
 * words Geist where the client loads web fonts (Apple Mail); elsewhere the system font.
 * `accent` is accepted for old callers and ignored: the board has one button colour.
 */
export function shell(params: { lang: EmailLang; headerTitle: string; headerSub: string; bodyHtml: string; footer: string; accent?: string; logoUrl?: string | null; logoAlt?: string }): string {
  const base = getBaseUrl();
  const brand = params.logoAlt ?? "QuoteAI";
  const brandHtml = params.logoUrl
    ? `<img src="${params.logoUrl}" alt="" width="34" height="34" style="display:block;width:34px;height:34px;border-radius:10px;object-fit:cover" />`
    : brand === "QuoteAI"
      ? `<img src="${LOGO_URL}" alt="" height="28" style="display:block;height:28px;width:auto" />`
      : `<span class="mark">${escapeHtml(brandInitials(brand))}</span>`;
  const brandName = brand === "QuoteAI" && !params.logoUrl ? "" : `<td class="brand-t">${escapeHtml(brand)}</td>`;
  return `<!DOCTYPE html>
<html lang="${params.lang === "fr" ? "fr-CA" : "en-CA"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(params.headerTitle)}</title>
<style>
  @font-face { font-family:'QDigits'; src:url('${base}/fonts/manrope-digits.woff2') format('woff2'); font-weight:200 800; unicode-range:U+0030-0039,U+0024,U+0025,U+002B,U+2212,U+00B0; }
  @font-face { font-family:'Geist'; src:url('${base}/fonts/geist-latin-wght-normal.woff2') format('woff2'); font-weight:300 600; }
  body { margin:0; padding:0; background:#f2f2f8; color:#141416; font-family:QDigits,Geist,-apple-system,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
  .wrapper { max-width:560px; margin:0 auto; padding:24px 16px 32px; }
  .card { background:#ffffff; border:1px solid #efeeea; border-radius:22px; padding:22px 20px 20px; }
  .mark { display:block; width:34px; height:34px; border-radius:10px; background:#141416; color:#ffffff; font-size:12.5px; font-weight:600; letter-spacing:-0.02em; line-height:34px; text-align:center; }
  .brand-t { padding-left:10px; font-size:15px; font-weight:600; letter-spacing:-0.02em; color:#141416; }
  h1 { margin:20px 0 4px; font-size:21px; line-height:1.25; font-weight:600; letter-spacing:-0.03em; color:#141416; }
  .sub { margin:0; font-size:13.5px; color:#6e6e76; }
  .body { padding-top:14px; font-size:15px; line-height:1.55; color:#3c3c43; }
  .body p { margin:0 0 12px; }
  .box { background:#f7f6f3; border:1px solid #efeeea; border-radius:18px; padding:16px; margin:18px 0; font-size:13.5px; }
  .row { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid #e2e1dc; }
  .row:first-child { padding-top:0; }
  .row:last-child { border-bottom:none; padding-bottom:0; margin-top:4px; font-weight:600; color:#141416; font-size:17px; letter-spacing:-0.02em; }
  .label { color:#6e6e76; font-weight:400; font-size:13.5px; letter-spacing:-0.01em; }
  .cta { margin:16px 0 4px; }
  .btn { display:block; background:#141416; color:#ffffff !important; font-size:16px; font-weight:600; letter-spacing:-0.01em; text-align:center; padding:17px 24px; border-radius:17px; text-decoration:none; }
  .muted { font-size:12.5px; color:#6e6e76; text-align:center; }
  .msg { border-left:3px solid #dcdbe9; padding:8px 14px; color:#3c3c43; margin:18px 0; white-space:pre-wrap; }
  .code { display:inline-block; font-size:32px; letter-spacing:10px; font-weight:600; color:#141416; background:#f7f6f3; border:1px solid #e2e1dc; border-radius:14px; padding:14px 26px; }
  .file { display:block; margin-top:12px; padding:12px 14px; border:1px solid #e2e1dc; border-radius:18px; font-size:13.5px; font-weight:500; color:#141416; }
  .file small { display:block; margin-top:2px; font-size:11.5px; font-weight:400; color:#6e6e76; }
  .footer { margin-top:20px; padding-top:16px; border-top:1px solid #efeeea; text-align:center; font-size:12.5px; line-height:1.55; color:#8a8a90; }
  .footer a { color:#6e6e76; text-decoration:underline; }
  @media (prefers-color-scheme: dark) {
    body, .wrapper { background:#0c0c0e !important; color:#f3f2ef !important; }
    .card { background:#18181b !important; border-color:#26262b !important; }
    .mark { background:#f3f2ef !important; color:#141416 !important; }
    .brand-t, h1, .row:last-child, .file { color:#f3f2ef !important; }
    .sub, .label, .muted, .file small { color:#a09fa7 !important; }
    .body { color:#d0cfd5 !important; }
    .box { background:#1f1f23 !important; border-color:#26262b !important; }
    .row { border-bottom-color:#2e2e34 !important; }
    .btn { background:#f3f2ef !important; color:#141416 !important; }
    .msg { border-left-color:#3b3b41 !important; color:#d0cfd5 !important; }
    .code { background:#1f1f23 !important; border-color:#2e2e34 !important; color:#f3f2ef !important; }
    .file { border-color:#2e2e34 !important; }
    .footer { border-top-color:#26262b !important; color:#7c7b83 !important; }
    .footer a { color:#a09fa7 !important; }
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="vertical-align:middle">${brandHtml}</td>${brandName}</tr></table>
    <h1>${escapeHtml(params.headerTitle)}</h1>
    <p class="sub">${escapeHtml(params.headerSub)}</p>
    <div class="body">${params.bodyHtml}</div>
    <div class="footer">${params.footer}</div>
  </div>
</div>
</body>
</html>`;
}

function cad(n: number, lang: EmailLang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(n);
}

export async function sendContractSigningEmail(params: {
  toEmail: string;
  userId: string;
  customerName: string;
  companyName: string;
  contractNumber: string;
  total: number;
  signUrl: string;
  expiresAt: Date;
  language: EmailLang;
  message?: string;
  companyLogoUrl?: string | null;
  replyTo?: string | null;
}): Promise<void> {
  const { language: lang } = params;
  const company = escapeHtml(params.companyName);
  const customer = escapeHtml(params.customerName || (lang === "fr" ? "Bonjour" : "there"));
  const expires = params.expiresAt.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" });
  const t = lang === "fr"
    ? {
        title: "Votre contrat est prêt à signer",
        sub: `${params.companyName} vous a envoyé un contrat`,
        body: `Bonjour ${customer},<br/><br/><strong>${company}</strong> a préparé le contrat de votre projet à partir de la soumission que vous avez acceptée. Veuillez le lire et le signer en ligne — cela ne prend qu'une minute. Vous recevrez une copie signée par courriel dès que les deux parties auront signé.`,
        btn: "Lire et signer le contrat",
        hint: `Ce lien sécurisé vous est personnel et expire le ${expires}. Un code de confirmation sera envoyé à cette adresse courriel avant la signature.`,
        footer: `Ce contrat a été envoyé via QuoteAI au nom de ${company}. Des questions sur les travaux ? Répondez directement à ${company}.`,
        subject: `Contrat ${params.contractNumber} de ${params.companyName} — prêt à signer`,
        contract: "Contrat",
        price: "Prix du contrat",
      }
    : {
        title: "Your contract is ready to sign",
        sub: `${params.companyName} has sent you a contract`,
        body: `Hi ${customer},<br/><br/><strong>${company}</strong> has prepared the contract for your project based on the quote you accepted. Please review it and sign it online — it only takes a minute. You will receive a signed copy by email once both parties have signed.`,
        btn: "Review & sign contract",
        hint: `The secure link is personal to you and expires on ${expires}. You will be asked to confirm a code sent to this email address before signing.`,
        footer: `This contract was sent through QuoteAI on behalf of ${company}. Questions about the work? Reply to ${company} directly.`,
        subject: `Contract ${params.contractNumber} from ${params.companyName} — ready to sign`,
        contract: "Contract",
        price: "Contract price",
      };
  const html = shell({
    lang,
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p>${params.message ? `<div class="msg">${escapeHtml(params.message)}</div>` : ""}
      <div class="box"><div class="row"><span class="label">${t.contract}</span><span><strong>${escapeHtml(params.contractNumber)}</strong></span></div>
      <div class="row"><span class="label">${t.price}</span><span>${cad(params.total, lang)}</span></div></div>
      <div class="cta"><a class="btn" href="${params.signUrl}">${t.btn}</a></div><p class="muted">${t.hint}</p>`,
    footer: t.footer,
    logoUrl: params.companyLogoUrl,
    logoAlt: params.companyName,
  });
  await sendCustomerEmail({ userId: params.userId, toEmail: params.toEmail, fromDisplayName: params.companyName, replyTo: params.replyTo, subject: t.subject, html });
  logger.info({ to: params.toEmail, contractNumber: params.contractNumber }, "Contract signing email sent");
}

export async function sendContractOtpEmail(params: { toEmail: string; code: string; companyName: string; language: EmailLang }): Promise<void> {
  const { language: lang } = params;
  const t = lang === "fr"
    ? { title: "Votre code de vérification", sub: `Pour signer le contrat de ${params.companyName}`, body: "Entrez ce code sur la page de signature pour confirmer votre adresse courriel. Il expire dans 10 minutes.", subject: `${params.code} est votre code de signature QuoteAI`, footer: "Si vous n'avez pas demandé ce code, ignorez ce courriel." }
    : { title: "Your verification code", sub: `To sign the contract from ${params.companyName}`, body: "Enter this code on the signing page to confirm your email address. It expires in 10 minutes.", subject: `${params.code} is your QuoteAI signing code`, footer: "If you did not request this code, you can ignore this email." };
  const html = shell({
    lang,
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div style="text-align:center;margin:24px 0;"><span class="code">${params.code}</span></div>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
}

export async function sendContractSignedEmail(params: {
  toEmail: string;
  userId: string;
  role: "customer" | "contractor";
  customerName: string;
  companyName: string;
  contractNumber: string;
  total: number;
  pdfBuffer: Buffer;
  language: EmailLang;
  dashboardUrl: string;
  replyTo?: string | null;
}): Promise<void> {
  const { language: lang } = params;
  const company = escapeHtml(params.companyName);
  const customer = escapeHtml(params.customerName);
  const isCustomer = params.role === "customer";
  const t = lang === "fr"
    ? {
        title: "Contrat signé par les deux parties",
        sub: `Contrat ${params.contractNumber}`,
        body: isCustomer
          ? `Bonjour ${customer},<br/><br/>le contrat avec <strong>${company}</strong> est maintenant signé par les deux parties. Votre copie signée, avec le certificat de signature électronique, est jointe à ce courriel. Conservez-la précieusement.`
          : `Bonne nouvelle ! <strong>${customer}</strong> a signé le contrat ${params.contractNumber}. La copie signée est jointe et le chantier peut être préparé.`,
        subject: `Contrat ${params.contractNumber} signé — ${params.companyName}`,
        footer: "Document généré et signé électroniquement via QuoteAI.",
        btn: "Ouvrir dans QuoteAI",
        contract: "Contrat",
        price: "Prix du contrat",
      }
    : {
        title: "Contract signed by both parties",
        sub: `Contract ${params.contractNumber}`,
        body: isCustomer
          ? `Hi ${customer},<br/><br/>your contract with <strong>${company}</strong> is now signed by both parties. Your signed copy, including the electronic signature certificate, is attached to this email. Keep it for your records.`
          : `Good news! <strong>${customer}</strong> signed contract ${params.contractNumber}. The signed copy is attached and the job is ready to be set up.`,
        subject: `Contract ${params.contractNumber} signed — ${params.companyName}`,
        footer: "Document generated and electronically signed through QuoteAI.",
        btn: "Open in QuoteAI",
        contract: "Contract",
        price: "Contract price",
      };
  const html = shell({
    lang,
    accent: "linear-gradient(135deg,#059669,#06b6d4)",
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div class="box"><div class="row"><span class="label">${t.contract}</span><span><strong>${escapeHtml(params.contractNumber)}</strong></span></div><div class="row"><span class="label">${t.price}</span><span>${cad(params.total, lang)}</span></div></div>${isCustomer ? "" : `<div class="cta"><a class="btn" href="${params.dashboardUrl}">${t.btn}</a></div>`}`,
    footer: t.footer,
  });
  const attachments = [{ filename: `${params.contractNumber}-signed.pdf`, content: params.pdfBuffer.toString("base64") }];
  if (isCustomer) {
    await sendCustomerEmail({ userId: params.userId, toEmail: params.toEmail, fromDisplayName: params.companyName, replyTo: params.replyTo, subject: t.subject, html, attachments });
  } else {
    await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html, attachments });
  }
}

export async function sendContractDeclinedEmail(params: { toEmail: string; customerName: string; contractNumber: string; reason: string | null; dashboardUrl: string }): Promise<void> {
  const html = shell({
    lang: "en",
    accent: "linear-gradient(135deg,#dc2626,#f97316)",
    headerTitle: `${params.customerName} declined the contract`,
    headerSub: `Contract ${params.contractNumber}`,
    bodyHtml: `<p><strong>${escapeHtml(params.customerName)}</strong> declined to sign contract ${escapeHtml(params.contractNumber)}.</p>${params.reason ? `<div class="msg">${escapeHtml(params.reason)}</div>` : ""}<p>You can edit the contract and send a new version, or reach out to the customer directly.</p><div class="cta"><a class="btn" href="${params.dashboardUrl}">Open the contract</a></div>`,
    footer: "Sent by QuoteAI.",
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: `Contract ${params.contractNumber} declined by ${params.customerName}`, html });
}

export async function sendContractReminderEmail(params: {
  toEmail: string;
  userId: string;
  customerName: string;
  companyName: string;
  contractNumber: string;
  signUrl: string;
  expiresAt: Date;
  language: EmailLang;
  companyLogoUrl?: string | null;
  replyTo?: string | null;
}): Promise<void> {
  const { language: lang } = params;
  const expires = params.expiresAt.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" });
  const t = lang === "fr"
    ? { title: "Rappel : contrat en attente de signature", sub: `${params.companyName}`, body: `Bonjour ${escapeHtml(params.customerName)},<br/><br/>le contrat ${escapeHtml(params.contractNumber)} de <strong>${escapeHtml(params.companyName)}</strong> attend toujours votre signature. Le lien expire le ${expires}.`, btn: "Signer le contrat", subject: `Rappel — contrat ${params.contractNumber} à signer`, footer: "Envoyé via QuoteAI." }
    : { title: "Reminder: contract awaiting your signature", sub: `${params.companyName}`, body: `Hi ${escapeHtml(params.customerName)},<br/><br/>contract ${escapeHtml(params.contractNumber)} from <strong>${escapeHtml(params.companyName)}</strong> is still waiting for your signature. The link expires on ${expires}.`, btn: "Sign the contract", subject: `Reminder — contract ${params.contractNumber} awaiting signature`, footer: "Sent through QuoteAI." };
  const html = shell({ lang, headerTitle: t.title, headerSub: t.sub, bodyHtml: `<p>${t.body}</p><div class="cta"><a class="btn" href="${params.signUrl}">${t.btn}</a></div>`, footer: t.footer, logoUrl: params.companyLogoUrl, logoAlt: params.companyName });
  await sendCustomerEmail({ userId: params.userId, toEmail: params.toEmail, fromDisplayName: params.companyName, replyTo: params.replyTo, subject: t.subject, html });
}
