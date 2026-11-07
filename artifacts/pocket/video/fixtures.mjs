// The made-up company every video shows. The recorder answers /api from here, so a run needs no server and writes to no database.
// English is an Ontario company (HST); French is a Québec one (TPS and TVQ). All names and addresses are invented.
import { NOW } from "./clock.mjs";
import * as more from "./world.mjs";

export { NOW };

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

function fullQuote(w, id, status = "draft") {
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
    note: w.note, status, rawInput: w.text, capitolatoPro: false, templateId: "standard", attachments: [], variants: [], createdAt: NOW, updatedAt: NOW,
  };
}

/** What the API answers for a call in this language; undefined when there is no fixture. */
export function fixtures(method, path, lang = "en", state = {}) {
  const w = WORLD[lang];
  if (path === "/api/auth/get-session") return { session: { id: "s1", token: "video-fixture", userId: "u1", expiresAt: "2030-01-01T00:00:00.000Z" }, user: { id: "u1", name: w.user, email: "alex@example.invalid", emailVerified: true, image: null } };
  if (path === "/api/me/job-role") return { included: true, jobRole: "owner", access: "admin", sensitive: { payRates: true, margins: true, approveTime: true, sendInvoices: true }, mayChangeHome: true };
  if (path === "/api/me/preferences") return { preferences: {} };
  if (path === "/api/me/allowance") return { freeQuotes: { paid: true, used: 0, limit: null, left: null, enforced: false } };
  if (path === "/api/business-profile") return { userId: "u1", companyName: w.company, address: w.address, phone: w.phone, email: "alex@example.invalid", logoUrl: null, province: w.province, automationSettings: { invoiceReminders: true, smsReminders: false } };
  if (path === "/api/clients") return w.clients.map(([clientName, indirizzo, city], i) => ({ id: `c${i + 1}`, clientName, indirizzo, city, province: w.province, quoteCount: 1, unlockedCount: 1, totalValue: 0, unlockedValue: 0, lastQuoteDate: NOW }));
  if (path === "/api/sms/status") return { available: true, fromNumberHint: null, smsEnabled: false, smsReminders: false, scheduleReminders: false, usage: { used: 0, allowance: 0 } };
  if (path === "/api/quotes" && method === "GET") return w.list.map(([nome, title, totale, status], i) => ({ id: `q${i + 1}`, clientData: { nome, indirizzo: "" }, descrizioneGenerale: title, title, numeroPreventivoData: `Q-2026-12${3 - i}`, lineItemCount: 5, subtotale: totale, ivaValore: 0, totale, status, capitolatoPro: false, templateId: "standard", province: w.province, sentAt: status === "draft" ? null : NOW, acceptedAt: status === "accepted" ? NOW : null, createdAt: NOW, updatedAt: NOW }));
  if (path === "/api/quotes" && method === "POST") return fullQuote(w, "q-new");
  const one = /^\/api\/quotes\/([^/]+)$/.exec(path);
  if (one) return { ...fullQuote(w, one[1], state.quoteStatus ?? "draft"), jobId: state.job ? "j1" : null };
  return later(method, path, lang, w, state);
}

function later(method, path, lang, w, state) {
  const total = fullQuote(w, "q-new").totale;
  const job = () => more.jobDetail(lang, w, total, state);
  // Today
  if (path === "/api/today/needs-you") return more.needsYou(lang, w, state);
  if (path === "/api/today/business") return more.today.business();
  if (path === "/api/today/checklist") return more.today.checklist();
  if (path === "/api/v1/weather/today") return more.today.weather(lang);
  if (path === "/api/notifications") return { items: [], unread: 0 };
  // Jobs
  if (path === "/api/jobs" && method === "GET") return more.jobsList(lang, w, total, state);
  if (path === "/api/jobs" && method === "POST") return { job: { id: "j1", setupStatus: "pending_review" }, created: true };
  if (/^\/api\/jobs\/j\d\/setup\/confirm$/.test(path)) { state.job = "started"; return job(); }
  if (/^\/api\/jobs\/j\d(\/setup)?$/.test(path)) return job();
  if (path.endsWith("/field-reports")) return { reports: [] };
  if (path.endsWith("/permits")) return { permits: [], province: w.province };
  if (path.endsWith("/notes")) return { notes: [] };
  if (path.endsWith("/photos")) return { photos: [] };
  if (path === "/api/schedule") return more.schedule(lang, state);
  if (path === "/api/crew/today") return more.crewToday(lang);
  // Crew
  if (path === "/api/team/workers") return more.workers(lang);
  if (path === "/api/team/time-entries" && method === "GET") return more.timeEntries(lang, state);
  if (path === "/api/team/time-entries/approve") { state.approved = true; return { approved: 3 }; }
  if (path === "/api/team/equipment") return { items: [] };
  if (path === "/api/team/members") return { items: [], seats: { used: 1, limit: 5 } };
  if (/^\/api\/team\/workers\/[^/]+\/pairing-code$/.test(path)) return { code: "K7M2PX", expiresAt: "2026-11-10T14:30:00-05:00" };
  if (path === "/api/crew/pair" && method === "POST") return { token: "video-crew", workerName: more.workers(lang).items[0].name, companyName: w.company };
  if (path.startsWith("/api/crew/pair/")) return { workerName: more.workers(lang).items[0].name, companyName: w.company };
  if (path.endsWith("/clock-in")) { state.clocked = state.clockAt ?? NOW; return { entry: more.crewView(lang, w, state).activeEntry }; }
  const task = /^\/api\/t\/[^/]+\/tasks\/(.+)$/.exec(path);
  if (task) { state.tasksDone = (state.tasksDone ?? 0) + 1; return { task: { id: task[1], status: "done" } }; }
  if (/^\/api\/t\/[^/]+$/.test(path)) return more.crewView(lang, w, state);
  // Invoices
  if (path === "/api/invoices") return more.invoices(lang, w, state);
  if (path.endsWith("/confirm-etransfer")) { state.paid = true; return {}; }
  if (/^\/api\/invoices\/[^/]+$/.test(path)) return more.invoiceDetail(lang, w, state);
  // Connected apps
  if (path === "/api/team/orgs") return { items: [{ orgId: "o1", companyName: w.company, role: "owner", isOwn: true }], activeOrgId: "o1" };
  if (path === "/api/plan/overview") return { plan: "monthly_business", features: ["quickbooks_sync", "wave_sync", "invoice_card_payments", "calendar_sync"] };
  if (path === "/api/quickbooks/status") return more.quickbooks(lang, state);
  if (path === "/api/quickbooks/sync-log") return more.syncLog();
  if (path === "/api/quickbooks/accounts") return more.accounts(lang);
  if (["/api/wave/status", "/api/invoice-payments/connect/status", "/api/whatsapp/status", "/api/google-lsa/status"].includes(path)) return { connected: false, available: true };
  if (path === "/api/calendar/status") return { available: { google: true, outlook: true }, connections: [] };
  return undefined;
}

/** The quote and company the real PDF generator is given (make-pdf.ts). */
export const pdfInput = (lang) => {
  const w = WORLD[lang];
  return { quote: fullQuote(w, "q-new"), profile: { userId: "u1", companyName: w.company, address: w.address, phone: w.phone, email: "alex@example.invalid", province: w.province }, language: lang };
};

/** The text typed into New quote. */
export const typedText = (lang) => WORLD[lang].text;
/** The street on that client's row. */
export const clientStreet = (lang) => WORLD[lang].clients[0][1];
/** The client picked on New quote. */
export const clientName = (lang) => WORLD[lang].clients[0][0];
