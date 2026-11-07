// "Connect QuickBooks": what it does, how connecting works, then the matching and the syncs. Intuit's sign-in page is theirs and opens in the browser, so the video doesn't show it.
export default {
  id: "qbo",
  start: "/integrations",
  shots: [
    {
      caption: { en: "Your books, without the retyping.", fr: "Vos livres, sans double saisie." },
      bg: "light", z: [1, 1.05], ry: [-15, -9], rx: 4, rz: -2, focus: 0.5, lift: 0.4,
      prep: async (r) => { await r.to(r.t("Good places to start", "Pour bien commencer"), 300); },
      run: async (r) => { await r.spot(r.exact("QuickBooks Online"), r.t("Invoices and payments to your books", "Factures et paiements dans vos livres"), 22); await r.hold(2.2); },
    },
    {
      caption: { en: "Invoices, payments and costs go across.", fr: "Factures, paiements et coûts s’y rendent." },
      cut: "left", bg: "light", z: [1.04, 1.08], ry: [12, 8], rx: 3, rz: 1.5, focus: 0.34, lift: 0.3,
      prep: async (r) => { await r.go("/integration"); },
      run: async (r) => { await r.spot(r.t("Invoices go to your books", "Les factures vont dans vos livres"), r.t("Only the ones you confirm", "Seulement ceux que vous confirmez"), 22); await r.hold(2.6); },
    },
    {
      caption: { en: "Sign in on Intuit’s own page.", fr: "Connectez-vous sur la page d’Intuit." },
      cut: "up", bg: "light", z: [1.06, 1.1], ry: [-11, -7], rx: 3, rz: -1, focus: 0.5, lift: 0.3,
      prep: async (r) => { await r.to(r.t("How connecting works", "Comment se connecter"), 220); },
      run: async (r) => { await r.spot(r.t("How connecting works", "Comment se connecter"), r.t("We suggest a match", "Nous suggérons une correspondance"), 22); await r.hold(2.4); },
    },
    {
      caption: { en: "Tax codes and accounts, matched.", fr: "Codes de taxe et comptes, associés." },
      cut: "wipe", bg: "violet", z: [1.02, 1.07], ry: [10, 6], rx: 3, rz: 1, focus: 0.5, lift: 0.3,
      prep: async (r) => { r.set({ qbo: true }); await r.go("/integration"); await r.to(r.t("quoteAI → QuickBooks", "quoteAI → QuickBooks"), 200); },
      run: async (r) => { await r.spot(r.t("quoteAI → QuickBooks", "quoteAI → QuickBooks"), r.t("Job materials", "Matériaux de chantier"), 24); await r.hold(2.6); },
    },
    {
      caption: { en: "Then it syncs on its own.", fr: "Puis tout se synchronise seul." },
      cut: "up", bg: "violet", z: [1.02, 1.06], ry: [-10, -6], rx: 3, rz: -1, focus: 0.24, lift: 0.3,
      prep: async (r) => { await r.go("/integration"); },
      run: async (r) => { await r.spot(r.exact("QuickBooks Online"), r.t("Run now", "Lancer"), [16, 30]); await r.hold(2.4); },
    },
  ],
  after: [{ type: "end", secs: 2.8, cut: "wipe", bg: "light", line: { en: "Connect it once.", fr: "Connectez une fois." } }],
};
