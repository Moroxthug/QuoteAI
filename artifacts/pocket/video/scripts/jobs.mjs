// "Start a job from a quote": the accepted quote becomes a plan, a budget, a live job with its crew booked, and the margin as it runs. Same quote as "Your first quote".
const street = { en: "12 Maple Crescent, Ottawa", fr: "12, rue des Érables, Québec" };
const miles = (r) => r.exact(r.lang === "fr" ? "Étapes" : "Milestones");
const budget = (r) => r.exact(r.lang === "fr" ? "Budget des coûts" : "Cost budget");
const margin = (r) => r.exact(r.lang === "fr" ? "Marge prévue" : "Projected margin");

export default {
  id: "jobs",
  start: "/quote?id=q-new",
  state: { quoteStatus: "accepted" },
  shots: [
    {
      caption: { en: "The client said yes.", fr: "Le client a dit oui." },
      bg: "light", z: [0.98, 1.05], ry: [-15, -8], rx: 4, rz: -2, focus: 0.22, lift: 0.45,
      run: async (r) => { await r.spot(r.t("Q-2026-124", "Q-2026-124"), r.t(street.en, street.fr), 16); await r.hold(2.2); },
    },
    {
      caption: { en: "One tap makes the plan.", fr: "Un geste crée le plan." },
      cut: "left", bg: "light", z: [1.04, 1.08], ry: [13, 8], rx: 3, rz: 1.5, focus: 0.45, lift: 0.3,
      prep: async (r) => { await r.tap(r.t("Start job", "Lancer les travaux")); await r.hold(1.4); await r.to(miles(r), 140); },
      run: async (r) => { await r.spot(miles(r), r.t("Balance ·", "Solde ·"), 16); await r.hold(2.6); },
    },
    {
      caption: { en: "Your budget, from the quote.", fr: "Votre budget, tiré de la soumission." },
      cut: "up", bg: "light", z: [1.06, 1.1], ry: [-11, -7], rx: 3, rz: -1, focus: 0.45, lift: 0.3,
      prep: async (r) => { await r.to(budget(r), 110); },
      run: async (r) => { await r.spot(budget(r), margin(r), [14, 44]); await r.hold(2.4); },
    },
    {
      caption: { en: "Start it, and the job is live.", fr: "Lancez-le, le chantier est actif." },
      cut: "wipe", bg: "violet", z: [1, 1.05], ry: [10, 6], rx: 3, rz: 1, focus: 0.3, lift: 0.35,
      prep: async (r) => { await r.tap(r.t("Looks good, start the job", "lancer")); await r.hold(1.5); await r.go("/job?id=j1"); },
      run: async (r) => { await r.spot(r.t("Milestones ·", "Étapes ·"), margin(r), [20, 54]); await r.hold(2.2); },
    },
    {
      caption: { en: "Your crew, booked.", fr: "Votre équipe, à l’horaire." },
      cut: "left", bg: "violet", z: [1.02, 1.07], ry: [-12, -7], rx: 4, rz: -1.5, focus: 0.34,
      prep: async (r) => { r.set({ job: "running" }); await r.go("/schedule"); },
      run: (r) => r.hold(2),
    },
    {
      caption: { en: "Costs and margin, as it runs.", fr: "Coûts et marge, en temps réel." },
      cut: "up", bg: "violet", z: [1.04, 1.1], ry: [9, 5], rx: 3, rz: 1, focus: 0.32, lift: 0.3,
      prep: async (r) => { await r.go("/job?id=j1"); },
      run: async (r) => { await r.spot(r.t("Milestones ·", "Étapes ·"), margin(r), [20, 54]); await r.hold(2.6); },
    },
  ],
  after: [{ type: "end", secs: 2.8, cut: "wipe", bg: "light", line: { en: "Quote it. Start it. Track it.", fr: "Soumettez. Lancez. Suivez." } }],
};
