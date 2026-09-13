import { logger } from "./logger.js";
import { shell, escapeHtml, resendOrThrow, FROM, type EmailLang } from "./emailContracts.js";

// ── Invoice emails (Phase 4) ─────────────────────────────────────────────────
// Same visual shell as the contract emails. Every email carries the PDF and
// a link to the public invoice page (/i/:token) where the customer can see
// the balance and payment instructions.

const cad = (cents: number, lang: EmailLang) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
const day = (d: Date, lang: EmailLang) => d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long", timeZone: "America/Toronto" });

type Common = {
  toEmail: string;
  customerName: string;
  companyName: string;
  number: string;
  totalCents: number;
  balanceCents: number;
  dueDate: Date;
  publicUrl: string;
  language: EmailLang;
  etransferEmail?: string | null;
};

function summaryBox(p: Common, t: { invoice: string; due: string; total: string; balance: string; etransfer: string }): string {
  return `<div class="box">
    <div class="row"><span class="label">${t.invoice}</span><span><strong>${escapeHtml(p.number)}</strong></span></div>
    <div class="row"><span class="label">${t.due}</span><span>${day(p.dueDate, p.language)}</span></div>
    ${p.etransferEmail ? `<div class="row"><span class="label">${t.etransfer}</span><span>${escapeHtml(p.etransferEmail)}</span></div>` : ""}
    ${p.balanceCents !== p.totalCents ? `<div class="row"><span class="label">${t.total}</span><span>${cad(p.totalCents, p.language)}</span></div>` : ""}
    <div class="row"><span class="label">${t.balance}</span><span>${cad(p.balanceCents, p.language)}</span></div>
  </div>`;
}

