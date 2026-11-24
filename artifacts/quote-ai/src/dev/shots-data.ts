// Sample data for src/dev/shots-mock.ts, in the language the app is shown in
// (English: an Ottawa contractor, HST; French: a Gatineau contractor, TPS/TVQ).
// Every name, address and amount is invented.
import ALL_FIXTURES from "./shots-fixtures.json";

const FR = (() => { try { return localStorage.getItem("quoteai-lang") === "fr"; } catch { return false; } })();
const L = (en: string, fr: string) => (FR ? fr : en);
const FIXTURES = FR ? ALL_FIXTURES.fr : ALL_FIXTURES.en;
const PROV = FR ? "QC" : "ON";

const at = (d: string) => new Date(`2026-${d}T15:00:00Z`).toISOString();
const now = at("11-20");
/** Date-only fields (job dates, receipts) are YYYY-MM-DD in the API. */
const ymd = (d: string) => `2026-${d}`;
const OWNER = "u_shots";
const user = { id: OWNER, email: "owner@example.invalid", name: L("Alex Martin", "Alexandre Martin"), emailVerified: true, createdAt: at("03-02"), updatedAt: now, twoFactorEnabled: false };
const company = FR
  ? { companyName: "Construction Boréal inc.", address: "155, boul. Saint-Joseph, Gatineau QC J8Y 3W9", phone: "819-555-0142", email: "bureau@example.invalid" }
  : { companyName: "Northline Renovations Ltd.", address: "220 Bank St, Ottawa ON K2P 1X4", phone: "613-555-0142", email: "office@example.invalid" };
const city = L("Ottawa", "Gatineau");

const r2 = (n: number) => Math.round(n * 100) / 100;
type Line = [string, number, string, number];
function lines(rows: Line[]) {
  return rows.map(([descrizione, quantita, unita, prezzoUnitario]) => ({ descrizione, quantita, unita, prezzoUnitario, totale: r2(quantita * prezzoUnitario) }));
}
function totals(items: { totale: number }[], province: string) {
  const subtotale = r2(items.reduce((s, i) => s + i.totale, 0));
  const taxLines = province === "QC"
    ? [{ code: "GST", label: L("GST", "TPS"), rate: 5, amount: r2(subtotale * 0.05) }, { code: "QST", label: L("QST", "TVQ"), rate: 9.975, amount: r2(subtotale * 0.09975) }]
    : [{ code: "HST", label: "HST", rate: 13, amount: r2(subtotale * 0.13) }];
  const ivaValore = r2(taxLines.reduce((s, t) => s + t.amount, 0));
  return { subtotale, ivaPercentuale: taxLines.reduce((s, t) => s + t.rate, 0), ivaValore, taxLines, totale: r2(subtotale + ivaValore) };
}

const bathItems = lines([
  [L("Demolition of existing tub surround, vanity and flooring, disposal included", "Démolition du bain-douche, de la vanité et du plancher existants, disposition incluse"), 1, L("lot", "forfait"), 1450],
  [L("Shower pan, curb and waterproofing membrane (walls and floor)", "Base de douche, seuil et membrane d'étanchéité (murs et plancher)"), 1, L("lot", "forfait"), 1980],
  [L("Porcelain wall tile, 12 x 24, supply and install", "Céramique murale en porcelaine 12 x 24, fournie et posée"), 96, L("sq ft", "pi²"), 24.5],
  [L("Floor tile with electric in-floor heat mat and thermostat", "Céramique de plancher avec plancher chauffant électrique et thermostat"), 42, L("sq ft", "pi²"), 38],
  [L("Plumbing: thermostatic shower valve, rough-in and trim", "Plomberie : robinet thermostatique de douche, brut et finition"), 1, L("lot", "forfait"), 1650],
  [L("36 in. vanity with quartz top, supply and install", "Vanité 36 po avec comptoir de quartz, fournie et posée"), 1, L("each", "unité"), 1890],
  [L("Exhaust fan, 80 CFM, ducted to exterior", "Ventilateur d'extraction 80 pi³/min, évacué à l'extérieur"), 1, L("each", "unité"), 485],
  [L("Paint walls and ceiling, two coats", "Peinture des murs et du plafond, deux couches"), 1, L("lot", "forfait"), 720],
]);

