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

/** Phase 7: invite for a person to get their own login on a company's QuoteAI account. */
export async function sendTeamMemberInviteEmail(params: { toEmail: string; companyName: string; inviterName: string; role: string; url: string; language: EmailLang }): Promise<void> {
  const { language: lang } = params;
  const company = escapeHtml(params.companyName);
  const inviter = escapeHtml(params.inviterName);
  const t = lang === "fr"
    ? {
        title: "Vous êtes invité à rejoindre une équipe",
        sub: `${params.companyName} sur QuoteAI`,
        body: `Bonjour,<br/><br/><strong>${inviter}</strong> vous invite à rejoindre le compte QuoteAI de <strong>${company}</strong> avec le rôle « ${escapeHtml(params.role)} ». Créez votre accès en cliquant ci-dessous.`,
        btn: "Rejoindre l'équipe",
        hint: "Ce lien vous est personnel et expire dans 7 jours.",
        footer: `Envoyé via QuoteAI au nom de ${company}.`,
        subject: `${params.companyName} vous invite sur QuoteAI`,
      }
    : {
        title: "You're invited to join a team",
        sub: `${params.companyName} on QuoteAI`,
        body: `Hi,<br/><br/><strong>${inviter}</strong> is inviting you to join <strong>${company}</strong>'s QuoteAI account as a ${escapeHtml(params.role)}. Set up your access below.`,
        btn: "Join the team",
        hint: "This link is personal to you and expires in 7 days.",
        footer: `Sent through QuoteAI on behalf of ${company}.`,
        subject: `${params.companyName} invited you to QuoteAI`,
      };
  const html = shell({
    lang,
    headerTitle: t.title,
    headerSub: t.sub,
    bodyHtml: `<p>${t.body}</p><div class="cta"><a class="btn" href="${params.url}">${t.btn}</a></div><p class="muted">${t.hint}</p>`,
    footer: t.footer,
  });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
  logger.info({ to: params.toEmail }, "Team member invite email sent");
}

/** Phase 75: the evening-before (or same-morning) shift reminder, used when the worker has no phone or the text could not go. */
export async function sendWorkerScheduleReminderEmail(params: { toEmail: string; workerName: string; companyName: string; kind: "tomorrow" | "today"; body: string; label: string; notes: string; language: EmailLang }): Promise<void> {
  const { language: lang } = params;
  const company = escapeHtml(params.companyName);
  const worker = escapeHtml(params.workerName);
  const t = lang === "fr"
    ? {
        title: params.kind === "tomorrow" ? "Votre horaire de demain" : "Votre horaire d'aujourd'hui",
        sub: company,
        body: `Bonjour ${worker},<br/><br/>${escapeHtml(params.body)}`,
        hint: "Votre page de feuille de temps affiche toutes vos plages à venir. En cas d'empêchement, prévenez votre employeur.",
        footer: `Envoyé via QuoteAI au nom de ${company}.`,
        subject: `${params.companyName} — ${params.kind === "tomorrow" ? "demain" : "aujourd'hui"} : ${params.label}`,
      }
    : {
        title: params.kind === "tomorrow" ? "Your schedule for tomorrow" : "Your schedule for today",
        sub: company,
        body: `Hi ${worker},<br/><br/>${escapeHtml(params.body)}`,
        hint: "Your timesheet page lists every upcoming shift. If you can't make it, let your employer know.",
        footer: `Sent through QuoteAI on behalf of ${company}.`,
        subject: `${params.companyName} — ${params.kind === "tomorrow" ? "tomorrow" : "today"}: ${params.label}`,
      };
  const html = shell({ lang, headerTitle: t.title, headerSub: t.sub, bodyHtml: `<p>${t.body}</p><p class="muted">${t.hint}</p>`, footer: t.footer });
  await resendOrThrow().emails.send({ from: FROM, to: [params.toEmail], subject: t.subject, html });
  logger.info({ to: params.toEmail }, "Worker schedule reminder email sent");
}
