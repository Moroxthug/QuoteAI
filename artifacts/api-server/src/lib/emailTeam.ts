import { logger } from "./logger.js";
import { FROM, escapeHtml, resendOrThrow, shell, type EmailLang } from "./emailContracts.js";

/** Magic-link invite for the worker time-entry page (/t/:token). */
export async function sendWorkerInviteEmail(params: { toEmail: string; workerName: string; companyName: string; url: string; language: EmailLang }): Promise<void> {
  const { language: lang } = params;
  const company = escapeHtml(params.companyName);
  const worker = escapeHtml(params.workerName);
  const t = lang === "fr"
    ? {
        title: "Votre lien pour saisir vos heures",
        sub: `${params.companyName} vous a ajouté à son équipe`,
        body: `Bonjour ${worker},<br/><br/><strong>${company}</strong> utilise QuoteAI pour suivre les heures de chantier. Ouvrez le lien ci-dessous sur votre téléphone pour saisir vos heures chaque jour — pas de compte ni de mot de passe. Ajoutez la page à votre écran d'accueil pour la retrouver vite.`,
        btn: "Saisir mes heures",
        hint: "Ce lien vous est personnel : ne le partagez pas. Si vous le perdez, demandez-en un nouveau à votre employeur.",
        footer: `Envoyé via QuoteAI au nom de ${company}.`,
        subject: `${params.companyName} — votre lien de feuille de temps`,
      }
    : {
        title: "Your time-entry link",
        sub: `${params.companyName} added you to their team`,
        body: `Hi ${worker},<br/><br/><strong>${company}</strong> uses QuoteAI to track hours on site. Open the link below on your phone to log your hours each day — no account or password needed. Add the page to your home screen to find it quickly.`,
        btn: "Log my hours",
        hint: "This link is personal to you — please don't share it. If you lose it, ask your employer for a new one.",
        footer: `Sent through QuoteAI on behalf of ${company}.`,
        subject: `${params.companyName} — your timesheet link`,
      };
  const html = shell({
    lang,
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div class="cta"><a class="btn" href="${params.url}">${t.btn}</a></div><p class="muted">${t.hint}</p>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
  logger.info({ to: params.toEmail }, "Worker invite email sent");
}
