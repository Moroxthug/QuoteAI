import { Resend } from "resend";
import { logger } from "./logger";
import { getBaseUrl } from "./baseUrl";

// Gmail and most webmail clients strip data: URI images from HTML emails,
// so the logo must be a real hosted URL rather than an inline base64 SVG.
const LOGO_URL = `${getBaseUrl()}/quoteai-logo.png`;

function escapeHtml(value: string): string {
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

function buildWelcomeEmail(name: string): string {
  const firstName = name?.split(" ")[0] || name || "there";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Welcome to QuoteAI!</title>
<style>
  body { margin:0; padding:0; background:#f5f3ff; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,0.08); }
  .header { background:linear-gradient(135deg,#7c3aed,#06b6d4); padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:22px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.85); font-size:14px; margin:0; }
  .body { padding:32px 40px; }
  .greeting { font-size:16px; color:#1a1a2e; margin-bottom:20px; line-height:1.6; }
  .trial-box { background:linear-gradient(135deg,#f5f3ff,#e0f2fe); border:1px solid #ddd6fe; border-radius:12px; padding:20px 24px; margin:24px 0; }
  .trial-box h2 { margin:0 0 12px; font-size:16px; font-weight:700; color:#5b21b6; }
  .feature { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; font-size:14px; color:#374151; }
  .check { color:#7c3aed; font-size:16px; font-weight:700; flex-shrink:0; }
  .steps { margin:24px 0; }
  .step { display:flex; align-items:flex-start; gap:14px; margin-bottom:16px; }
  .step-num { background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white; font-size:12px; font-weight:700; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .step-text { font-size:14px; color:#374151; line-height:1.5; }
  .step-text strong { color:#1a1a2e; }
  .cta { text-align:center; margin:28px 0; }
  .btn { display:inline-block; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:white; font-size:15px; font-weight:600; padding:13px 32px; border-radius:10px; text-decoration:none; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="${LOGO_URL}" alt="QuoteAI" />
    <h1>Welcome to QuoteAI! 🎉</h1>
    <p>Your account is ready — start creating quotes right away</p>
  </div>
  <div class="body">
    <p class="greeting">Hi ${firstName},<br/><br/>you're now registered on <strong>QuoteAI</strong>, the tool that turns a job description into a professional quote in seconds. We're glad to have you with us!</p>

    <div class="trial-box">
      <h2>🎁 Your free trial includes:</h2>
      <div class="feature"><span class="check">✓</span> <span>Create <strong>unlimited quotes</strong> with AI</span></div>
      <div class="feature"><span class="check">✓</span> <span>Full preview of every quote</span></div>
      <div class="feature"><span class="check">✓</span> <span><strong>3 free PDF downloads</strong> to try the service</span></div>
      <div class="feature"><span class="check">✓</span> <span>No credit card required to get started</span></div>
    </div>

    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text"><strong>Complete your business profile</strong><br/>Add your company name, GST/HST number, and logo to personalize your PDFs.</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text"><strong>Describe the job you want to quote</strong><br/>Type it (or speak it) and the AI generates the quote in seconds.</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text"><strong>Download and send it to your client</strong><br/>A professional PDF, ready instantly. Then choose a plan to keep going.</div>
      </div>
    </div>

    <div class="cta">
      <a href="https://quoteai.ca/dashboard" class="btn">Create your first quote →</a>
    </div>

    <p style="font-size:13px;color:#6b7280;text-align:center;">Questions? Reach us at <a href="mailto:support@quoteai.ca" style="color:#7c3aed;">support@quoteai.ca</a></p>
  </div>
  <div class="footer">
    QuoteAI · Professional AI-powered quotes<br/>
    You received this email because you just signed up on <a href="https://quoteai.ca" style="color:#7c3aed;">quoteai.ca</a>.
  </div>
</div>
</body>
</html>`;
}

export async function sendWelcomeEmail(params: {
  toEmail: string;
  toName: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping welcome email");
    return;
  }
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "QuoteAI <no-reply@quoteai.ca>",
      to: [params.toEmail],
      subject: "Welcome to QuoteAI — your account is ready 🎉",
      html: buildWelcomeEmail(params.toName),
    });
    logger.info({ to: params.toEmail }, "Welcome email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send welcome email (non-fatal)");
  }
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
    const resend = new Resend(apiKey);
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

function buildQuoteEmailHtml(params: {
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  publicUrl?: string | null;
}): string {
  const companyName = escapeHtml(params.companyName);
  const clientName = escapeHtml(params.clientName);
  const { quoteNumber, totale, publicUrl } = params;
  const ctaHtml = publicUrl
    ? `<div class="cta"><a class="btn" href="${publicUrl}">View &amp; accept online</a></div>
    <p style="font-size:13px;color:#6b7280;text-align:center;margin-top:-12px;">You can review the full quote in your browser and accept it in one click.</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Quote from ${companyName}</title>
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
    <img src="${LOGO_URL}" alt="QuoteAI" />
    <h1>Your quote is ready</h1>
    <p>${companyName} has sent you a professional quote</p>
  </div>
  <div class="body">
    <p class="greeting">Hi ${clientName || "there"},<br/><br/>attached you'll find the quote from <strong>${companyName}</strong>. If you have any questions, feel free to reach out.</p>

    <div class="quote-box">
      <div class="quote-row">
        <span class="quote-label">Quote</span>
        <span><strong>${quoteNumber}</strong></span>
      </div>
      <div class="quote-row">
        <span class="quote-label">Total amount</span>
        <span>$ ${totale}</span>
      </div>
    </div>
    ${ctaHtml}

    <p style="font-size:13px;color:#6b7280;text-align:center;">Document generated with <a href="https://quoteai.ca" style="color:#7c3aed;">QuoteAI</a></p>
  </div>
  <div class="footer">
    ${companyName}<br/>
    You received this email because you were listed as the recipient of this quote.
  </div>
</div>
</body>
</html>`;
}

function buildWidgetClientConfirmationEmail(params: {
  clientName: string;
  companyName: string;
  companyPhone: string | null;
  companyEmail: string | null;
  prezzoMinimo: string;
  prezzoMassimo: string;
}): string {
  const { clientName, companyName, companyPhone, companyEmail, prezzoMinimo, prezzoMassimo } = params;
  const contactLine = [companyPhone, companyEmail].filter(Boolean).join(" · ");
  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Your request has been received – ${companyName}</title>
<style>
  body { margin:0; padding:0; background:#f5f3ff; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(124,58,237,0.08); }
  .header { background:linear-gradient(135deg,#7c3aed,#06b6d4); padding:32px 40px; text-align:center; }
  .header img { height:36px; }
  .header h1 { color:white; font-size:20px; font-weight:700; margin:16px 0 4px; }
  .header p { color:rgba(255,255,255,0.85); font-size:14px; margin:0; }
  .body { padding:32px 40px; }
  .greeting { font-size:16px; color:#1a1a2e; margin-bottom:20px; line-height:1.6; }
  .price-box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:12px; padding:20px 24px; margin:24px 0; text-align:center; }
  .price-box .label { font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; }
  .price-box .range { font-size:22px; font-weight:700; color:#7c3aed; margin-top:6px; }
  .incentives-box { background:#ecfdf5; border:1px solid #d1fae5; border-radius:12px; padding:16px 20px; margin:20px 0; font-size:13px; color:#065f46; line-height:1.6; }
  .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <img src="${LOGO_URL}" alt="QuoteAI" />
    <h1>Request received ✓</h1>
    <p>${companyName} has received your quote request</p>
  </div>
  <div class="body">
    <p class="greeting">Hi ${clientName},<br/><br/>thanks for requesting an estimate from <strong>${companyName}</strong>. Their team will get back to you shortly to schedule a site visit and finalize the quote.</p>

    <div class="price-box">
      <div class="label">Estimated range</div>
      <div class="range">${prezzoMinimo} – ${prezzoMassimo} CAD</div>
    </div>

    <p style="font-size:13px;color:#6b7280;text-align:center;">This is an automatic AI-generated estimate and may change after an on-site visit.${contactLine ? ` For any questions you can contact ${companyName} directly: ${contactLine}.` : ""}</p>
  </div>
  <div class="footer">
    Estimate calculated with <a href="https://quoteai.ca" style="color:#7c3aed;">QuoteAI</a> technology<br/>
    You received this email because you requested a quote through ${companyName}'s website.
  </div>
</div>
</body>
</html>`;
}

export async function sendWidgetClientConfirmationEmail(params: {
  toEmail: string;
  clientName: string;
  companyName: string;
  companyPhone: string | null;
  companyEmail: string | null;
  prezzoMinimo: string;
  prezzoMassimo: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping widget client confirmation email");
    return;
  }
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "QuoteAI <no-reply@quoteai.ca>",
      to: [params.toEmail],
      subject: `Your request to ${params.companyName} has been received`,
      html: buildWidgetClientConfirmationEmail({
        clientName: escapeHtml(params.clientName),
        companyName: escapeHtml(params.companyName),
        companyPhone: params.companyPhone,
        companyEmail: params.companyEmail,
        prezzoMinimo: params.prezzoMinimo,
        prezzoMassimo: params.prezzoMassimo,
      }),
    });
    logger.info({ to: params.toEmail }, "Widget client confirmation email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send widget client confirmation email (non-fatal)");
  }
}

export async function sendQuotePdfEmail(params: {
  toEmail: string;
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totale: string;
  pdfBuffer: Buffer;
  filename: string;
  publicUrl?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping quote email");
    throw new Error("Email service not configured");
  }
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "QuoteAI <no-reply@quoteai.ca>",
      to: [params.toEmail],
      subject: `Quote ${params.quoteNumber} – ${params.companyName}`,
      html: buildQuoteEmailHtml({
        companyName: params.companyName,
        clientName: params.clientName,
        quoteNumber: params.quoteNumber,
        totale: params.totale,
        publicUrl: params.publicUrl ?? null,
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
    throw new Error("Failed to send the quote email");
  }
}

export async function sendWidgetLeadNotification(params: {
  toEmail: string;
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  rawInput: string;
  totale: string;
  prezzoMinimo: string;
  prezzoMassimo: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping widget lead notification email");
    return;
  }
  const { toEmail, companyName, clientName, clientEmail, clientPhone, rawInput, totale, prezzoMinimo, prezzoMassimo } = params;
  const safeClientName = escapeHtml(clientName);
  const safeClientEmail = escapeHtml(clientEmail);
  const safeClientPhone = escapeHtml(clientPhone);
  const safeRawInput = escapeHtml(rawInput);
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "QuoteAI <no-reply@quoteai.ca>",
      to: [toEmail],
      subject: `⚡ New Lead Converted from Widget — ${clientName}`,
      html: `<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8" />
<title>New Widget Lead</title>
<style>
  body { margin:0; padding:0; background:#f4f4f5; font-family:system-ui,-apple-system,sans-serif; }
  .wrapper { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); border:1px solid #e4e4e7; }
  .header { background:linear-gradient(135deg,#7c3aed,#4f46e5); padding:28px 32px; text-align:center; color:white; }
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
    <h1>⚡ New Lead Converted</h1>
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

    <div class="price-box">
      <div class="price-row">
        <span>AI-Generated Estimate:</span>
        <span style="font-size:16px;">${prezzoMinimo} – ${prezzoMassimo} CAD</span>
      </div>
      <div style="font-size:11px; color:#71717a; font-weight:normal; margin-top:4px; text-align:right;">Calculated quote total: ${totale} CAD</div>
    </div>

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
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "QuoteAI <no-reply@quoteai.ca>",
    to: [params.toEmail],
    subject: `${params.clientName} accepted quote ${params.quoteNumber}`,
    html: buildQuoteAcceptedEmail(params),
  });
  logger.info({ to: params.toEmail, quoteNumber: params.quoteNumber }, "Quote accepted email sent");
}
