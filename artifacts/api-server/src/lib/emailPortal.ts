import { shell, escapeHtml, FROM, resendOrThrow, type EmailLang } from "./emailContracts.js";
import { sanitizeForFromHeader } from "./emailUtils.js";
import { logger } from "./logger.js";

// ── Phase 76: client-portal emails ──────────────────────────────────────────
// Four transactional messages: the sign-in code, the "here is your portal"
// invitation the contractor sends by hand, a copy of each message the company
// writes (to the client), and a copy of each reply (to the company). All go
// out through `resendOrThrow()` → brandedResend, so the registered-entity
// footer (Phase 73) is on every one. Transactional: never gated by the
// client's marketing opt-out.

export async function sendPortalOtpEmail(params: { toEmail: string; code: string; companyName: string; language: EmailLang }): Promise<void> {
  const { language: lang } = params;
  const t = lang === "fr"
    ? { title: "Votre code d'accès", sub: `Espace client de ${params.companyName}`, body: "Entrez ce code pour ouvrir votre espace client. Il expire dans 10 minutes.", subject: `${params.code} est votre code d'accès QuoteAI`, footer: "Si vous n'avez pas demandé ce code, ignorez ce courriel." }
    : { title: "Your access code", sub: `${params.companyName} client portal`, body: "Enter this code to open your client portal. It expires in 10 minutes.", subject: `${params.code} is your QuoteAI access code`, footer: "If you did not request this code, you can ignore this email." };
  const html = shell({
    lang,
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div style="text-align:center;margin:24px 0;"><span style="display:inline-block;font-size:34px;letter-spacing:10px;font-weight:800;color:#4c1d95;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:14px 26px;">${params.code}</span></div>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
}

export async function sendPortalInviteEmail(params: { toEmail: string; clientName: string; companyName: string; portalUrl: string; language: EmailLang; logoUrl?: string | null; replyTo?: string | null }): Promise<void> {
  const { language: lang } = params;
  const company = escapeHtml(params.companyName);
  const client = escapeHtml(params.clientName || (lang === "fr" ? "Bonjour" : "there"));
  const t = lang === "fr"
    ? {
        title: "Votre espace client",
        sub: company,
        body: `Bonjour ${client},<br/><br/>${company} vous a ouvert un espace client : vos soumissions, contrats, factures, l'avancement des travaux avec photos et un fil de messages, au même endroit.`,
        cta: "Ouvrir mon espace client",
        hint: "Le lien est personnel. À l'ouverture, un code à 6 chiffres vous est envoyé par courriel pour confirmer votre identité.",
        footer: `Envoyé via QuoteAI au nom de ${company}.`,
        subject: `${params.companyName} — votre espace client`,
      }
    : {
        title: "Your client portal",
        sub: company,
        body: `Hi ${client},<br/><br/>${company} has set up a client portal for you: your quotes, contracts, invoices, job progress with photos and a message thread, all in one place.`,
        cta: "Open my portal",
        hint: "The link is personal. When you open it, a 6-digit code is emailed to you to confirm it's you.",
        footer: `Sent through QuoteAI on behalf of ${company}.`,
        subject: `${params.companyName} — your client portal`,
      };
  const html = shell({
    lang,
    headerTitle: t.title,
    headerSub: t.sub,
    logoUrl: params.logoUrl,
    logoAlt: params.companyName,
    bodyHtml: `<p>${t.body}</p><div class="cta"><a class="btn" href="${params.portalUrl}">${t.cta}</a></div><p class="muted">${t.hint}</p>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: `${sanitizeForFromHeader(params.companyName)} via QuoteAI <no-reply@quoteai.ca>`, to: [params.toEmail], subject: t.subject, html, ...(params.replyTo ? { replyTo: params.replyTo } : {}) });
  logger.info({ to: params.toEmail }, "Portal invite email sent");
}

/** A message the company wrote, delivered to the client with a link back to the thread. */
export async function sendClientMessageEmail(params: { toEmail: string; clientName: string; companyName: string; senderName: string; body: string; jobName: string | null; portalUrl: string; language: EmailLang; logoUrl?: string | null; replyTo?: string | null }): Promise<void> {
  const { language: lang } = params;
  const company = escapeHtml(params.companyName);
  const sender = escapeHtml(params.senderName || params.companyName);
  const client = escapeHtml(params.clientName || (lang === "fr" ? "Bonjour" : "there"));
  const job = params.jobName ? escapeHtml(params.jobName) : null;
  const t = lang === "fr"
    ? {
        title: "Nouveau message",
        sub: job ? `${company} · ${job}` : company,
        body: `Bonjour ${client},<br/><br/>${sender} vous a écrit${job ? ` au sujet de <strong>${job}</strong>` : ""} :`,
        cta: "Répondre dans mon espace client",
        hint: "Répondez depuis votre espace client — votre réponse arrive directement à l'entreprise.",
        footer: `Envoyé via QuoteAI au nom de ${company}.`,
        subject: `${params.senderName || params.companyName}${job ? ` — ${params.jobName}` : ""} : nouveau message`,
      }
    : {
        title: "New message",
        sub: job ? `${company} · ${job}` : company,
        body: `Hi ${client},<br/><br/>${sender} wrote to you${job ? ` about <strong>${job}</strong>` : ""}:`,
        cta: "Reply in my portal",
        hint: "Reply from your client portal — your answer goes straight to the company.",
        footer: `Sent through QuoteAI on behalf of ${company}.`,
        subject: `${params.senderName || params.companyName}${job ? ` — ${params.jobName}` : ""}: new message`,
      };
  const html = shell({
    lang,
    headerTitle: t.title,
    headerSub: t.sub,
    logoUrl: params.logoUrl,
    logoAlt: params.companyName,
    bodyHtml: `<p>${t.body}</p><div class="msg">${escapeHtml(params.body)}</div><div class="cta"><a class="btn" href="${params.portalUrl}">${t.cta}</a></div><p class="muted">${t.hint}</p>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: `${sanitizeForFromHeader(params.companyName)} via QuoteAI <no-reply@quoteai.ca>`, to: [params.toEmail], subject: t.subject, html, ...(params.replyTo ? { replyTo: params.replyTo } : {}) });
}

/** A client's reply, delivered to the company with a link to the thread in the dashboard. */
export async function sendClientReplyEmail(params: { toEmail: string; clientName: string; body: string; jobName: string | null; dashboardUrl: string; language: EmailLang }): Promise<void> {
  const { language: lang } = params;
  const client = escapeHtml(params.clientName);
  const job = params.jobName ? escapeHtml(params.jobName) : null;
  const t = lang === "fr"
    ? {
        title: "Réponse d'un client",
        sub: job ? `${client} · ${job}` : client,
        body: `${client} vous a répondu${job ? ` au sujet de <strong>${job}</strong>` : ""} depuis son espace client :`,
        cta: "Répondre dans QuoteAI",
        footer: "Vous recevez ce courriel parce qu'un client vous a écrit depuis son espace client QuoteAI.",
        subject: `${params.clientName}${job ? ` — ${params.jobName}` : ""} : nouvelle réponse`,
      }
    : {
        title: "Reply from a client",
        sub: job ? `${client} · ${job}` : client,
        body: `${client} replied${job ? ` about <strong>${job}</strong>` : ""} from their client portal:`,
        cta: "Reply in QuoteAI",
        footer: "You received this because a client wrote to you from their QuoteAI client portal.",
        subject: `${params.clientName}${job ? ` — ${params.jobName}` : ""}: new reply`,
      };
  const html = shell({
    lang,
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div class="msg">${escapeHtml(params.body)}</div><div class="cta"><a class="btn" href="${params.dashboardUrl}">${t.cta}</a></div>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
}
