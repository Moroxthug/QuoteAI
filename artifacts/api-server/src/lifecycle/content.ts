// Phase 134: the words and HTML of the lifecycle emails, English and Quebec French. Pure: everything it needs comes in as arguments.
// Tone: plain and warm, for tradespeople. Short. One button each. FR uses "vous" (docs/pocket-design/kit/FR-BRIEF.md): soumission, facture, chantier, courriel.

import { escapeHtml } from "../lib/email.js";
import { shell, button } from "../lib/accountEmails.js";
import { withLegalFooter } from "../lib/legalFooter.js";
import type { LifecycleKey } from "./rules.js";

export type LifecycleLang = "en" | "fr";

export type LaunchOfferInfo = { active: boolean; launchPriceCents: number; remaining: number };

export type LifecycleEmailInput = {
  key: LifecycleKey;
  lang: LifecycleLang;
  /** First name or "" */
  name: string;
  baseUrl: string;
  unsubscribeUrl: string;
  /** Free quotes in all (for the "used" message). */
  freeLimit: number;
  /** From currentLaunchOffer(); null = say nothing about a price. */
  offer: LaunchOfferInfo | null;
};

export type LifecycleEmail = { subject: string; preheader: string; html: string; text: string };

type Copy = { subject: string; preheader: string; heading: string; paragraphs: string[]; cta: string; ctaPath: string };

export function formatPrice(cents: number, lang: LifecycleLang): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/** The founding-price sentence, only while the offer is on. Null otherwise: no price is ever written by hand. */
export function offerLine(offer: LaunchOfferInfo | null, lang: LifecycleLang): string | null {
  if (!offer || !offer.active || offer.remaining <= 0) return null;
  const price = formatPrice(offer.launchPriceCents, lang);
  const n = offer.remaining;
  return lang === "fr"
    ? `Prix fondateur : ${price} par mois, gardé à vie. Il reste ${n} ${n === 1 ? "place" : "places"}.`
    : `Founding price: ${price} a month, kept for life. ${n} ${n === 1 ? "spot" : "spots"} left.`;
}

