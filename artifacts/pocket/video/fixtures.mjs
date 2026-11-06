// The made-up company every video shows. The recorder answers /api from here, so a run needs no server and writes to no database.
// English is an Ontario company (HST); French is a Québec one (TPS and TVQ). All names and addresses are invented.
export const NOW = "2026-11-03T14:30:00-05:00";

const round = (n) => Math.round(n * 100) / 100;

const WORLD = {
  en: {
    company: "Morin Renovations", user: "Alex Morin", province: "ON", phone: "613-555-0142", address: "48 Cedar Lane, Ottawa, ON",
    taxes: [{ code: "HST", label: "HST", rate: 13 }],
    clients: [["Dana Whitfield", "12 Maple Crescent", "Ottawa"], ["Priya Nair", "305 Bank Street", "Ottawa"], ["Tom Kowalski", "77 Elgin Road", "Kanata"]],
    list: [["Dana Whitfield", "Basement finish", 8420.5, "unlocked"], ["Priya Nair", "Kitchen repaint", 3265.0, "accepted"], ["Tom Kowalski", "Deck rebuild", 9870.25, "draft"]],
    text: "Paint the main floor of a 3 bedroom house, walls and ceilings, two coats, patch the small holes first.",
    title: "Main floor repaint", intro: "Interior painting of the main floor: walls and ceilings, two coats.",
    chapters: [["Preparation", [["Patch and sand small holes", "h", 6, 65], ["Mask floors and trim", "h", 4, 55]]], ["Painting", [["Walls, two coats", "m²", 142, 11.5], ["Ceilings, two coats", "m²", 68, 12.75]]], ["Cleanup", [["Final cleanup and touch-ups", "h", 3, 55]]]],
    terms: ["25% deposit to book the dates", "Balance on completion"], note: "Paint included. Colours chosen by the client.",
  },
  fr: {
    company: "Rénovations Morin", user: "Alex Morin", province: "QC", phone: "418-555-0142", address: "48, rue des Cèdres, Québec (QC)",
    taxes: [{ code: "GST", label: "TPS", rate: 5 }, { code: "QST", label: "TVQ", rate: 9.975 }],
    clients: [["Danielle Gagnon", "12, rue des Érables", "Québec"], ["Priya Nair", "305, boul. Laurier", "Québec"], ["Marc Tremblay", "77, chemin Royal", "Lévis"]],
    list: [["Danielle Gagnon", "Finition du sous-sol", 8420.5, "unlocked"], ["Priya Nair", "Peinture de la cuisine", 3265.0, "accepted"], ["Marc Tremblay", "Réfection de la terrasse", 9870.25, "draft"]],
    text: "Peinturer le rez-de-chaussée d’une maison de 3 chambres, murs et plafonds, deux couches, réparer les petits trous avant.",
    title: "Peinture du rez-de-chaussée", intro: "Peinture intérieure du rez-de-chaussée : murs et plafonds, deux couches.",
    chapters: [["Préparation", [["Réparer et poncer les petits trous", "h", 6, 65], ["Protéger planchers et moulures", "h", 4, 55]]], ["Peinture", [["Murs, deux couches", "m²", 142, 11.5], ["Plafonds, deux couches", "m²", 68, 12.75]]], ["Nettoyage", [["Nettoyage final et retouches", "h", 3, 55]]]],
    terms: ["Dépôt de 25 % pour réserver les dates", "Solde à la fin des travaux"], note: "Peinture incluse. Couleurs choisies par le client.",
  },
};

