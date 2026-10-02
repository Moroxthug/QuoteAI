// Message templates: the standard wording of the eight messages clients get (follow-ups, reminders, the review request, "on my way"), in English and French, with {slots}
// for the client's name, the quote link and so on. The pure parts: splitting a text into words and slots, filling it with a sample client, adding and removing a slot.
// Source: MessageTemplates.dc.html (the wording is the board's own).
export type Lang = "en" | "fr";
export type VarKey = "first" | "link" | "job" | "amount" | "due" | "inv" | "me" | "co" | "eta" | "review" | "sign";
export type Category = "follow" | "remind" | "review" | "way";
export type Who = "dana" | "hart" | "okoye";
export type Template = { id: string; cat: Category; who: Who; /** 0 email, 1 text, 2 WhatsApp. */ defCh: 0 | 1 | 2; vars: VarKey[]; subj: Record<Lang, string>; en: string; fr: string; icon: string; tone: string };

export const VAR_LABELS: Record<VarKey, Record<Lang, string>> = {
  first: { en: "client first name", fr: "prénom du client" }, link: { en: "quote link", fr: "lien de la soumission" }, job: { en: "job name", fr: "nom du projet" },
  amount: { en: "amount", fr: "montant" }, due: { en: "due date", fr: "échéance" }, inv: { en: "invoice link", fr: "lien de la facture" }, me: { en: "your name", fr: "votre nom" },
  co: { en: "company", fr: "entreprise" }, eta: { en: "arrival time", fr: "heure d’arrivée" }, review: { en: "review link", fr: "lien d’avis" }, sign: { en: "signing link", fr: "lien de signature" },
};

type Sample = Record<VarKey, string>;
export const SAMPLES: Record<Who, { name: string; en: Omit<Sample, "me" | "co">; fr: Omit<Sample, "me" | "co"> }> = {
  dana: {
    name: "Dana Whitfield",
    en: { first: "Dana", link: "quoteai.ca/q/7KD2", job: "bedrooms and bath ceiling", amount: "$4,131.05", due: "Oct 29", inv: "quoteai.ca/i/7KD2", eta: "10:40 am", review: "g.page/rossireno", sign: "quoteai.ca/s/7KD2" },
    fr: { first: "Dana", link: "quoteai.ca/q/7KD2", job: "chambres et plafond de salle de bain", amount: "4 131,05 $", due: "29 oct.", inv: "quoteai.ca/i/7KD2", eta: "10 h 40", review: "g.page/rossireno", sign: "quoteai.ca/s/7KD2" },
  },
  hart: {
    name: "Lena Hart",
    en: { first: "Lena", link: "quoteai.ca/q/H48G", job: "basement finish", amount: "$2,340.00", due: "Sep 20", inv: "quoteai.ca/i/0412", eta: "7:50 am", review: "g.page/rossireno", sign: "quoteai.ca/s/H48G" },
    fr: { first: "Lena", link: "quoteai.ca/q/H48G", job: "finition du sous-sol", amount: "2 340,00 $", due: "20 sept.", inv: "quoteai.ca/i/0412", eta: "7 h 50", review: "g.page/rossireno", sign: "quoteai.ca/s/H48G" },
  },
  okoye: {
    name: "Grace Okoye",
    en: { first: "Grace", link: "", job: "hallway flooring", amount: "", due: "", inv: "", eta: "8:30 am", review: "g.page/rossireno", sign: "" },
    fr: { first: "Grace", link: "", job: "plancher du corridor", amount: "", due: "", inv: "", eta: "8 h 30", review: "g.page/rossireno", sign: "" },
  },
};

