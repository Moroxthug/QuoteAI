// The rest of the made-up company: its job, crew, invoices and books, for every video after "Your first quote". `state` is what the video has done so far (started the job, clocked in,
// confirmed the payment), so a screen reads as it would after the real tap. Nothing here reaches a server or a database.
import { NOW } from "./clock.mjs";

const D = "2026-11-03";
const at = (day, h, m = 0) => new Date(`${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-05:00`).toISOString();
const cents = (n) => Math.round(n * 100);
const DAYS = ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];

const T = {
  en: {
    jobName: "Main floor repaint", desc: "Interior painting of the main floor: walls and ceilings, two coats.", addr: "12 Maple Crescent, Ottawa, ON", phone: "613-555-0177", dep: "Deposit", bal: "Balance",
    miles: [["Preparation", ["Patch and sand small holes", "Mask floors and trim"]], ["Painting", ["First coat, walls and ceilings", "Second coat"]], ["Cleanup", ["Final cleanup and touch-ups"]]],
    crew: [["Sam Lavoie", "Lead painter"], ["Maya Singh", "Painter"], ["Luc Bouchard", "Painter"]], supplier: "Ottawa Paint Supply", paint: "Paint and primer",
    others: [["Kitchen repaint", "Priya Nair", "305 Bank Street, Ottawa, ON"], ["Deck rebuild", "Tom Kowalski", "77 Elgin Road, Kanata, ON"]],
    inv: { final: "Final invoice", title: "Kitchen repaint", to: "Priya Nair", email: "priya@example.invalid", addr: "305 Bank Street", city: "Ottawa", sub: 2889.38, line: "Kitchen repaint, as quoted", others: [["Tom Kowalski", "Deck rebuild", 2980.5, "sent"], ["Dana Whitfield", "Main floor repaint", 925.19, "paid"]] },
    weather: "Light snow", site: "Ottawa", qboCompany: "Morin Renovations Inc.", income: "Services", deposit: "Chequing", expense: "Job materials", taxCode: "HST ON",
  },
  fr: {
    jobName: "Peinture du rez-de-chaussée", desc: "Peinture intérieure du rez-de-chaussée : murs et plafonds, deux couches.", addr: "12, rue des Érables, Québec (QC)", phone: "418-555-0177", dep: "Dépôt", bal: "Solde",
    miles: [["Préparation", ["Réparer et poncer les petits trous", "Protéger planchers et moulures"]], ["Peinture", ["Première couche, murs et plafonds", "Deuxième couche"]], ["Nettoyage", ["Nettoyage final et retouches"]]],
    crew: [["Sam Lavoie", "Peintre en chef"], ["Maya Singh", "Peintre"], ["Luc Bouchard", "Peintre"]], supplier: "Peintures de Québec", paint: "Peinture et apprêt",
    others: [["Peinture de la cuisine", "Priya Nair", "305, boul. Laurier, Québec (QC)"], ["Réfection de la terrasse", "Marc Tremblay", "77, chemin Royal, Lévis (QC)"]],
    inv: { final: "Facture finale", title: "Peinture de la cuisine", to: "Priya Nair", email: "priya@example.invalid", addr: "305, boul. Laurier", city: "Québec", sub: 2839.74, line: "Peinture de la cuisine, selon la soumission", others: [["Marc Tremblay", "Réfection de la terrasse", 2980.5, "sent"], ["Danielle Gagnon", "Peinture du rez-de-chaussée", 941.36, "paid"]] },
    weather: "Faible neige", site: "Québec", qboCompany: "Rénovations Morin inc.", income: "Services", deposit: "Compte chèques", expense: "Matériaux de chantier", taxCode: "TPS/TVQ",
  },
};

const VALUES = [610, 2500, 165];
const SPAN = [[0, 0], [1, 2], [3, 3]];

