// "Get paid by e-Transfer": the client says they paid, the app shows it, you check your bank and confirm, and the invoice is paid.
const due = (r) => r.exact(r.lang === "fr" ? "Échéance" : "Due");
const reminders = (r) => r.exact(r.lang === "fr" ? "Rappels" : "Reminders");

export default {
  id: "etransfer",
  start: "/invoices",
  shots: [
    {
      caption: { en: "See who owes you.", fr: "Voyez qui vous doit." },
      bg: "light", z: [0.96, 1.03], ry: [-15, -9], rx: 4, rz: -2, focus: 0.3,
      run: (r) => r.hold(2),
    },
    {
      caption: { en: "Your client sends an e-Transfer.", fr: "Votre client envoie un virement Interac." },
      cut: "left", bg: "light", z: [1.04, 1.08], ry: [12, 8], rx: 3, rz: 1.5, focus: 0.45, lift: 0.3,
      prep: async (r) => { await r.go("/home"); await r.to(r.t("Confirm $", "Confirmer 3"), 300); },
      run: async (r) => { await r.spot(r.t("Confirm $", "Confirmer 3"), r.t("Check your bank", "Vérifiez votre compte"), 26, 74); await r.hold(2.6); },
    },
    {
      caption: { en: "Check your bank, then confirm.", fr: "Vérifiez votre compte, puis confirmez." },
      cut: "left", bg: "light", z: [1.06, 1.1], ry: [-11, -7], rx: 3, rz: -1, focus: 0.5, lift: 0.3,
      prep: async (r) => { await r.go("/invoice?id=i1"); await r.to(r.t("Customer says", "Le client indique"), 300); },
      run: async (r) => { await r.spot(r.t("Customer says", "Le client indique"), r.t("Confirm received", "Paiement reçu"), 22); await r.hold(2.6); },
    },
    {
      caption: { en: "Paid, and on the record.", fr: "Payée, et bien notée." },
      cut: "wipe", bg: "violet", z: [1, 1.05], ry: [10, 6], rx: 3, rz: 1, focus: 0.3, lift: 0.3,
      prep: async (r) => { await r.tap(r.t("Confirm received", "Paiement reçu")); await r.hold(0.8); r.set({ paid: true }); await r.go("/invoice?id=i1"); },
      run: async (r) => { await r.spot(r.t("INV-2026-038", "INV-2026-038"), due(r), [8, 44]); await r.hold(2.4); },
    },
    {
      caption: { en: "Reminders stop on their own.", fr: "Les rappels cessent d’eux-mêmes." },
      cut: "up", bg: "violet", z: [1.04, 1.08], ry: [-10, -6], rx: 3, rz: -1, focus: 0.4, lift: 0.25,
      prep: async (r) => { await r.to(reminders(r), 200); },
      run: async (r) => { await r.spot(reminders(r), r.t("7 days late", "7 jours de retard"), 22); await r.hold(2.2); },
    },
  ],
  after: [{ type: "end", secs: 2.8, cut: "wipe", bg: "light", line: { en: "Invoice it. Confirm it. Done.", fr: "Facturez. Confirmez. C’est réglé." } }],
};
