import { brandedResend } from "./emailUtils.js";
import { logger } from "./logger";
import { getBaseUrl } from "./baseUrl";
import { sendCustomerEmail } from "./connectedEmailSend.js";

// Gmail and most webmail clients strip data: URI images from HTML emails,
// so the logo must be a real hosted URL rather than an inline base64 SVG.
const LOGO_URL = `${getBaseUrl()}/quoteai-logo.png`;


export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type PlanTier = "pro" | "starter" | "oneshot";

function getPlanTier(planName: string): PlanTier {
  const lower = planName.toLowerCase();
  if (lower.includes("pro")) return "pro";
  if (lower.includes("starter")) return "starter";
  return "oneshot";
}

function getPlanFeatures(planName: string, tier: PlanTier): string {
  if (tier === "pro") {
    return `
      <div class="feature"><span class="check">✓</span> Unlimited quotes with no watermark</div>
      <div class="feature"><span class="check">✓</span> Professional PDFs with your company logo</div>
      <div class="feature"><span class="check">✓</span> High-quality premium templates</div>
      <div class="feature"><span class="check">✓</span> Fully customizable branding</div>
      <div class="feature"><span class="check">✓</span> AI generation from job-site photos</div>
      <div class="feature"><span class="check">✓</span> Priority AI generation</div>
    `;
  }
  if (tier === "starter") {
    return `
      <div class="feature"><span class="check">✓</span> Up to 20 quotes per month</div>
      <div class="feature"><span class="check">✓</span> Professional PDF download</div>
      <div class="feature"><span class="check">✓</span> Email support included</div>
    `;
  }
  const isClean = planName.toLowerCase().includes("pulito") || planName.toLowerCase().includes("clean");
  if (isClean) {
    return `
      <div class="feature"><span class="check">✓</span> 1 PDF quote with no watermark</div>
      <div class="feature"><span class="check">✓</span> Clean, professional design</div>
      <div class="feature"><span class="check">✓</span> Instant download</div>
    `;
  }
  return `
    <div class="feature"><span class="check">✓</span> 1 PDF quote</div>
    <div class="feature"><span class="check">✓</span> Instant download</div>
  `;
}