const quotes = [
  { id: "q_bath", client: L("Priya Raman", "Isabelle Lavoie"), title: L("Main bathroom renovation", "Rénovation de la salle de bain principale"), items: bathItems, status: "unlocked", sentAt: at("11-18"), firstViewedAt: at("11-19"), number: "Q-2026-118" },
  { id: "q_deck", client: L("Daniel Okafor", "Mathieu Bélanger"), title: L("Cedar deck, 14 x 16", "Terrasse en cèdre 14 x 16"), items: lines([["Deck", 1, "lot", 11840]]), status: "accepted", sentAt: at("11-06"), number: "Q-2026-114", acceptedAt: at("11-09") },
  { id: "q_base", client: L("Sophie Gagnon", "Sophie Gagnon"), title: L("Basement finishing", "Finition du sous-sol"), items: lines([["Basement", 1, "lot", 32600]]), status: "unlocked", sentAt: at("11-12"), number: "Q-2026-116" },
  { id: "q_kit", client: L("Mark Chen", "Marc Tremblay"), title: L("Kitchen backsplash and lighting", "Dosseret et éclairage de cuisine"), items: lines([["Kitchen", 1, "lot", 4380]]), status: "draft", number: "Q-2026-119" },
  { id: "q_roof", client: L("Laura Bennett", "Julie Bergeron"), title: L("Garage roof reshingle", "Réfection de la toiture du garage"), items: lines([["Roof", 1, "lot", 6920]]), status: "unlocked", sentAt: at("11-03"), number: "Q-2026-112", declinedAt: at("11-10") },
];

function quoteSummary(q: (typeof quotes)[number]) {
  const t = totals(q.items, PROV);
  return {
    id: q.id, clientId: `c_${q.id}`, province: PROV,
    clientData: { nome: q.client, indirizzo: L("412 Fifth Ave", "27, rue Laurier"), city, province: PROV, email: "client@example.invalid" },
    descrizioneGenerale: q.title, title: q.title, lineItemCount: q.items.length,
    subtotale: t.subtotale, ivaValore: t.ivaValore, totale: t.totale, status: q.status,
    acceptedAt: q.acceptedAt ?? null, sentAt: q.sentAt ?? null, validDays: 30, firstViewedAt: q.firstViewedAt ?? null,
    declinedAt: q.declinedAt ?? null, declinedReason: null, numeroPreventivoData: q.number, pdfUrl: null,
    capitolatoPro: false, templateId: "standard", createdAt: q.sentAt ?? now, updatedAt: now, archivedAt: null,
  };
}

function quoteFull(id: string) {
  const q = quotes.find((x) => x.id === id) ?? quotes[0]!;
  const t = totals(q.items, PROV);
  return {
    ...quoteSummary(q), userId: OWNER, items: q.items, capitoli: [], sconto: null,
    condizioniPagamento: FR
      ? ["Acompte de 30 % à l'acceptation", "40 % à la pose de la céramique", "Solde à la fin des travaux"]
      : ["30% deposit on acceptance", "40% when tile is set", "Balance on completion"],
    titoloPreventivoRiga1: q.title, titoloPreventivoRiga2: null,
    companySnapshot: { ...company, vatNumber: FR ? "TPS 123456789 RT0001 · TVQ 1234567890 TQ0001 · RBQ 5678-1234-01" : "123456789 RT0001" },
    ...t, documentLanguage: FR ? "fr" : "en",
    note: L("Price includes materials listed. Permit, if required by the City, billed at cost. Valid 30 days.", "Le prix comprend les matériaux énumérés. Le permis, s'il est exigé par la Ville, est facturé au coût. Valide 30 jours."),
    acceptedByName: null, jobId: null, rawInput: "", pdfDownloadedAt: null, capitolatoPdfUrl: null, attachments: [], acceptedVariantId: null, variants: [],
  };
}