function milestones(lang, phase, value = 0) {
  const deposit = Math.round(value * 0.25);
  const t = T[lang];
  const done = phase === "running" ? 1 : 0;
  return t.miles.map(([title, tasks], i) => {
    const [a, b] = [DAYS[SPAN[i][0]], DAYS[SPAN[i][1]]];
    const status = i < done ? "completed" : i === done && phase === "running" ? "in_progress" : "planned";
    return {
      id: `m${i + 1}`, key: `m${i + 1}`, title, description: "", sortOrder: i, plannedStart: a, plannedEnd: b, actualStart: i < done ? a : null, actualEnd: i < done ? b : null, status,
      paymentTermId: i === 0 ? "t1" : i === 2 ? "t2" : null, paymentTermLabel: i === 0 ? t.dep : i === 2 ? t.bal : null, paymentAmountCents: i === 0 ? deposit : i === 2 ? value - deposit : null, sourceChapter: String.fromCharCode(65 + i), valueCents: cents(VALUES[i]), updatedAt: NOW,
      tasks: tasks.map((name, k) => ({ id: `t${i}${k}`, milestoneId: `m${i + 1}`, title: name, description: "", status: i < done ? "done" : "todo", dueDate: b, sortOrder: k, addedFromFieldBy: null, updatedAt: NOW })),
    };
  });
}

const crewOf = (lang) => T[lang].crew.map(([name], i) => ({ id: `w${i + 1}`, name }));

export function jobDetail(lang, w, total, state) {
  const t = T[lang];
  const phase = state.job ?? "setup";
  const started = phase !== "setup";
  const running = phase === "running";
  const value = cents(total);
  const dep = Math.round(value * 0.25);
  const cost = running ? [{ id: "k1", projectId: "j1", milestoneId: "m1", milestoneTitle: t.miles[0][0], category: "materials", vendor: t.supplier, description: t.paint, date: D, subtotalCents: 41200, taxCents: 5356, totalCents: 46556, status: "confirmed", source: "receipt", aiExtraction: { confidence: "high" }, createdBy: "u1", sourceDocumentId: null }] : [];
  const paid = running ? dep : 0;
  return {
    job: {
      id: "j1", name: t.jobName, description: t.desc, status: started ? "active" : "planning", setupStatus: started ? "confirmed" : "pending_review", quoteId: "q-new", clientId: "c1", contractId: null, address: t.addr, province: w.province,
      latitude: "45.42", longitude: "-75.69", geofenceRadiusMeters: 150, contractValueCents: value, changeOrdersCents: 0, totalValueCents: value, plannedStart: DAYS[0], plannedEnd: DAYS[3], progressPercent: running ? 42 : 0, completedAt: null, createdAt: NOW, updatedAt: NOW, archivedAt: null,
      client: { id: "c1", name: w.clients[0][0], email: "client@example.invalid", phone: t.phone }, contract: null, quote: { id: "q-new", number: "Q-2026-124", status: "accepted" },
    },
    milestones: milestones(lang, phase, value), unassignedTasks: [],
    budget: [["materials", 620], ["labour", 1300], ["misc", 80]].map(([category, n], i) => ({ id: `b${i}`, category, chapterRef: null, label: "", plannedCents: cents(n), sortOrder: i })), budgetTotalCents: 200000,
    changeOrders: [], costs: { totalCents: cost.reduce((s, c) => s + c.totalCents, 0), pendingCents: 0, pendingCount: 0, byCategory: { materials: running ? 46556 : 0, labour: 0, subcontractor: 0, permits_fees: 0, equipment: 0, misc: 0 }, entries: cost },
    timeEntries: running ? crewOf(lang).map((c, i) => ({ id: `e${i}`, workerId: c.id, workerName: c.name, projectId: "j1", milestoneId: "m1", date: D, hours: 8, status: "approved", costCents: 25600 })) : [], equipmentUsage: [],
    assignments: started ? crewOf(lang).map((c, i) => ({ id: `a${i}`, collaboratorId: c.id, roleInProject: t.crew[i][1], collaboratorName: c.name, collaboratorRole: t.crew[i][1], collaboratorHourlyRate: 32, workerType: "employee", active: true })) : [],
    invoices: running ? [{ id: "i3", number: "INV-2026-042", type: "deposit", status: "paid", title: t.dep, paymentTermId: "t1", paymentTermLabel: t.dep, milestoneId: "m1", issueDate: D, dueDate: D, totalCents: dep, paidCents: dep, balanceCents: 0 }] : [],
    invoiceTotals: { invoicedCents: paid, collectedCents: paid, outstandingCents: 0, overdueCents: 0, draftCount: 0 },
  };
}