function buildSubscriptionEmail(params: {
  userName: string;
  planName: string;
  planPrice: number;
  planInterval: string | null;
}) {
  const { userName, planName, planPrice, planInterval } = params;
  const tier = getPlanTier(planName);
  const isRecurring = !!planInterval;
  const date = new Date().toLocaleDateString("en-CA", { day: "2-digit", month: "long", year: "numeric" });
  const intervalLabel = planInterval === "month" ? "month" : planInterval === "year" ? "year" : null;
  const priceLabel = intervalLabel ? `${planPrice} CAD/${intervalLabel}` : `${planPrice} CAD (one-time)`;
  const renewalRow = isRecurring
    ? `<div class="receipt-row">
        <span class="receipt-label">Renewal</span>
        <span>${planInterval === "month" ? "Automatic monthly" : "Automatic yearly"}</span>
       </div>`
    : `<div class="receipt-row">
        <span class="receipt-label">Type</span>
        <span>One-time purchase</span>
       </div>`;

  const headline = tier === "oneshot"
    ? `🎉 ${planName} quote unlocked!`
    : `🎉 ${planName} plan activated!`;

  const subline = tier === "oneshot"
    ? `Your PDF is ready. Head to the dashboard to download it.`
    : `Your subscription has been active since today, ${date}`;

  const bodyIntro = tier === "oneshot"
    ? `Hi ${userName},<br/><br/>your <strong>QuoteAI ${planName}</strong> purchase went through successfully. You can go to the dashboard and download the PDF of your quote.`
    : `Hi ${userName},<br/><br/>your <strong>QuoteAI ${planName}</strong> subscription has been activated. You can start creating${tier === "pro" ? " unlimited" : ""} professional quotes right away.`;

  const features = getPlanFeatures(planName, tier);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${headline} – QuoteAI</title>
<style>
  body { margin:0; padding:0; background:#f5f3ff; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,0.08); }
  .header { background:linear-gradient(135deg,#7c3aed,#06b6d4); padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:22px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.85); font-size:14px; margin:0; }
  .body { padding:32px 40px; }
  .greeting { font-size:16px; color:#1a1a2e; margin-bottom:20px; line-height:1.6; }
  .receipt-box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:12px; padding:20px 24px; margin:24px 0; }
  .receipt-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #ede9fe; font-size:14px; }
  .receipt-row:last-child { border-bottom:none; font-weight:700; color:#7c3aed; font-size:16px; }
  .receipt-label { color:#6b7280; }
  .features { margin:24px 0; }
  .feature { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; font-size:14px; color:#374151; }
  .check { color:#7c3aed; font-size:16px; flex-shrink:0; }
  .cta { text-align:center; margin:28px 0; }
  .btn { display:inline-block; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white; font-size:15px; font-weight:600; padding:13px 32px; border-radius:10px; text-decoration:none; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="${LOGO_URL}" alt="QuoteAI" />
    <h1>${headline}</h1>
    <p>${subline}</p>
  </div>
  <div class="body">
    <p class="greeting">${bodyIntro}</p>

    <div class="receipt-box">
      <div class="receipt-row">
        <span class="receipt-label">Plan</span>
        <span><strong>QuoteAI ${planName}</strong></span>
      </div>
      <div class="receipt-row">
        <span class="receipt-label">Date</span>
        <span>${date}</span>
      </div>
      ${renewalRow}
      <div class="receipt-row">
        <span class="receipt-label">Amount</span>
        <span>${priceLabel}</span>
      </div>
    </div>

    <div class="features">
      ${features}
    </div>

    <div class="cta">
      <a href="https://quoteai.ca/dashboard" class="btn">Go to dashboard →</a>
    </div>

    <p style="font-size:13px;color:#6b7280;text-align:center;">Questions? Reach us at <a href="mailto:support@quoteai.ca" style="color:#7c3aed;">support@quoteai.ca</a></p>
  </div>
  <div class="footer">
    QuoteAI · Professional AI-powered quotes<br/>
    You received this email because you made a purchase on QuoteAI.<br/>
    ${isRecurring ? "To manage or cancel your subscription, go to Dashboard → Settings → Plan." : ""}
  </div>
</div>
</body>
</html>`;
}

export async function sendSubscriptionEmail(params: {
  toEmail: string;
  toName: string;
  planName: string;
  planPrice: number;
  planInterval: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping subscription email");
    return;
  }

  const tier = getPlanTier(params.planName);
  const subject = tier === "oneshot"
    ? `🎉 ${params.planName} quote unlocked – QuoteAI`
    : `🎉 ${params.planName} plan activated – Welcome to QuoteAI!`;

  try {
    const resend = brandedResend(apiKey);
    await resend.emails.send({
      from: "QuoteAI <no-reply@quoteai.ca>",
      to: [params.toEmail],
      subject,
      html: buildSubscriptionEmail({
        userName: params.toName,
        planName: params.planName,
        planPrice: params.planPrice,
        planInterval: params.planInterval,
      }),
    });
    logger.info({ to: params.toEmail, plan: params.planName }, "Subscription email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send subscription email (non-fatal)");
  }
}

const QUOTE_EMAIL_COPY = {
  en: {
    view: "View &amp; accept online",
    viewHint: "You can review the full quote in your browser and accept it in one click.",
    title: (c: string) => `Quote from ${c}`,
    ready: "Your quote is ready",
    sent: (c: string) => `${c} has sent you a professional quote`,
    greeting: (n: string, c: string) => `Hi ${n || "there"},<br/><br/>attached you'll find the quote from <strong>${c}</strong>. If you have any questions, feel free to reach out.`,
    quote: "Quote",
    total: "Total amount",
    generated: "Document generated with",
    footer: "You received this email because you were listed as the recipient of this quote.",
    subject: (n: string, c: string) => `Quote ${n} – ${c}`,
    money: (t: string) => `$ ${t}`,
  },
  fr: {
    view: "Consulter et accepter en ligne",
    viewHint: "Vous pouvez consulter la soumission complète dans votre navigateur et l'accepter en un clic.",
    title: (c: string) => `Soumission de ${c}`,
    ready: "Votre soumission est prête",
    sent: (c: string) => `${c} vous a envoyé une soumission professionnelle`,
    greeting: (n: string, c: string) => `Bonjour ${n || ""},<br/><br/>vous trouverez ci-joint la soumission de <strong>${c}</strong>. N'hésitez pas à nous écrire pour toute question.`,
    quote: "Soumission",
    total: "Montant total",
    generated: "Document généré avec",
    footer: "Vous recevez ce courriel parce que vous êtes le destinataire de cette soumission.",
    subject: (n: string, c: string) => `Soumission ${n} – ${c}`,
    money: (t: string) => `${t} $`,
  },
} as const;

function buildQuoteEmailHtml(params: {
  lang?: "en" | "fr";
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  publicUrl?: string | null;
  logoUrl?: string | null;
}): string {
  const companyName = escapeHtml(params.companyName);
  const clientName = escapeHtml(params.clientName);
  const { quoteNumber, totale, publicUrl } = params;
  const c = QUOTE_EMAIL_COPY[params.lang ?? "en"];
  const logoUrl = params.logoUrl || LOGO_URL;
  const ctaHtml = publicUrl
    ? `<div class="cta"><a class="btn" href="${publicUrl}">${c.view}</a></div>
    <p style="font-size:13px;color:#6b7280;text-align:center;margin-top:-12px;">${c.viewHint}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="${params.lang === "fr" ? "fr-CA" : "en-CA"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${c.title(companyName)}</title>
<style>
  body { margin:0; padding:0; background:#f5f3ff; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,0.08); }
  .header { background:linear-gradient(135deg,#7c3aed,#06b6d4); padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:20px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.85); font-size:14px; margin:0; }
  .body { padding:32px 40px; }
  .greeting { font-size:16px; color:#1a1a2e; margin-bottom:20px; line-height:1.6; }
  .quote-box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:12px; padding:20px 24px; margin:24px 0; }
  .quote-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #ede9fe; font-size:14px; }
  .quote-row:last-child { border-bottom:none; font-weight:700; color:#7c3aed; font-size:16px; }
  .quote-label { color:#6b7280; }
  .cta { text-align:center; margin:28px 0; }
  .btn { display:inline-block; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white; font-size:15px; font-weight:600; padding:13px 32px; border-radius:10px; text-decoration:none; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="${logoUrl}" alt="${companyName}" />
    <h1>${c.ready}</h1>
    <p>${c.sent(companyName)}</p>
  </div>
  <div class="body">
    <p class="greeting">${c.greeting(clientName, companyName)}</p>

    <div class="quote-box">
      <div class="quote-row">
        <span class="quote-label">${c.quote}</span>
        <span><strong>${quoteNumber}</strong></span>
      </div>
      <div class="quote-row">
        <span class="quote-label">${c.total}</span>
        <span>${c.money(totale)}</span>
      </div>
    </div>
    ${ctaHtml}

    <p style="font-size:13px;color:#6b7280;text-align:center;">${c.generated} <a href="https://quoteai.ca" style="color:#7c3aed;">QuoteAI</a></p>
  </div>
  <div class="footer">
    ${companyName}<br/>
    ${c.footer}
  </div>
</div>
</body>
</html>`;
}

// Phase 92: the widget speaks the visitor's language, so the receipt does too.
const WIDGET_CONFIRMATION_COPY = {
  en: {
    htmlLang: "en-CA",
    subject: (company: string) => `Your request to ${company} has been received`,
    title: (company: string) => `Your request has been received – ${company}`,
    heading: "Request received",
    subheading: (company: string) => `${company} has received your quote request`,
    greeting: (client: string, company: string) =>
      `Hi ${client},<br/><br/>thanks for requesting an estimate from <strong>${company}</strong>. Their team will get back to you shortly to schedule a site visit and finalize the quote.`,
    rangeLabel: "Estimated range (taxes included)",
    rangeNote: "This is an automatic estimate and may change after an on-site visit.",
    noRangeNote: "They will review your description and send you a quote.",
    contact: (company: string, line: string) => ` For any questions you can contact ${company} directly: ${line}.`,
    footer: (company: string) => `You received this email because you requested a quote through ${company}'s website.`,
    poweredBy: "Estimate calculated with",
    technology: "technology",
    fmt: (n: string) => `$${Number(n).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`,
  },
  fr: {
    htmlLang: "fr-CA",
    subject: (company: string) => `${company} a bien reçu votre demande`,
    title: (company: string) => `Votre demande a été reçue – ${company}`,
    heading: "Demande reçue",
    subheading: (company: string) => `${company} a bien reçu votre demande de soumission`,
    greeting: (client: string, company: string) =>
      `Bonjour ${client},<br/><br/>merci d'avoir demandé une estimation à <strong>${company}</strong>. L'équipe vous recontactera sous peu pour planifier une visite et finaliser la soumission.`,
    rangeLabel: "Fourchette estimée (taxes incluses)",
    rangeNote: "Cette estimation est automatique et peut changer après une visite sur place.",
    noRangeNote: "L'équipe étudiera votre description et vous enverra une soumission.",
    contact: (company: string, line: string) => ` Pour toute question, vous pouvez joindre ${company} directement : ${line}.`,
    footer: (company: string) => `Vous recevez ce courriel parce que vous avez demandé une soumission sur le site de ${company}.`,
    poweredBy: "Estimation calculée avec la technologie",
    technology: "",
    fmt: (n: string) => `${Number(n).toLocaleString("fr-CA", { maximumFractionDigits: 0 })} $`,
  },
} as const;

function buildWidgetClientConfirmationEmail(params: {
  lang: "en" | "fr";
  clientName: string;
  companyName: string;
  companyPhone: string | null;
  companyEmail: string | null;
  prezzoMinimo: string | null;
  prezzoMassimo: string | null;
  logoUrl?: string | null;
}): string {
  const { clientName, companyName, prezzoMinimo, prezzoMassimo } = params;
  const c = WIDGET_CONFIRMATION_COPY[params.lang];
  const logoUrl = params.logoUrl || LOGO_URL;
  const contactLine = [params.companyPhone, params.companyEmail].filter(Boolean).map((v) => escapeHtml(String(v))).join(" · ");
  const hasRange = prezzoMinimo !== null && prezzoMassimo !== null;
  return `<!DOCTYPE html>
<html lang="${c.htmlLang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${c.title(companyName)}</title>
<style>
  body { margin:0; padding:0; background:#f4f5f7; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e4e7ec; }
  .header { background:#101031; padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:20px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.85); font-size:14px; margin:0; }
  .body { padding:32px 40px; }
  .greeting { font-size:16px; color:#1a1a2e; margin-bottom:20px; line-height:1.6; }
  .price-box { background:#f4f6fa; border:1px solid #e4e7ec; border-radius:10px; padding:20px 24px; margin:24px 0; text-align:center; }
  .price-box .label { font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; }
  .price-box .range { font-size:22px; font-weight:700; color:#101031; margin-top:6px; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#6b7280; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="${logoUrl}" alt="${companyName}" />
    <h1>${c.heading}</h1>
    <p>${c.subheading(companyName)}</p>
  </div>
  <div class="body">
    <p class="greeting">${c.greeting(clientName, companyName)}</p>
${hasRange ? `
    <div class="price-box">
      <div class="label">${c.rangeLabel}</div>
      <div class="range">${c.fmt(prezzoMinimo)} – ${c.fmt(prezzoMassimo)}</div>
    </div>
` : ""}
    <p style="font-size:13px;color:#6b7280;text-align:center;">${hasRange ? c.rangeNote : c.noRangeNote}${contactLine ? c.contact(companyName, contactLine) : ""}</p>
  </div>
  <div class="footer">
    ${c.poweredBy} <a href="https://quoteai.ca" style="color:#101031;">QuoteAI</a>${c.technology ? ` ${c.technology}` : ""}<br/>
    ${c.footer(companyName)}
  </div>
</div>
</body>
</html>`;
}

export async function sendWidgetClientConfirmationEmail(params: {
  toEmail: string;
  userId: string;
  lang?: "en" | "fr";
  clientName: string;
  companyName: string;
  companyPhone: string | null;
  companyEmail: string | null;
  /** Null when the AI gave no estimate (Phase 92): the email then says a quote will follow. */
  prezzoMinimo: string | null;
  prezzoMassimo: string | null;
  companyLogoUrl?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping widget client confirmation email");
    return;
  }
  const lang = params.lang ?? "en";
  try {
    await sendCustomerEmail({
      userId: params.userId,
      toEmail: params.toEmail,
      fromDisplayName: params.companyName,
      replyTo: params.companyEmail,
      subject: WIDGET_CONFIRMATION_COPY[lang].subject(params.companyName),
      html: buildWidgetClientConfirmationEmail({
        lang,
        clientName: escapeHtml(params.clientName),
        companyName: escapeHtml(params.companyName),
        companyPhone: params.companyPhone,
        companyEmail: params.companyEmail,
        prezzoMinimo: params.prezzoMinimo,
        prezzoMassimo: params.prezzoMassimo,
        logoUrl: params.companyLogoUrl ?? null,
      }),
    });
    logger.info({ to: params.toEmail }, "Widget client confirmation email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send widget client confirmation email (non-fatal)");
  }
}

export async function sendQuotePdfEmail(params: {
  toEmail: string;
  userId: string;
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  pdfBuffer: Buffer;
  filename: string;
  publicUrl?: string | null;
  companyLogoUrl?: string | null;
  replyTo?: string | null;
  lang?: "en" | "fr";
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping quote email");
    throw new Error("Email service not configured");
  }
  try {
    await sendCustomerEmail({
      userId: params.userId,
      toEmail: params.toEmail,
      fromDisplayName: params.companyName,
      replyTo: params.replyTo,
      subject: QUOTE_EMAIL_COPY[params.lang ?? "en"].subject(params.quoteNumber, params.companyName),
      html: buildQuoteEmailHtml({
        lang: params.lang,
        companyName: params.companyName,
        clientName: params.clientName,
        quoteNumber: params.quoteNumber,
        totale: params.totale,
        publicUrl: params.publicUrl ?? null,
        logoUrl: params.companyLogoUrl ?? null,
      }),
      attachments: [
        {
          filename: params.filename,
          content: params.pdfBuffer.toString("base64"),
        },
      ],
    });
    logger.info({ to: params.toEmail, quoteNumber: params.quoteNumber }, "Quote PDF email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send quote PDF email");
    throw new Error("Failed to send the quote email", { cause: err });
  }
}

export async function sendWidgetLeadNotification(params: {
  toEmail: string;
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  rawInput: string;
  /** Null when the AI gave no estimate (Phase 92): the lead still arrives, without the price box. */
  totale: string | null;
  prezzoMinimo: string | null;
  prezzoMassimo: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping widget lead notification email");
    return;
  }
  const { toEmail, clientName, clientEmail, clientPhone, rawInput, totale, prezzoMinimo, prezzoMassimo } = params;
  const safeClientName = escapeHtml(clientName);
  const safeClientEmail = escapeHtml(clientEmail);
  const safeClientPhone = escapeHtml(clientPhone);
  const safeRawInput = escapeHtml(rawInput);
  try {
    const resend = brandedResend(apiKey);
    await resend.emails.send({
      from: "QuoteAI <no-reply@quoteai.ca>",
      to: [toEmail],
      subject: `New website lead — ${clientName}`,
      html: `<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8" />
<title>New Widget Lead</title>
<style>
  body { margin:0; padding:0; background:#f4f4f5; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); border:1px solid #e4e4e7; }
  .header { background:#101031; padding:28px 32px; text-align:center; color:white; }
  .header h1 { font-size:20px; font-weight:700; margin:0; }
  .header p { font-size:13px; color:rgba(255,255,255,0.85); margin:6px 0 0; }
  .body { padding:32px; }
  .section-title { font-size:12px; font-weight:700; text-transform:uppercase; color:#71717a; letter-spacing:0.05em; margin-bottom:12px; border-bottom:1px solid #e4e4e7; padding-bottom:6px; }
  .field { margin-bottom:14px; }
  .label { font-size:11px; color:#a1a1aa; font-weight:600; text-transform:uppercase; }
  .val { font-size:14px; color:#18181b; font-weight:500; margin-top:2px; }
  .price-box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:12px; padding:16px 20px; margin:20px 0; }
  .price-row { display:flex; justify-content:space-between; align-items:center; font-size:14px; color:#4f46e5; font-weight:700; }
  .incentives-box { background:#ecfdf5; border:1px solid #d1fae5; border-radius:12px; padding:16px 20px; margin:20px 0; font-size:13px; color:#065f46; white-space:pre-wrap; line-height:1.5; }
  .footer { background:#f9fafb; padding:20px 32px; text-align:center; font-size:11px; color:#71717a; border-top:1px solid #f4f4f5; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>New website lead</h1>
    <p>A visitor just completed the quote tool on your website</p>
  </div>
  <div class="body">
    <div class="section-title">Lead Contact Info</div>
    <div class="field">
      <div class="label">Client Name</div>
      <div class="val">${safeClientName}</div>
    </div>
    <div class="field">
      <div class="label">Email</div>
      <div class="val"><a href="mailto:${safeClientEmail}" style="color:#4f46e5;">${safeClientEmail}</a></div>
    </div>
    <div class="field">
      <div class="label">Phone</div>
      <div class="val"><a href="tel:${safeClientPhone}" style="color:#4f46e5;">${safeClientPhone}</a></div>
    </div>

    <div class="section-title">Request Details</div>
    <div class="field">
      <div class="label">Description & Parameters</div>
      <div class="val" style="white-space:pre-wrap; font-size:13px; color:#3f3f46; line-height:1.5;">${safeRawInput}</div>
    </div>

${prezzoMinimo !== null && prezzoMassimo !== null ? `
    <div class="price-box">
      <div class="price-row">
        <span>Estimate shown to the visitor:</span>
        <span style="font-size:16px;">${prezzoMinimo} – ${prezzoMassimo} CAD</span>
      </div>
      <div style="font-size:11px; color:#71717a; font-weight:normal; margin-top:4px; text-align:right;">Draft quote total: ${totale} CAD (in your quotes as a draft)</div>
    </div>` : `
    <div class="price-box">
      <div style="font-size:13px; color:#3f3f46;">No automatic estimate this time; the visitor was told you would send a quote. The request is in your leads.</div>
    </div>`}

    <p style="font-size:13px; color:#71717a; line-height:1.5; text-align:center; margin-top:24px;">
      We recommend following up with the client within 24 hours to schedule a site visit and improve your conversion rate.
    </p>
  </div>
  <div class="footer">
    QuoteAI Widget • AI-powered instant estimate technology for trades
  </div>
</div>
</body>
</html>`
    });
    logger.info({ to: toEmail, clientName }, "Widget lead email notification sent to contractor");
  } catch (err) {
    logger.error({ err }, "Failed to send widget lead notification email");
  }
}

function buildQuoteAcceptedEmail(params: {
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  acceptedAt: string;
  quoteUrl: string;
}): string {
  const companyName = escapeHtml(params.companyName);
  const clientName = escapeHtml(params.clientName);
  const { quoteNumber, totale, acceptedAt, quoteUrl } = params;
  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Quote accepted</title>
<style>
  body { margin:0; padding:0; background:#f5f3ff; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,0.08); }
  .header { background:linear-gradient(135deg,#059669,#06b6d4); padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:22px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.9); font-size:14px; margin:0; }
  .body { padding:32px 40px; }
  .greeting { font-size:16px; color:#1a1a2e; margin-bottom:20px; line-height:1.6; }
  .quote-box { background:#ecfdf5; border:1px solid #d1fae5; border-radius:12px; padding:20px 24px; margin:24px 0; }
  .quote-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #d1fae5; font-size:14px; }
  .quote-row:last-child { border-bottom:none; font-weight:700; color:#047857; font-size:16px; }
  .quote-label { color:#6b7280; }
  .cta { text-align:center; margin:28px 0; }
  .btn { display:inline-block; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white; font-size:15px; font-weight:600; padding:13px 32px; border-radius:10px; text-decoration:none; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="${LOGO_URL}" alt="QuoteAI" />
    <h1>🎉 ${clientName} accepted your quote</h1>
    <p>Quote ${quoteNumber} is now accepted</p>
  </div>
  <div class="body">
    <p class="greeting">Good news, ${companyName}!<br/><br/><strong>${clientName}</strong> confirmed the quote online on ${acceptedAt}. The next step is turning it into a signed contract and getting the deposit in.</p>
    <div class="quote-box">
      <div class="quote-row"><span class="quote-label">Quote</span><span><strong>${quoteNumber}</strong></span></div>
      <div class="quote-row"><span class="quote-label">Accepted by</span><span>${clientName}</span></div>
      <div class="quote-row"><span class="quote-label">Total</span><span>$ ${totale}</span></div>
    </div>
    <div class="cta"><a class="btn" href="${quoteUrl}">Open the quote</a></div>
  </div>
  <div class="footer">You receive this because acceptance notifications are enabled in your QuoteAI settings.</div>
</div>
</body>
</html>`;
}

export async function sendQuoteAcceptedEmail(params: {
  toEmail: string;
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  acceptedAt: string;
  quoteUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping quote-accepted email");
    return;
  }
  const resend = brandedResend(apiKey);
  await resend.emails.send({
    from: "QuoteAI <no-reply@quoteai.ca>",
    to: [params.toEmail],
    subject: `${params.clientName} accepted quote ${params.quoteNumber}`,
    html: buildQuoteAcceptedEmail(params),
  });
  logger.info({ to: params.toEmail, quoteNumber: params.quoteNumber }, "Quote accepted email sent");
}