type LeadSeed = [name: [string, string], source: string, status: string, channel: string, created: string, next: string | null, notes: [string, string], lang: "en" | "fr"];
const LEAD_SEEDS: LeadSeed[] = [
  [["Hannah Kowalski", "Chloé Pelletier"], "widget", "new", "email", "11-23", "11-25", ["Wants a quote for a basement bathroom. Prefers weekday visits.", "Veut une soumission pour une salle de bain au sous-sol. Préfère les visites en semaine."], FR ? "fr" : "en"],
  [["Jean-François Roy", "Jean-François Roy"], "meta_lead_ads", "new", "sms", "11-22", "11-25", ["Kitchen refresh, cabinets and counters.", "Rafraîchissement de cuisine, armoires et comptoirs."], "fr"],
  [["Omar Haddad", "Omar Haddad"], "widget", "contacted", "whatsapp", "11-19", "11-26", ["Site visit booked for Saturday morning.", "Visite du chantier prévue samedi matin."], FR ? "fr" : "en"],
  [["Grace Thompson", "Geneviève Côté"], "manual", "quoted", "email", "11-17", "11-26", ["Quote Q-2026-117 sent, follow-up 2 of 3 due.", "Soumission Q-2026-117 envoyée, relance 2 de 3 à venir."], FR ? "fr" : "en"],
  [["Mark Chen", "Marc Tremblay"], "import", "quoted", "email", "11-14", "11-27", ["Backsplash and lighting quote in draft.", "Soumission dosseret et éclairage en brouillon."], FR ? "fr" : "en"],
  [["Daniel Okafor", "Mathieu Bélanger"], "widget", "won", "email", "11-02", null, ["Deck contract signed November 9.", "Contrat de la terrasse signé le 9 novembre."], FR ? "fr" : "en"],
  [["Laura Bennett", "Julie Bergeron"], "manual", "lost", "sms", "10-28", null, ["Went with a lower bid on the garage roof.", "A retenu une soumission plus basse pour la toiture du garage."], FR ? "fr" : "en"],
];
const leads = LEAD_SEEDS.map(([names, source, status, preferredChannel, created, next, notes, lang], i) => {
  const name = L(...names);
  return {
    id: `l_${i}`, userId: OWNER, clientId: null, quoteId: null, name,
    email: `${name.split(" ")[0]!.toLowerCase().normalize("NFD").replace(/[^a-z-]/g, "")}@example.invalid`, phone: L("613", "819") + "-555-01" + String(10 + i),
    preferredLanguage: lang, preferredChannel, source, status,
    consentSource: source === "widget" ? "widget_form" : source === "import" ? "import" : source === "meta_lead_ads" ? "meta_lead_ads" : "manual_entry",
    consentAt: at(created), unsubscribeToken: `u${i}`, unsubscribedAt: null,
    followUpStage: status === "quoted" ? 2 : status === "contacted" ? 1 : 0, nextFollowUpAt: next ? at(next) : null,
    lastContactedAt: status === "new" ? null : at(created), notes: L(...notes),
    metaLeadId: null, metaFormId: null, metaFormName: source === "meta_lead_ads" ? L("Kitchen estimate form", "Formulaire soumission cuisine") : null, metaCampaignId: null, metaCampaignName: null, metaAdId: null,
    googleLsaLeadId: null, googleLsaLeadType: null, googleLsaCategory: null, createdAt: at(created), updatedAt: at(created),
  };
});