export async function sendInvoiceEmail(params: Common & { pdfBuffer: Buffer; message?: string; isCreditNote?: boolean; typeLabel: string }): Promise<void> {
  const { language: lang } = params;
  const company = escapeHtml(params.companyName);
  const customer = escapeHtml(params.customerName || (lang === "fr" ? "Bonjour" : "there"));
  const cn = params.isCreditNote;
  const t = lang === "fr"
    ? {
        title: cn ? "Note de crédit" : `${params.typeLabel} — ${params.number}`,
        sub: `${params.companyName}`,
        body: cn
          ? `Bonjour ${customer},<br/><br/><strong>${company}</strong> vous a émis une note de crédit. Le document est joint à ce courriel et le solde de votre facture a été ajusté en conséquence.`
          : `Bonjour ${customer},<br/><br/><strong>${company}</strong> vous a envoyé une facture pour votre projet. Le document PDF est joint; vous pouvez aussi la consulter en ligne avec les modalités de paiement.`,
        btn: cn ? "Voir la note de crédit" : "Voir la facture et payer",
        footer: `Facture envoyée via QuoteAI au nom de ${company}. Des questions ? Répondez directement à ${company}.`,
        subject: cn ? `Note de crédit ${params.number} de ${params.companyName}` : `Facture ${params.number} de ${params.companyName} — ${cad(params.balanceCents, lang)}`,
        invoice: cn ? "Note de crédit" : "Facture", due: "Échéance", total: "Total", balance: cn ? "Montant" : "Solde à payer", etransfer: "Virement Interac à",
      }
    : {
        title: cn ? "Credit note" : `${params.typeLabel} — ${params.number}`,
        sub: `${params.companyName}`,
        body: cn
          ? `Hi ${customer},<br/><br/><strong>${company}</strong> has issued you a credit note. The document is attached and the balance of your invoice has been adjusted accordingly.`
          : `Hi ${customer},<br/><br/><strong>${company}</strong> has sent you an invoice for your project. The PDF is attached; you can also view it online along with the payment instructions.`,
        btn: cn ? "View credit note" : "View invoice & pay",
        footer: `Invoice sent through QuoteAI on behalf of ${company}. Questions? Reply to ${company} directly.`,
        subject: cn ? `Credit note ${params.number} from ${params.companyName}` : `Invoice ${params.number} from ${params.companyName} — ${cad(params.balanceCents, lang)}`,
        invoice: cn ? "Credit note" : "Invoice", due: "Due", total: "Total", balance: cn ? "Amount" : "Balance due", etransfer: "Interac e-Transfer to",
      };
  const html = shell({
    lang,
    accent: cn ? "linear-gradient(135deg,#0f766e,#06b6d4)" : undefined,
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p>${params.message ? `<div class="msg">${escapeHtml(params.message)}</div>` : ""}${summaryBox(params, t)}<div class="cta"><a class="btn" href="${params.publicUrl}">${t.btn}</a></div>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({
    from: FROM,
    to: [params.toEmail],
    subject: t.subject,
    html,
    attachments: [{ filename: `${params.number}.pdf`, content: params.pdfBuffer.toString("base64") }],
  });
  logger.info({ to: params.toEmail, number: params.number }, "Invoice email sent");
}

export async function sendInvoiceReminderEmail(params: Common & { daysOverdue: number; pdfBuffer?: Buffer }): Promise<void> {
  const { language: lang } = params;
  const company = escapeHtml(params.companyName);
  const customer = escapeHtml(params.customerName || (lang === "fr" ? "Bonjour" : "there"));
  const t = lang === "fr"
    ? {
        title: "Rappel de paiement", sub: `Facture ${params.number}`,
        body: `Bonjour ${customer},<br/><br/>un petit rappel : la facture <strong>${escapeHtml(params.number)}</strong> de <strong>${company}</strong>, échue le ${day(params.dueDate, lang)}, présente un solde de <strong>${cad(params.balanceCents, lang)}</strong>. Si le paiement a déjà été effectué, merci d'ignorer ce message.`,
        btn: "Voir la facture et payer", subject: `Rappel — facture ${params.number} (${cad(params.balanceCents, lang)})`, footer: `Envoyé via QuoteAI au nom de ${company}.`,
        invoice: "Facture", due: "Échue le", total: "Total", balance: "Solde à payer", etransfer: "Virement Interac à",
      }
    : {
        title: "Payment reminder", sub: `Invoice ${params.number}`,
        body: `Hi ${customer},<br/><br/>a friendly reminder that invoice <strong>${escapeHtml(params.number)}</strong> from <strong>${company}</strong>, due ${day(params.dueDate, lang)}, has an outstanding balance of <strong>${cad(params.balanceCents, lang)}</strong>. If you have already paid, please disregard this message.`,
        btn: "View invoice & pay", subject: `Reminder — invoice ${params.number} (${cad(params.balanceCents, lang)})`, footer: `Sent through QuoteAI on behalf of ${company}.`,
        invoice: "Invoice", due: "Was due", total: "Total", balance: "Balance due", etransfer: "Interac e-Transfer to",
      };
  const html = shell({ lang, accent: "linear-gradient(135deg,#d97706,#f97316)", headerTitle: t.title, headerSub: t.sub, bodyHtml: `<p>${t.body}</p>${summaryBox(params, t)}<div class="cta"><a class="btn" href="${params.publicUrl}">${t.btn}</a></div>`, footer: t.footer });
  await resendOrThrow().emails.send({
    from: FROM,
    to: [params.toEmail],
    subject: t.subject,
    html,
    ...(params.pdfBuffer ? { attachments: [{ filename: `${params.number}.pdf`, content: params.pdfBuffer.toString("base64") }] } : {}),
  });
}

export async function sendPaymentReceiptEmail(params: Common & { paidCents: number; paidOn: Date }): Promise<void> {
  const { language: lang } = params;
  const company = escapeHtml(params.companyName);
  const customer = escapeHtml(params.customerName || (lang === "fr" ? "Bonjour" : "there"));
  const settled = params.balanceCents <= 0;
  const t = lang === "fr"
    ? {
        title: settled ? "Paiement reçu — merci !" : "Paiement partiel reçu", sub: `Facture ${params.number}`,
        body: `Bonjour ${customer},<br/><br/><strong>${company}</strong> confirme la réception de votre paiement de <strong>${cad(params.paidCents, lang)}</strong> le ${day(params.paidOn, lang)} pour la facture ${escapeHtml(params.number)}.${settled ? " La facture est maintenant entièrement payée." : ` Solde restant : <strong>${cad(params.balanceCents, lang)}</strong>.`}`,
        btn: "Voir la facture", subject: settled ? `Reçu — facture ${params.number} payée` : `Reçu — paiement de ${cad(params.paidCents, lang)} sur la facture ${params.number}`, footer: `Envoyé via QuoteAI au nom de ${company}.`,
        invoice: "Facture", due: "Échéance", total: "Total", balance: "Solde", etransfer: "Virement Interac à",
      }
    : {
        title: settled ? "Payment received — thank you!" : "Partial payment received", sub: `Invoice ${params.number}`,
        body: `Hi ${customer},<br/><br/><strong>${company}</strong> confirms receipt of your payment of <strong>${cad(params.paidCents, lang)}</strong> on ${day(params.paidOn, lang)} for invoice ${escapeHtml(params.number)}.${settled ? " The invoice is now paid in full." : ` Remaining balance: <strong>${cad(params.balanceCents, lang)}</strong>.`}`,
        btn: "View invoice", subject: settled ? `Receipt — invoice ${params.number} paid` : `Receipt — ${cad(params.paidCents, lang)} payment on invoice ${params.number}`, footer: `Sent through QuoteAI on behalf of ${company}.`,
        invoice: "Invoice", due: "Due", total: "Total", balance: "Balance", etransfer: "Interac e-Transfer to",
      };
  const html = shell({ lang, accent: "linear-gradient(135deg,#059669,#06b6d4)", headerTitle: t.title, headerSub: t.sub, bodyHtml: `<p>${t.body}</p>${summaryBox({ ...params, etransferEmail: settled ? null : params.etransferEmail }, t)}<div class="cta"><a class="btn" href="${params.publicUrl}">${t.btn}</a></div>`, footer: t.footer });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
}