function copyFor(i: LifecycleEmailInput): Copy {
  const fr = i.lang === "fr";
  const offer = offerLine(i.offer, i.lang);
  const extra = offer ? [offer] : [];
  switch (i.key) {
    case "welcome":
      return fr
        ? {
            subject: "Bienvenue sur QuoteAI : votre première soumission en 5 minutes",
            preheader: "Décrivez un chantier, QuoteAI prépare la soumission.",
            heading: "Votre compte est prêt",
            paragraphs: [
              "Merci de vous être inscrit. Pour commencer, pas besoin de tout configurer.",
              "Décrivez un chantier, au clavier ou à la voix, et QuoteAI prépare une soumission détaillée avec les taxes de votre province. Vous la relisez, puis vous l'envoyez à votre client.",
            ],
            cta: "Faire ma première soumission",
            ctaPath: "/dashboard/new",
          }
        : {
            subject: "Welcome to QuoteAI: your first quote in 5 minutes",
            preheader: "Describe a job and QuoteAI drafts the quote.",
            heading: "Your account is ready",
            paragraphs: [
              "Thanks for signing up. You do not need to set everything up first.",
              "Describe a job, typed or spoken, and QuoteAI drafts an itemized quote with your province's taxes. You check it, then send it to your client.",
            ],
            cta: "Make my first quote",
            ctaPath: "/dashboard/new",
          };
    case "day1_no_quote":
      return fr
        ? {
            subject: "Une soumission prête avant la fin de la journée?",
            preheader: "Un chantier, quelques mots, et c'est parti.",
            heading: "Votre première soumission vous attend",
            paragraphs: [
              "Vous avez créé votre compte hier, mais aucune soumission n'est encore faite.",
              "Prenez un chantier récent ou à venir et décrivez-le en quelques phrases. Ça prend environ cinq minutes, et les soumissions gratuites sont là pour essayer.",
            ],
            cta: "Créer une soumission",
            ctaPath: "/dashboard/new",
          }
        : {
            subject: "A quote done before the end of the day?",
            preheader: "One job, a few words, and you are off.",
            heading: "Your first quote is waiting",
            paragraphs: [
              "You created your account yesterday, but no quote is made yet.",
              "Take a recent or upcoming job and describe it in a few sentences. It takes about five minutes, and your free quotes are there to try it out.",
            ],
            cta: "Create a quote",
            ctaPath: "/dashboard/new",
          };
    case "first_quote_done":
      return fr
        ? {
            subject: "Votre soumission est prête : envoyez-la à votre client",
            preheader: "Plus tôt votre client la reçoit, plus tôt il répond.",
            heading: "Bravo pour votre première soumission",
            paragraphs: [
              "Votre soumission est faite, mais elle n'a pas encore été envoyée.",
              "Ouvrez-la, vérifiez les chiffres, puis envoyez-la par courriel. Votre client pourra la consulter, l'accepter et la signer en ligne.",
            ],
            cta: "Ouvrir mes soumissions",
            ctaPath: "/dashboard/quotes",
          }
        : {
            subject: "Your quote is ready: send it to your client",
            preheader: "The sooner a client has it, the sooner you hear back.",
            heading: "Nice work on your first quote",
            paragraphs: [
              "Your quote is made, but it has not been sent yet.",
              "Open it, check the numbers, then email it. Your client can view it, accept it and sign it online.",
            ],
            cta: "Open my quotes",
            ctaPath: "/dashboard/quotes",
          };
    case "free_quotes_low":
      return fr
        ? {
            subject: "Il vous reste 1 soumission gratuite",
            preheader: "Gardez-la pour un client qui compte.",
            heading: "Plus qu'une soumission gratuite",
            paragraphs: [
              "Il vous reste 1 soumission gratuite.",
              "Quand elle sera utilisée, il faudra choisir un forfait pour continuer à soumissionner. Vos soumissions et vos données restent à vous, quoi qu'il arrive.",
              ...extra,
            ],
            cta: "Voir les forfaits",
            ctaPath: "/dashboard/billing",
          }
        : {
            subject: "You have 1 free quote left",
            preheader: "Save it for a client that counts.",
            heading: "One free quote left",
            paragraphs: [
              "You have 1 free quote left.",
              "Once it is used you will need a plan to keep quoting. Your quotes and data stay yours either way.",
              ...extra,
            ],
            cta: "See the plans",
            ctaPath: "/dashboard/billing",
          };
    case "free_quotes_used":
      return fr
        ? {
            subject: "Vos soumissions gratuites sont utilisées",
            preheader: "Voici comment continuer quand vous serez prêt.",
            heading: `Vos ${i.freeLimit} soumissions gratuites sont utilisées`,
            paragraphs: [
              "Vous avez fait le tour de l'essai, et nous espérons que ça vous a fait gagner du temps.",
              "Pour continuer à faire des soumissions, choisissez le forfait qui convient à votre entreprise. Rien ne presse : tout ce que vous avez déjà fait reste en place.",
              ...extra,
            ],
            cta: "Choisir un forfait",
            ctaPath: "/dashboard/billing",
          }
        : {
            subject: "Your free quotes are used up",
            preheader: "Here is how to keep going when you are ready.",
            heading: `Your ${i.freeLimit} free quotes are used`,
            paragraphs: [
              "You have been through the trial, and we hope it saved you some time.",
              "To keep making quotes, pick the plan that fits your business. No rush: everything you have already done stays in place.",
              ...extra,
            ],
            cta: "Choose a plan",
            ctaPath: "/dashboard/billing",
          };
    case "day7_inactive":
      return fr
        ? {
            subject: "On garde votre place chez QuoteAI",
            preheader: "Un chantier à soumissionner cette semaine?",
            heading: "Ça fait une semaine",
            paragraphs: [
              "Nous ne vous avons pas vu depuis quelques jours. Si un client attend une soumission, c'est le bon moment pour la sortir.",
              "Décrivez le chantier, relisez, envoyez. Si quelque chose vous a bloqué, répondez à ce courriel et nous vous aiderons.",
            ],
            cta: "Ouvrir QuoteAI",
            ctaPath: "/dashboard",
          }
        : {
            subject: "Your spot at QuoteAI is saved",
            preheader: "A job to quote this week?",
            heading: "It has been a week",
            paragraphs: [
              "We have not seen you for a few days. If a client is waiting on a quote, now is a good time to get it out.",
              "Describe the job, check it, send it. If something got in your way, reply to this email and we will help.",
            ],
            cta: "Open QuoteAI",
            ctaPath: "/dashboard",
          };
    case "win_back":
      return fr
        ? {
            subject: "Un petit mot de QuoteAI",
            preheader: "Si le travail a ralenti, ou si quelque chose clochait, dites-le-nous.",
            heading: "Ça fait un moment",
            paragraphs: [
              "Votre compte QuoteAI est toujours là, avec tout ce que vous y avez mis.",
              "Si quelque chose n'a pas fonctionné comme vous le souhaitiez, répondez à ce courriel : nous lisons tout. Sinon, votre prochaine soumission est à quelques minutes d'ici.",
              ...extra,
            ],
            cta: "Revenir à QuoteAI",
            ctaPath: "/dashboard",
          }
        : {
            subject: "A quick note from QuoteAI",
            preheader: "If work slowed down, or something was off, tell us.",
            heading: "It has been a while",
            paragraphs: [
              "Your QuoteAI account is still here, with everything you put in it.",
              "If something did not work the way you hoped, reply to this email: we read everything. Otherwise your next quote is a few minutes away.",
              ...extra,
            ],
            cta: "Back to QuoteAI",
            ctaPath: "/dashboard",
          };
  }
}

