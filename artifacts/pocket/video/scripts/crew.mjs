// "Your crew's first day": a code from the office, the crew member's own phone, the clock, the tasks, and the hours coming back to approve. It starts first thing in the morning.
const offClock = (r) => r.t("Off the clock", "Hors quart");
const clockNote = (r) => r.t("Location is checked", "La position est vérifiée");
const tasks = (r) => r.t("Today’s tasks", "Tâches du jour");
const entries = (r) => r.t("Time entries to approve", "Entrées de temps à approuver");

export default {
  id: "crew",
  start: "/team",
  now: "2026-11-03T07:57:00-05:00",
  shots: [
    {
      caption: { en: "Your crew, in one place.", fr: "Votre équipe au même endroit." },
      bg: "light", z: [0.96, 1.03], ry: [-15, -9], rx: 4, rz: -2, focus: 0.32,
      run: (r) => r.hold(2),
    },
    {
      caption: { en: "Make a code for each person.", fr: "Créez un code pour chaque personne." },
      cut: "left", bg: "light", z: [1.02, 1.06], ry: [12, 8], rx: 3, rz: 1.5, focus: 0.62, lift: 0.3,
      prep: async (r) => { await r.exact("Sam Lavoie").click({ force: true }); await r.hold(0.8); await r.tap(r.t("Make a code", "Créer un code")); await r.hold(1); },
      run: async (r) => { await r.spot(r.t("Pairing code for", "Code de jumelage pour"), r.t("Copy code", "Copier le code"), 26); await r.hold(2.2); },
    },
    {
      caption: { en: "They type it. No email, no password.", fr: "Ils l’entrent. Sans courriel ni mot de passe." },
      cut: "wipe", bg: "violet", z: [1, 1.05], ry: [-11, -6], rx: 3, rz: -1, focus: 0.3,
      prep: async (r) => { await r.go("/crew-pair"); },
      run: async (r) => { await r.type("K7M2PX", { field: "input", every: 7 }); await r.hold(1.5); },
    },
    {
      caption: { en: "Their day is ready.", fr: "Leur journée est prête." },
      cut: "left", bg: "violet", z: [1.02, 1.07], ry: [12, 7], rx: 3, rz: 1, focus: 0.3,
      prep: async (r) => { await r.tap(r.exact(r.lang === "fr" ? "Rejoindre Rénovations Morin" : "Join Morin Renovations")); await r.hold(1.5); r.set({ clockAt: await r.now() }); },
      run: (r) => r.hold(1.8),
    },
    {
      caption: { en: "One tap to clock in.", fr: "Un geste pour pointer." },
      cut: "up", bg: "violet", z: [1.06, 1.1], ry: [-9, -5], rx: 3, rz: -1, focus: 0.3, lift: 0.2,
      run: async (r) => { await r.spot(offClock(r), clockNote(r), [18, 16]); await r.hold(0.8); await r.t("Clock in", "Pointer l’arrivée").click(); await r.hold(2.4); },
    },
    {
      caption: { en: "Tasks tick off from the site.", fr: "Les tâches se cochent sur place." },
      cut: "left", bg: "violet", z: [1.08, 1.12], ry: [10, 6], rx: 3, rz: 1, focus: 0.42, lift: 0.2,
      prep: async (r) => { await r.to(tasks(r), 200); },
      run: async (r) => { await r.spot(tasks(r), r.t("Add a task", "Ajouter une tâche"), [14, 20]); await r.hold(0.8); await r.t("Patch and sand small holes", "Réparer et poncer les petits trous").click(); await r.hold(1.6); },
    },
    {
      caption: { en: "The hours come to you to approve.", fr: "Les heures vous arrivent pour approbation." },
      cut: "wipe", bg: "light", z: [1, 1.06], ry: [-12, -7], rx: 4, rz: -1.5, focus: 0.5, lift: 0.3,
      prep: async (r) => { await r.go("/team"); await r.to(entries(r), 170); },
      run: async (r) => { await r.spot(entries(r), r.nth("Logged by the worker", "Saisie par le travailleur", 1), [14, 18]); await r.hold(2.4); },
    },
  ],
  after: [{ type: "end", secs: 2.8, cut: "wipe", bg: "light", line: { en: "Clock in. Report. Approve.", fr: "Pointez. Rapportez. Approuvez." } }],
};