export const TEMPLATES: Template[] = [
  { id: "f1", cat: "follow", who: "dana", defCh: 1, vars: ["first", "job", "link", "me", "co"], icon: "chat", tone: "violet",
    subj: { en: "Your quote from {co}", fr: "Votre soumission de {co}" },
    en: "Hi {first}, just checking you got the quote for the {job}: {link} Happy to walk through it on a call. {me}, {co}",
    fr: "Bonjour {first}, avez-vous bien reçu la soumission pour {job}? La voici : {link} Je peux vous l’expliquer au téléphone. {me}, {co}" },
  { id: "f2", cat: "follow", who: "dana", defCh: 1, vars: ["first", "job", "link", "me"], icon: "chat", tone: "violet",
    subj: { en: "Any questions about the {job}?", fr: "Des questions sur {job}?" },
    en: "Hi {first}, the quote for the {job} is still open: {link} If the timing or scope needs a change, reply and I’ll adjust it. {me}",
    fr: "Bonjour {first}, la soumission pour {job} est toujours valide : {link} Si l’échéancier ou les travaux doivent changer, répondez-moi. {me}" },
  { id: "f3", cat: "follow", who: "dana", defCh: 0, vars: ["first", "job", "link", "me", "co"], icon: "chat", tone: "violet",
    subj: { en: "Your quote expires soon", fr: "Votre soumission expire bientôt" },
    en: "Hi {first}, a last note on the {job} quote. It expires soon and our fall schedule is filling up. {link} {me}, {co}",
    fr: "Bonjour {first}, un dernier mot sur la soumission pour {job}. Elle expire bientôt et notre horaire d’automne se remplit. {link} {me}, {co}" },
  { id: "r1", cat: "remind", who: "hart", defCh: 0, vars: ["first", "amount", "job", "due", "inv", "co"], icon: "bell", tone: "amber",
    subj: { en: "Invoice for the {job}, due {due}", fr: "Facture pour {job}, due le {due}" },
    en: "Hi {first}, a reminder that {amount} for the {job} is due {due}. Pay by card or e-Transfer here: {inv} Thanks, {co}",
    fr: "Bonjour {first}, un rappel : {amount} pour {job} est dû le {due}. Payez par carte ou virement Interac ici : {inv} Merci, {co}" },
  { id: "r2", cat: "remind", who: "hart", defCh: 1, vars: ["first", "job", "amount", "due", "inv", "co"], icon: "bell", tone: "rose",
    subj: { en: "Your invoice is past due", fr: "Votre facture est en retard" },
    en: "Hi {first}, the invoice for the {job} ({amount}) was due {due}. You can pay here: {inv} If it’s already sent, thank you. {co}",
    fr: "Bonjour {first}, la facture pour {job} ({amount}) était due le {due}. Vous pouvez payer ici : {inv} Si c’est déjà fait, merci. {co}" },
  { id: "r3", cat: "remind", who: "hart", defCh: 0, vars: ["first", "job", "sign", "me"], icon: "pen", tone: "indigo",
    subj: { en: "Your contract is ready to sign", fr: "Votre contrat est prêt à signer" },
    en: "Hi {first}, the contract for the {job} is ready to sign: {sign} It takes about a minute. {me}",
    fr: "Bonjour {first}, le contrat pour {job} est prêt à signer : {sign} Ça prend environ une minute. {me}" },
  { id: "rv", cat: "review", who: "okoye", defCh: 1, vars: ["first", "job", "review", "me", "co"], icon: "star", tone: "gold",
    subj: { en: "How did we do?", fr: "Comment avons-nous fait?" },
    en: "Hi {first}, thanks for having us for the {job}. If you’re happy with the work, a short review helps a small crew like ours: {review} {me}, {co}",
    fr: "Bonjour {first}, merci de nous avoir confié {job}. Si vous êtes satisfaite, un court avis aide beaucoup une petite équipe comme la nôtre : {review} {me}, {co}" },
  { id: "ow", cat: "way", who: "okoye", defCh: 1, vars: ["first", "me", "co", "eta"], icon: "truck", tone: "teal",
    subj: { en: "{co} is on the way", fr: "{co} est en route" },
    en: "Hi {first}, {me} from {co} is on the way. Arriving around {eta}.",
    fr: "Bonjour {first}, {me} de {co} est en route. Arrivée vers {eta}." },
];

export const CATEGORIES: ("all" | Category)[] = ["all", "follow", "remind", "review", "way"];
export const inCategory = (t: Template, c: "all" | Category): boolean => c === "all" || t.cat === c;

export type Part = { text: string } | { slot: string; n: number };

/** A text split into words and {slots}; `n` counts the slots in order, so one can be removed. */
export function parts(s: string): Part[] {
  const out: Part[] = [];
  const re = /\{(\w+)\}/g;
  let m: RegExpExecArray | null;
  let last = 0;
  let n = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ slot: m[1]!, n: n++ });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** The text with a sample client's words in the slots, on one line (an empty value leaves its slot empty). */
export function fill(s: string, sample: Partial<Record<string, string>>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => sample[k] ?? "").replace(/\s+/g, " ").trim();
}

/** Takes the n-th slot out, with the space before it. */
export function removeSlot(s: string, n: number): string {
  let c = 0;
  return s.replace(/\s?\{(\w+)\}/g, (all) => (c++ === n ? "" : all));
}

export const addSlot = (s: string, key: string): string => `${s.replace(/\s+$/, "")} {${key}}`;
export const wordCount = (s: string): number => (s ? s.split(" ").filter(Boolean).length : 0);
/** Texts the carrier counts: 160 characters each. */
export const segmentsOf = (s: string): number => Math.max(1, Math.ceil(s.length / 160));

/** The stored key of a template's text in a language, and of its "send automatically" switch. */
export const textKey = (id: string, lang: Lang): string => `${id}_${lang}`;
export const autoKey = (id: string): string => `auto_${id}`;

/** Is it different from our standard wording in either language (as saved)? */
export function isEdited(t: Template, saved: Record<string, unknown>): boolean {
  return (["en", "fr"] as const).some((l) => typeof saved[textKey(t.id, l)] === "string" && saved[textKey(t.id, l)] !== t[l]);
}