export function jobsList(lang, w, total, state) {
  const t = T[lang];
  const d = jobDetail(lang, w, total, state);
  const row = (id, name, clientName, address, status, value, progress, extra = {}) => ({ id, name, status, setupStatus: "confirmed", clientId: id, clientName, address, totalValueCents: value, plannedStart: DAYS[0], plannedEnd: DAYS[3], progressPercent: progress, completedAt: null, createdAt: NOW, updatedAt: NOW, milestoneCount: 3, milestonesDone: progress === 100 ? 3 : 0, nextMilestone: null, crewCount: 0, crew: [], invoicedCents: 0, costCents: 0, pendingReceiptCount: 0, pendingReceiptCents: 0, ...extra });
  const next = d.milestones.find((m) => m.status !== "completed");
  const items = [
    row("j1", t.jobName, w.clients[0][0], t.addr, d.job.status, cents(total), d.job.progressPercent, { setupStatus: d.job.setupStatus, milestonesDone: state.job === "running" ? 1 : 0, nextMilestone: next ? { id: next.id, title: next.title, plannedEnd: next.plannedEnd } : null, crewCount: d.assignments.length, crew: crewOf(lang).slice(0, d.assignments.length), invoicedCents: d.invoiceTotals.invoicedCents, costCents: d.costs.totalCents }),
    row("j2", t.others[0][0], t.others[0][1], t.others[0][2], "completed", 326500, 100, { completedAt: "2026-10-28T17:00:00-04:00" }),
    row("j3", t.others[1][0], t.others[1][1], t.others[1][2], "planning", 987025, 0, { plannedStart: "2026-11-16", plannedEnd: "2026-11-20" }),
  ];
  return { items, jobLimit: null, openJobs: 2 };
}

export function schedule(lang, state) {
  const t = T[lang];
  const started = (state.job ?? "setup") !== "setup";
  const blocks = started ? crewOf(lang).flatMap((c, i) => DAYS.map((day, k) => ({ id: `s${i}${k}`, projectId: "j1", projectName: t.jobName, projectAddress: t.addr, milestoneId: `m${Math.min(3, k + 1)}`, milestoneTitle: t.miles[Math.min(2, k)][0], collaboratorId: c.id, collaboratorName: c.name, title: t.jobName, startsAt: at(day, 8), endsAt: at(day, 16), allDay: false, notes: "" }))) : [];
  return { blocks, workers: crewOf(lang).map((c, i) => ({ ...c, role: t.crew[i][1], hasPhone: true, hasEmail: true })), jobs: [{ id: "j1", name: t.jobName, address: t.addr, status: "active", milestones: [] }] };
}

export function crewToday(lang) {
  const t = T[lang];
  return {
    enabled: true, day: D,
    jobs: [{ jobId: "j1", jobName: t.jobName, address: t.addr, crew: crewOf(lang).map((c, i) => ({ blockId: `s${i}0`, workerId: c.id, workerName: c.name, startsAt: at(D, 8), endsAt: at(D, 16), allDay: false, title: t.jobName, clockedInAt: at(D, 7, 58), clockedInEntryId: `e${i}` })) }],
    clockedIn: crewOf(lang).map((c, i) => ({ entryId: `e${i}`, workerId: c.id, workerName: c.name, projectId: "j1", projectName: t.jobName, since: at(D, 7, 58) })), blockers: [],
  };
}

export const workers = (lang) => ({ items: T[lang].crew.map(([name, role], i) => ({ id: `w${i + 1}`, name, role, email: "", phone: "613-555-0100", hourlyRateCents: 3200, workerType: "employee", payrollId: "", burdenPercent: 12, active: true, canAddTasks: i === 0, hasInvite: true, inviteExpiresAt: null, lastTimeEntryAt: NOW, hoursThisMonth: 24 - i * 2, pendingCount: 1, createdAt: NOW })) });