/** Why they got it, and the way out. Present in every email. */
function footerLines(lang: LifecycleLang, unsubscribeUrl: string): { html: string; text: string } {
  const url = escapeHtml(unsubscribeUrl);
  if (lang === "fr") {
    return {
      html: `Vous recevez ce courriel parce que vous avez créé un compte sur quoteai.ca.<br/><a href="${url}" style="color:#6b7280">Me désabonner de ces courriels</a>`,
      text: `Vous recevez ce courriel parce que vous avez créé un compte sur quoteai.ca.\nMe désabonner de ces courriels : ${unsubscribeUrl}`,
    };
  }
  return {
    html: `You are getting this email because you created an account on quoteai.ca.<br/><a href="${url}" style="color:#6b7280">Unsubscribe from these emails</a>`,
    text: `You are getting this email because you created an account on quoteai.ca.\nUnsubscribe from these emails: ${unsubscribeUrl}`,
  };
}

export function buildLifecycleEmail(input: LifecycleEmailInput): LifecycleEmail {
  const c = copyFor(input);
  const fr = input.lang === "fr";
  const who = input.name.trim().split(/\s+/)[0] ?? "";
  const hello = fr ? `Bonjour${who ? ` ${who}` : ""},` : `Hi${who ? ` ${who}` : ""},`;
  const ctaUrl = `${input.baseUrl.replace(/\/$/, "")}${c.ctaPath}`;
  const foot = footerLines(input.lang, input.unsubscribeUrl);
  const paras = c.paragraphs.map((p) => `<p style="margin:0 0 14px">${escapeHtml(p)}</p>`).join("\n");
  const help = fr ? "Des questions? Répondez à ce courriel ou écrivez à" : "Questions? Reply to this email or write to";
  const body = `<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(c.preheader)}</span>
<h1 style="margin:0 0 14px;font-size:21px;font-weight:700;color:#101031">${escapeHtml(c.heading)}</h1>
<p style="margin:0 0 14px">${escapeHtml(hello)}</p>
${paras}
${button(ctaUrl, c.cta)}
<p style="margin:0;font-size:13px;color:#6b7280;text-align:center">${help} <a href="mailto:support@quoteai.ca" style="color:#101031">support@quoteai.ca</a></p>`;
  const html = withLegalFooter(shell(input.lang, c.subject, body, foot.html));
  const text = [hello, "", ...c.paragraphs.flatMap((p) => [p, ""]), `${c.cta}${fr ? " : " : ": "}${ctaUrl}`, "", foot.text].join("\n");
  return { subject: c.subject, preheader: c.preheader, html, text };
}