// ── The deck job: budget vs actual, receipts, crew hours, one change order ──
const cents = (n: number) => Math.round(n * 100);
const contractTotal = FIXTURES.contract.contract.variables.total;
const ms = (key: string, title: string, i: number, status: string, value: number, start: string, end: string, term: string | null) => ({
  id: `m_${key}`, key, title, description: "", sortOrder: i, plannedStart: ymd(start), plannedEnd: ymd(end),
  actualStart: status === "planned" ? null : ymd(start), actualEnd: status === "completed" ? ymd(end) : null, status,
  paymentTermId: term, paymentTermLabel: term === "t2" ? L("40% when framing is complete", "40 % à la fin de la charpente") : term === "t3" ? L("40% on completion", "40 % à la fin des travaux") : null,
  paymentAmountCents: term ? cents(contractTotal * 0.4) : null, sourceChapter: null, valueCents: cents(value), tasks: [],
});
type CostSeed = [category: string, vendor: [string, string], description: [string, string], date: string, subtotal: number, source: string, status?: string];
const COST_SEEDS: CostSeed[] = [
  ["materials", ["Kent Building Supplies", "BMR Gatineau"], ["Pressure-treated 2x8, posts, joist hangers", "2x8 traité, poteaux, étriers de solives"], "11-12", 2186.4, "receipt"],
  ["materials", ["Ottawa Cedar Centre", "Cèdres de l'Outaouais"], ["5/4 x 6 western red cedar decking, 640 lin ft", "Planches de cèdre rouge 5/4 x 6, 640 pi lin."], "11-17", 3104.0, "receipt"],
  ["materials", ["Home Depot", "Home Depot"], ["Concrete, Sonotubes, ledger flashing", "Béton, Sonotubes, solin de lambourde"], "11-11", 412.75, "receipt"],
  ["permits_fees", ["City of Ottawa", "Ville de Gatineau"], ["Building permit, deck", "Permis de construction, terrasse"], "11-10", 238.0, "manual"],
  ["labour", ["Crew time", "Heures de l'équipe"], ["Footings and framing, 3 days (approved hours)", "Fondations et charpente, 3 jours (heures approuvées)"], "11-14", 2268.0, "time_entry"],
  ["equipment", ["Sunbelt Rentals", "Location Sauvageau"], ["Auger rental, 1 day", "Location de tarière, 1 jour"], "11-11", 145.0, "receipt"],
  ["materials", ["Home Depot", "Home Depot"], ["Hidden fasteners, stair stringers", "Attaches invisibles, limons d'escalier"], "11-19", 386.2, "receipt", "pending_review"],
];
const costEntries = COST_SEEDS.map(([category, vendor, description, date, subtotal, source, status], i) => {
  const taxable = category !== "labour";
  const gst = taxable ? r2(subtotal * 0.05) : 0;
  const second = taxable ? r2(subtotal * (FR ? 0.09975 : 0.08)) : 0;
  const tax = r2(gst + second);
  return {
    id: `ce_${i}`, projectId: "j_deck", projectName: quotes[1]!.title, milestoneId: null, milestoneTitle: null, category, vendor: L(...vendor), description: L(...description),
    date: ymd(date), subtotalCents: cents(subtotal), taxCents: cents(tax),
    taxBreakdown: !taxable ? {} : FR ? { GST: cents(gst), QST: cents(second) } : { HST: cents(tax) }, totalCents: cents(subtotal + tax),
    status: status ?? "confirmed", source, createdBy: source === "receipt" ? "ai" : "user", sourceDocumentId: null, timeEntryId: null, equipmentUsageId: null,
    aiExtraction: null, confirmedAt: status ? null : at(date), createdAt: at(date),
  };
});
const confirmed = costEntries.filter((c) => c.status === "confirmed");
const byCategory = { materials: 0, labour: 0, subcontractor: 0, permits_fees: 0, equipment: 0, misc: 0 } as Record<string, number>;
for (const c of confirmed) byCategory[c.category]! += c.subtotalCents;
const fixtureContract = FIXTURES.contract.contract;
const inv = FIXTURES.invoice.invoice;
const deckClient = quotes[1]!.client;
const jobDetail = {
  job: {
    id: "j_deck", name: quotes[1]!.title, description: L("Ground-level cedar deck with railing and stairs", "Terrasse en cèdre au niveau du sol avec garde-corps et escalier"), status: "active", setupStatus: "confirmed",
    quoteId: "q_deck", clientId: "c_q_deck", contractId: "ct_deck", address: fixtureContract.variables.siteAddress, province: PROV, latitude: null, longitude: null, geofenceRadiusMeters: null,
    contractValueCents: cents(11_840), changeOrdersCents: cents(640), totalValueCents: cents(12_480), plannedStart: ymd("11-10"), plannedEnd: ymd("11-28"),
    progressPercent: 55, completedAt: null, createdAt: at("11-09"), updatedAt: now, archivedAt: null,
    setupProposal: null, setupConfirmedAt: at("11-09"),
    client: { id: "c_q_deck", name: deckClient, email: "client@example.invalid", phone: L("613", "819") + "-555-0188" },
    contract: { id: "ct_deck", contractNumber: fixtureContract.contractNumber, status: "signed", signedAt: fixtureContract.signedAt, hasSignedPdf: true, language: FR ? "fr" : "en", paymentSchedule: fixtureContract.variables.paymentSchedule, total: contractTotal, subtotal: 11_840, customerName: deckClient },
    quote: { id: "q_deck", number: "Q-2026-114", status: "accepted" },
  },
  milestones: [
    ms("footings", L("Footings and permit", "Fondations et permis"), 0, "completed", 1_980, "11-10", "11-12", null),
    ms("framing", L("Framing and ledger", "Charpente et lambourde"), 1, "completed", 3_000, "11-13", "11-17", "t2"),
    ms("decking", L("Decking and fasteners", "Planchers et attaches"), 2, "in_progress", 4_160, "11-18", "11-24", null),
    ms("railing", L("Railing, stairs and walkthrough", "Garde-corps, escalier et visite finale"), 3, "planned", 2_700, "11-25", "11-28", "t3"),
  ],
  unassignedTasks: [],
  budget: [
    { id: "b1", category: "materials", chapterRef: null, label: L("Materials", "Matériaux"), plannedCents: cents(6_400), sortOrder: 0 },
    { id: "b2", category: "labour", chapterRef: null, label: L("Labour", "Main-d'œuvre"), plannedCents: cents(3_600), sortOrder: 1 },
    { id: "b3", category: "permits_fees", chapterRef: null, label: L("Permit", "Permis"), plannedCents: cents(250), sortOrder: 2 },
    { id: "b4", category: "equipment", chapterRef: null, label: L("Equipment", "Équipement"), plannedCents: cents(200), sortOrder: 3 },
  ],
  budgetTotalCents: cents(10_450),
  changeOrders: [{
    id: "co1", number: "CO-1", title: L("Add privacy screen on the east side", "Ajout d'un écran d'intimité côté est"), description: "",
    items: [{ descrizione: L("Cedar privacy screen, 8 ft", "Écran d'intimité en cèdre, 8 pi"), um: L("lot", "forfait"), quantita: 1, prezzoUnitario: 640, totale: 640 }],
    subtotalCents: cents(640), taxCents: cents(FR ? 95.84 : 83.2), totalCents: cents(FR ? 735.84 : 723.2), scheduleDeltaDays: 1, status: "signed", documentContractId: null, signedAt: at("11-18"), appliedAt: at("11-18"), createdAt: at("11-17"),
  }],
  costs: { totalCents: confirmed.reduce((s, c) => s + c.subtotalCents, 0), pendingCents: costEntries.filter((c) => c.status !== "confirmed").reduce((s, c) => s + c.subtotalCents, 0), pendingCount: 1, byCategory, entries: costEntries },
  timeEntries: [],
  equipmentUsage: [],
  assignments: [
    { id: "a1", collaboratorId: "w1", roleInProject: L("Lead carpenter", "Charpentier principal"), collaboratorName: "Sam Tremblay", collaboratorRole: L("Carpenter", "Charpentier-menuisier"), collaboratorHourlyRate: 42, workerType: "employee", active: true },
    { id: "a2", collaboratorId: "w2", roleInProject: L("Helper", "Aide"), collaboratorName: L("Noah Fraser", "Noah Fournier"), collaboratorRole: L("Labourer", "Manœuvre"), collaboratorHourlyRate: 28, workerType: "employee", active: true },
  ],
  invoices: [inv],
  invoiceTotals: { invoicedCents: cents(2_675.84) + inv.totalCents, collectedCents: cents(2_675.84), outstandingCents: inv.totalCents, overdueCents: 0, draftCount: 0 },
};