export const timeEntries = (lang, state) => ({ items: state.approved ? [] : crewOf(lang).map((c, i) => ({ id: `e${i}`, workerId: c.id, workerName: c.name, projectId: "j1", projectName: T[lang].jobName, date: D, hours: 8, overtimeHours: 0, holidayHours: 0, note: null, status: "submitted", enteredBy: "worker", clockInAt: at(D, 8), clockOutAt: at(D, 16), geofenceFlagged: false, costCents: 25600 })) });

export function crewView(lang, w, state) {
  const t = T[lang];
  const phase = milestones(lang, "started");
  const tasks = phase[0].tasks.map((x, i) => ({ id: x.id, title: x.title, status: (state.tasksDone ?? 0) > i ? "done" : "todo", milestoneTitle: phase[0].title, dueDate: D, addedBy: null }));
  const entry = state.clocked ? { id: "e0", projectId: "j1", projectName: t.jobName, milestoneId: "m1", milestoneTitle: phase[0].title, date: D, hours: 0, note: "", status: "submitted", rejectedReason: null, clockInAt: state.clocked, clockOutAt: null, geofenceFlagged: false, createdAt: state.clocked } : null;
  return {
    worker: { name: t.crew[0][0], role: t.crew[0][1], canAddTasks: true }, travel: null, allowances: [], companyName: w.company, language: lang,
    jobs: [{ id: "j1", name: t.jobName, address: t.addr, latitude: null, longitude: null, geofenceRadiusMeters: null, milestones: phase.map((m) => ({ id: m.id, title: m.title, status: m.status })) }],
    entries: entry ? [entry] : [], activeEntry: entry, today: D,
    schedule: DAYS.slice(1).map((day, k) => ({ id: `s0${k + 1}`, projectId: "j1", projectName: t.jobName, address: t.addr, milestoneTitle: t.miles[Math.min(2, k + 1)][0], startsAt: at(day, 8), endsAt: at(day, 16), allDay: false, notes: "" })),
    todayJobs: [{ id: "j1", name: t.jobName, address: t.addr, contact: { name: w.user, phone: w.phone }, blocks: [{ id: "s00", startsAt: at(D, 8), endsAt: at(D, 16), allDay: false, notes: "" }], tasks }],
    reports: [], changes: [], changesUpTo: NOW, companies: [{ workerId: "w1", companyName: w.company, current: true, primary: true }],
  };
}

function invoiceRow(id, number, type, status, title, client, total, paid, job = title) {
  return { id, number, type, status, title, projectName: job, clientName: client, issueDate: "2026-10-28", dueDate: "2026-11-11", customer: { name: client, email: "client@example.invalid" }, totalCents: total, paidCents: paid, balanceCents: total - paid, sentAt: "2026-10-28T15:00:00-04:00", viewedAt: "2026-10-28T19:12:00-04:00", paidAt: status === "paid" ? NOW : null, reminderCount: 0, lastReminderAt: null, archivedAt: null };
}

const sums = (w, inv) => { const tax = w.taxes.map((x) => Math.round(cents(inv.sub) * x.rate / 100)); return { subtotal: cents(inv.sub), tax, total: cents(inv.sub) + tax.reduce((a, b) => a + b, 0) }; };

export function invoices(lang, w, state) {
  const inv = T[lang].inv;
  const { total } = sums(w, inv);
  const main = invoiceRow("i1", "INV-2026-038", "final", state.paid ? "paid" : "pending_confirmation", inv.final, inv.to, total, state.paid ? total : 0, inv.title);
  const [a, b] = inv.others;
  const items = [main, invoiceRow("i2", "INV-2026-041", "progress", a[3], a[1], a[0], cents(a[2]), 0), invoiceRow("i3", "INV-2026-042", "deposit", b[3], b[1], b[0], cents(b[2]), cents(b[2]))];
  const open = items.filter((i) => i.status !== "paid").reduce((s, i) => s + i.balanceCents, 0);
  return { items, stats: { drafts: 0, outstandingCents: open, overdueCents: 0, overdueCount: 0, paidThisMonthCents: items.filter((i) => i.status === "paid").reduce((s, i) => s + i.totalCents, 0) } };
}