function fullQuote(w, id) {
  const capitoli = w.chapters.map(([titolo, rows], i) => {
    const voci = rows.map(([descrizione, um, quantita, prezzoUnitario]) => ({ descrizione, um, quantita, prezzoUnitario, totale: round(quantita * prezzoUnitario) }));
    return { lettera: String.fromCharCode(65 + i), titolo, voci, subtotale: round(voci.reduce((s, v) => s + v.totale, 0)) };
  });
  const subtotale = round(capitoli.reduce((s, c) => s + c.subtotale, 0));
  const taxLines = w.taxes.map((t) => ({ ...t, amount: round((subtotale * t.rate) / 100) }));
  const ivaValore = round(taxLines.reduce((s, t) => s + t.amount, 0));
  const [nome, indirizzo, city] = w.clients[0];
  return {
    id, userId: "u1", clientData: { nome, indirizzo, city, province: w.province }, descrizioneGenerale: w.intro, items: [], capitoli, condizioniPagamento: w.terms,
    titoloPreventivoRiga1: w.title, numeroPreventivoData: "Q-2026-124", subtotale, ivaPercentuale: w.taxes.reduce((s, t) => s + t.rate, 0), ivaValore, taxLines, totale: round(subtotale + ivaValore),
    note: w.note, status: "draft", rawInput: w.text, capitolatoPro: false, templateId: "standard", attachments: [], variants: [], createdAt: NOW, updatedAt: NOW,
  };
}

/** What the API answers for a call in this language; undefined when there is no fixture. */
export function fixtures(method, path, lang = "en") {
  const w = WORLD[lang];
  if (path === "/api/auth/get-session") return { session: { id: "s1", token: "video-fixture", userId: "u1", expiresAt: "2030-01-01T00:00:00.000Z" }, user: { id: "u1", name: w.user, email: "alex@example.invalid", emailVerified: true, image: null } };
  if (path === "/api/me/job-role") return { included: true, jobRole: "owner", access: "admin", sensitive: { payRates: true, margins: true, approveTime: true, sendInvoices: true }, mayChangeHome: true };
  if (path === "/api/me/preferences") return { preferences: {} };
  if (path === "/api/me/allowance") return { freeQuotes: { paid: true, used: 0, limit: null, left: null, enforced: false } };
  if (path === "/api/business-profile") return { userId: "u1", companyName: w.company, address: w.address, phone: w.phone, email: "alex@example.invalid", logoUrl: null, province: w.province };
  if (path === "/api/clients") return w.clients.map(([clientName, indirizzo, city], i) => ({ id: `c${i + 1}`, clientName, indirizzo, city, province: w.province, quoteCount: 1, unlockedCount: 1, totalValue: 0, unlockedValue: 0, lastQuoteDate: NOW }));
  if (path === "/api/sms/status") return { available: true, fromNumberHint: null, smsEnabled: false, smsReminders: false, scheduleReminders: false, usage: { used: 0, allowance: 0 } };
  if (path === "/api/quotes" && method === "GET") return w.list.map(([nome, title, totale, status], i) => ({ id: `q${i + 1}`, clientData: { nome, indirizzo: "" }, descrizioneGenerale: title, title, numeroPreventivoData: `Q-2026-12${3 - i}`, lineItemCount: 5, subtotale: totale, ivaValore: 0, totale, status, capitolatoPro: false, templateId: "standard", province: w.province, sentAt: status === "draft" ? null : NOW, acceptedAt: status === "accepted" ? NOW : null, createdAt: NOW, updatedAt: NOW }));
  if (path === "/api/quotes" && method === "POST") return fullQuote(w, "q-new");
  const one = /^\/api\/quotes\/([^/]+)$/.exec(path);
  if (one) return fullQuote(w, one[1]);
  return undefined;
}

/** The quote and company the real PDF generator is given (make-pdf.ts). */
export const pdfInput = (lang) => {
  const w = WORLD[lang];
  return { quote: fullQuote(w, "q-new"), profile: { userId: "u1", companyName: w.company, address: w.address, phone: w.phone, email: "alex@example.invalid", province: w.province }, language: lang };
};

/** The text typed into New quote. */
export const typedText = (lang) => WORLD[lang].text;
/** The client picked on New quote. */
export const clientName = (lang) => WORLD[lang].clients[0][0];