const jobAnalytics = (() => {
  const budgetCents = jobDetail.budgetTotalCents;
  const costCents = jobDetail.costs.totalCents;
  const categories = jobDetail.budget.map((b) => {
    const actualCents = byCategory[b.category] ?? 0;
    const pendingCents = costEntries.filter((c) => c.status !== "confirmed" && c.category === b.category).reduce((s, c) => s + c.subtotalCents, 0);
    return { category: b.category, plannedCents: b.plannedCents, actualCents, pendingCents, varianceCents: b.plannedCents - actualCents, usedPercent: Math.round((actualCents / b.plannedCents) * 100) };
  });
  const weeks = ["2026-11-09", "2026-11-16", "2026-11-23"];
  const subtotalCents = jobDetail.job.totalValueCents;
  return {
    subtotalCents, budgetCents, costCents, pendingCostCents: jobDetail.costs.pendingCents, categories,
    curve: weeks.map((week, i) => ({ week, actualCents: [cents(2_999.15), costCents, costCents][i]!, plannedCents: [cents(3_100), cents(7_300), budgetCents][i]!, invoicedCents: [cents(2_368), cents(7_104), cents(7_104)][i]!, collectedCents: [cents(2_368), cents(2_368), cents(2_368)][i]! })),
    schedule: { rows: jobDetail.milestones.map((m) => ({ id: m.id, title: m.title, status: m.status, plannedDays: 3, slipDays: 0, state: m.status === "completed" ? "done_on_time" : m.status === "in_progress" ? "on_track" : "pending" })), daysBehind: 0, lateCount: 0, plannedEnd: ymd("11-28"), forecastEnd: ymd("11-28") },
    earned: { earnedCents: Math.round(subtotalCents * 0.55), invoicedSubtotalCents: cents(7_104), billingGapCents: Math.round(subtotalCents * 0.55) - cents(7_104), budgetEarnedCents: Math.round(budgetCents * 0.55), costCents, costPerformance: 0.98, projectedFinalCostCents: cents(10_660), projectedMarginPercent: 14.6 },
    invoices: { invoicedCents: jobDetail.invoiceTotals.invoicedCents, collectedCents: jobDetail.invoiceTotals.collectedCents, outstandingCents: jobDetail.invoiceTotals.outstandingCents, overdueCents: 0, draftCount: 0, upcomingCents: cents(contractTotal * 0.4) },
  };
})();

