// Phase 72: the two account-lifecycle emails (export ready, deletion scheduled).
import { logger } from "../lib/logger.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { FROM, escapeHtml, resendOrThrow, shell, type EmailLang } from "../lib/emailContracts.js";

function fmtDate(d: Date, lang: EmailLang): string {
  return d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Toronto" });
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function sendAccountExportReadyEmail(params: { toEmail: string; url: string; expiresAt: Date; language: EmailLang; sizeBytes: number }): Promise<void> {
  const lang = params.language;
  const t = lang === "fr"
    ? {
        subject: "Votre export de données QuoteAI est prêt",
        title: "Votre export est prêt",
        sub: "Une copie de toutes vos données QuoteAI",
        body: `Le fichier ZIP (${fmtSize(params.sizeBytes)}) contient une entrée JSON par table et tous vos PDF, photos et pièces jointes. Le lien expire le <strong>${fmtDate(params.expiresAt, lang)}</strong>.`,
        btn: "Télécharger mon export",
        hint: "Ce lien est personnel : ne le partagez pas. Vous pouvez demander un nouvel export une fois par jour depuis Réglages → Sécurité.",
        footer: "Envoyé par QuoteAI à la suite de votre demande d'accès à vos données (LPRPDE / Loi 25).",
      }
    : {
        subject: "Your QuoteAI data export is ready",
        title: "Your export is ready",
        sub: "A copy of everything in your QuoteAI account",
        body: `The ZIP file (${fmtSize(params.sizeBytes)}) holds one JSON file per table plus every PDF, photo and attachment. The link expires on <strong>${fmtDate(params.expiresAt, lang)}</strong>.`,
        btn: "Download my export",
        hint: "This link is personal to you — please don't share it. You can request a new export once a day from Settings → Security.",
        footer: "Sent by QuoteAI in response to your data access request (PIPEDA / Law 25).",
      };
  const html = shell({
    lang,
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div class="cta"><a class="btn" href="${params.url}">${t.btn}</a></div><p class="muted">${t.hint}</p>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
  logger.info({ to: params.toEmail }, "Account export email sent");
}

export async function sendAccountDeletionScheduledEmail(params: { toEmail: string; scheduledFor: Date; cancelToken: string; language: EmailLang; companyName: string | null }): Promise<void> {
  const lang = params.language;
  const cancelUrl = `${getBaseUrl()}/api/account/deletion/cancel/${params.cancelToken}`;
  const who = params.companyName ? ` (${escapeHtml(params.companyName)})` : "";
  const t = lang === "fr"
    ? {
        subject: "Suppression de votre compte QuoteAI planifiée",
        title: "Votre compte sera supprimé",
        sub: `Le ${fmtDate(params.scheduledFor, lang)}`,
        body: `Nous avons reçu la demande de suppression de votre compte QuoteAI${who}. Vous êtes déconnecté partout, votre abonnement est annulé et vos intégrations sont déconnectées. Le <strong>${fmtDate(params.scheduledFor, lang)}</strong>, vos données seront effacées définitivement.<br/><br/>Exception légale : les contrats signés et les factures émises sont conservés 7 ans (exigence de l'ARC et de Revenu Québec), sans lien avec votre profil, puis supprimés.`,
        btn: "Annuler la suppression",
        hint: "Ce n'était pas vous ? Cliquez sur le bouton ci-dessus avant la date indiquée : votre compte sera réactivé et vous pourrez vous reconnecter (l'abonnement et les intégrations devront être rétablis).",
        footer: "Envoyé par QuoteAI. Politique de confidentialité : " + getBaseUrl() + "/fr/confidentialite/",
      }
    : {
        subject: "Your QuoteAI account deletion is scheduled",
        title: "Your account will be deleted",
        sub: `On ${fmtDate(params.scheduledFor, lang)}`,
        body: `We received the request to delete your QuoteAI account${who}. You have been signed out everywhere, your subscription is cancelled and your integrations are disconnected. On <strong>${fmtDate(params.scheduledFor, lang)}</strong> your data will be permanently erased.<br/><br/>Legal exception: signed contracts and issued invoices are kept for 7 years (a CRA / Revenu Québec requirement), unlinked from your profile, then deleted.`,
        btn: "Cancel the deletion",
        hint: "Wasn't you? Click the button above before that date: your account is reactivated and you can sign in again (the subscription and integrations will need to be set up again).",
        footer: "Sent by QuoteAI. Privacy policy: " + getBaseUrl() + "/privacy-policy/",
      };
  const html = shell({
    lang,
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div class="cta"><a class="btn" href="${cancelUrl}">${t.btn}</a></div><p class="muted">${t.hint}</p>`,
    footer: t.footer,
    accent: "linear-gradient(135deg,#b91c1c,#f97316)",
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
  logger.info({ to: params.toEmail }, "Account deletion email sent");
}
