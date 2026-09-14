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

export function shell(params: { lang: EmailLang; headerTitle: string; headerSub: string; bodyHtml: string; footer: string; accent?: string; logoUrl?: string | null; logoAlt?: string }): string {
  const accent = params.accent ?? "linear-gradient(135deg,#7c3aed,#06b6d4)";
  const logoUrl = params.logoUrl || LOGO_URL;
  return `<!DOCTYPE html>
<html lang="${params.lang === "fr" ? "fr-CA" : "en-CA"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(params.headerTitle)}</title>
<style>
  body { margin:0; padding:0; background:#f5f3ff; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,0.08); }
  .header { background:${accent}; padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:20px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.88); font-size:14px; margin:0; }
  .body { padding:32px 40px; font-size:15px; color:#1a1a2e; line-height:1.6; }
  .box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:12px; padding:18px 22px; margin:22px 0; font-size:14px; }
  .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #ede9fe; }
  .row:last-child { border-bottom:none; font-weight:700; color:#7c3aed; font-size:16px; }
  .label { color:#6b7280; }
  .cta { text-align:center; margin:28px 0 8px; }
  .btn { display:inline-block; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white !important; font-size:15px; font-weight:600; padding:14px 34px; border-radius:10px; text-decoration:none; }
  .muted { font-size:12.5px; color:#6b7280; text-align:center; }
  .msg { border-left:3px solid #c4b5fd; padding:8px 14px; color:#374151; font-style:italic; margin:18px 0; white-space:pre-wrap; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header"><img src="${logoUrl}" alt="${escapeHtml(params.logoAlt ?? "QuoteAI")}" /><h1>${escapeHtml(params.headerTitle)}</h1><p>${escapeHtml(params.headerSub)}</p></div>
  <div class="body">${params.bodyHtml}</div>
  <div class="footer">${params.footer}</div>
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
    bodyHtml: `<p>${t.body}</p><div style="text-align:center;margin:24px 0;"><span style="display:inline-block;font-size:34px;letter-spacing:10px;font-weight:800;color:#4c1d95;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:14px 26px;">${params.code}</span></div>`,
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