export const SHOTS_ROUTES: Array<[RegExp, (url: URL, init?: RequestInit) => unknown]> = [
  [/^GET \/api\/auth\/get-session$/, () => ({ session: { id: "s_shots", userId: OWNER, expiresAt: "2027-01-01T00:00:00Z", token: "t" }, user })],
  [/^GET \/api\/business-profile$/, () => ({ userId: OWNER, ...company, vatNumber: "123456789 RT0001", logoUrl: null, province: PROV })],
  [/^GET \/api\/notifications$/, () => ({ items: [], unread: 0 })],
  [/^GET \/api\/team\/orgs$/, () => ({ items: [{ orgId: OWNER, companyName: company.companyName, role: "owner", isOwn: true }], activeOrgId: OWNER, group: null })],
  [/^GET \/api\/payments\/subscription$/, () => ({ plan: "monthly_business", status: "active", interval: "month", annualAvailable: true, periodEnd: "2026-12-20T00:00:00Z", provider: "stripe", isActive: true, quotaUsed: 4, quotaLimit: null, quotaRemaining: null, quotaResetDate: null, coveredBy: null })],
  [/^GET \/api\/me$/, () => ({ person: { id: OWNER, name: user.name, email: user.email, image: null, memberSince: at("03-02"), phone: null, jobTitle: L("Owner", "Propriétaire"), bio: null, setupDone: true }, companies: [{ orgId: OWNER, companyName: company.companyName, role: "owner", joinedAt: at("03-02"), isOwn: true }], current: { orgId: OWNER, role: "owner" } })],
  [/^GET \/api\/quotes$/, () => quotes.map(quoteSummary)],
  [/^GET \/api\/quotes\/[^/]+\/variants$/, () => []],
  [/^GET \/api\/quotes\/[^/]+$/, (url) => quoteFull(url.pathname.split("/").pop()!)],
  // Invoice and contract: rendered by the API's own renderers (api-server src/e2e/shots-fixtures.ts).
  [/^GET \/api\/invoices\/[^/]+$/, () => FIXTURES.invoice],
  [/^GET \/api\/contracts\/[^/]+$/, () => FIXTURES.contract],
  [/^GET \/api\/leads$/, () => ({ items: leads })],
  [/^GET \/api\/jobs\/[^/]+\/analytics$/, () => jobAnalytics],
  [/^GET \/api\/jobs\/[^/]+$/, () => jobDetail],
  [/^GET \/api\/jobs$/, () => ({ items: [] })],
  // Empty answers for what the shell and side panels ask for.
  [/^GET \/api\/(changes|catalog|tax-profiles|payments\/plans|clients|invoices|contracts)$/, () => []],
  [/^GET \/api\/schedule$/, () => ({ items: [] })],
  [/^GET \/api\/payments\/trial-status$/, () => ({ eligible: false, active: false })],
];