export function invoiceDetail(lang, w, state) {
  const inv = T[lang].inv;
  const { subtotal, tax, total } = sums(w, inv);
  const row = invoices(lang, w, state).items[0];
  return {
    invoice: { ...row, lines: [{ description: inv.line, quantity: 1, unitCents: subtotal, amountCents: subtotal }], subtotalCents: subtotal, holdbackPercent: null, holdbackCents: 0, taxLines: w.taxes.map((x, i) => ({ code: x.code, label: x.label, rate: x.rate, amountCents: tax[i] })), taxCents: tax.reduce((a, b) => a + b, 0), notes: "", siteAddress: inv.addr, customer: { name: inv.to, address: inv.addr, city: inv.city, province: w.province, email: inv.email }, contractor: { name: w.company, address: w.address, phone: w.phone }, projectId: "j2", language: lang, hasPdf: true },
    payments: state.paid ? [{ id: "p1", date: at(D, 14), amountCents: total, method: "etransfer", reference: "", note: "", creditNoteId: null, createdAt: NOW }] : [],
    events: [{ id: "v3", type: "etransfer_reported", at: "2026-11-03T13:48:00-05:00", createdAt: "2026-11-03T13:48:00-05:00", meta: {} }], publicUrl: "https://quoteai.ca/i/example", reminderDays: [3, 7],
  };
}

export function needsYou(lang, w, state) {
  const inv = T[lang].inv;
  return { items: state.paid ? [] : [{ id: "etransfer:i1", kind: "etransfer", title: "INV-2026-038", subtitle: inv.to, at: NOW, href: "/invoice?id=i1", amountCents: sums(w, inv).total }] };
}

export const today = {
  weather: (lang) => ({
    fetchedAt: NOW, primarySiteId: "s1", provider: "mock", attribution: null,
    sites: [{ siteId: "s1", name: T[lang].jobName, area: T[lang].site, crewCount: 3, now: { tempC: 3, condition: "cloudy" }, summaryKey: "dry_all_day", summaryAt: null, adviceKey: null, adviceAt: null,
      hourly: Array.from({ length: 8 }, (_, i) => ({ hour: at(D, 14 + (i % 8) > 23 ? 23 : 14 + i), tempC: 3 - (i >> 2), precipProb: 10, precipType: "none" })),
      daily7: Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${String(3 + i).padStart(2, "0")}`, precipProb: 10 + i * 5, precipType: "none", visits: i < 4 ? 1 : 0 })) }],
  }),
  business: () => ({ period: "M", buckets: [41, 58, 36, 72, 64, 88].map((n, i) => ({ start: `2026-${String(6 + i).padStart(2, "0")}-01`, collectedCents: n * 10000 })), winPercent: 68, outstanding: { balanceCents: 626550, overdueCents: 0 }, marginPercent: 34 }),
  checklist: () => ({ day: D, items: [] }),
};

export function quickbooks(lang, state) {
  const t = T[lang];
  if (!state.qbo) return { connected: false, available: true };
  const set = lang === "fr" ? "TPS + TVQ" : "HST";
  return { connected: true, available: true, companyName: t.qboCompany, isEnabled: true, lastSyncedAt: NOW, hasPaymentAccount: true, paymentAccountName: t.deposit, incomeAccountName: t.income, depositAccountName: t.deposit, categoryMap: { materials: t.expense }, taxCodeMap: { [set]: t.taxCode }, taxSets: [set], pullPayments: true };
}

export const syncLog = () => ({ entries: [["invoice", "i1"], ["invoice_payment", "p1"], ["invoice", "i2"], ["cost_entry", "k1"]].map(([entityType, entityId], i) => ({ id: `l${i}`, entityType, entityId, qboId: `10${i}`, status: "synced", error: null, createdAt: NOW })) });

export const accounts = (lang) => { const t = T[lang]; const r = (n) => [{ id: n, name: n }]; return { expenseAccounts: r(t.expense), paymentAccounts: r(t.deposit), incomeAccounts: r(t.income), depositAccounts: r(t.deposit), taxCodes: r(t.taxCode) }; };
