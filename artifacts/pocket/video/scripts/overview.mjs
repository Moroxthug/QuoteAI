// "quoteAI in 60 seconds": the player's four chapters, with their own captions (i18n/screens/video.ts), from describing a job to a paid invoice.
import { clientName, typedText } from "../fixtures.mjs";

const talk = { en: "Describe the job. quoteAI writes the quote.", fr: "Décrivez les travaux. quoteAI rédige la soumission." };
const running = { en: "Crew, schedule, photos and costs in one place.", fr: "Équipe, horaire, photos et coûts au même endroit." };
const margin = (r) => r.exact(r.lang === "fr" ? "Marge prévue" : "Projected margin");

export default {
  id: "overview",
  start: "/quotes",
  shots: [
    {
      caption: talk, bg: "light", z: [1.02, 1.06], ry: [-13, -8], rx: 3, rz: -1.5, focus: 0.3, lift: 0.1,
      prep: async (r) => { await r.tap(r.t("New quote", "Nouvelle soumission")); await r.hold(0.9); },
      run: async (r) => { await r.spot(r.field(), r.t("Photos", "Photos"), 22); await r.type(typedText(r.lang)); await r.hold(0.6); },
    },
    {
      caption: talk, cut: "wipe", bg: "violet", speed: 1.8, z: [1, 1.05], ry: [10, 6], rx: 3, rz: 1, focus: 0.38, lift: 0.15,
      prep: async (r) => { await r.jump(300); await r.exact(clientName(r.lang)).click(); await r.hold(0.5); await r.tap(r.t("Write my quote", "Rédiger ma soumission")); await r.hold(0.3); },
      run: async (r) => { await r.spot(r.t("Writing your quote", "Rédaction de votre soumission"), r.t("Laying out the PDF", "Mise en page du PDF"), 26); await r.until(r.t("Open the quote", "Ouvrir la soumission")); await r.hold(0.4); },
    },
    { type: "pdf", secs: 5, cut: "wipe", bg: "light", caption: { en: "Your client gets a clean PDF, with your logo.", fr: "Votre client reçoit un PDF soigné, avec votre logo." } },
    {
      caption: { en: "Your client accepts and signs from their phone.", fr: "Votre client accepte et signe depuis son téléphone." },
      cut: "wipe", bg: "light", z: [1.02, 1.07], ry: [12, 7], rx: 3, rz: 1, focus: 0.22, lift: 0.35,
      prep: async (r) => { r.set({ quoteStatus: "accepted" }); await r.go("/quote?id=q-new"); },
      run: async (r) => { await r.spot(r.t("Q-2026-124", "Q-2026-124"), r.t("12 Maple Crescent, Ottawa", "12, rue des Érables, Québec"), 16); await r.hold(2.2); },
    },
    {
      caption: running, cut: "left", bg: "violet", z: [1.04, 1.08], ry: [-12, -7], rx: 4, rz: -1.5, focus: 0.34,
      prep: async (r) => { r.set({ job: "running" }); await r.go("/schedule"); },
      run: (r) => r.hold(1.8),
    },
    {
      caption: running, cut: "up", bg: "violet", z: [1.04, 1.1], ry: [9, 5], rx: 3, rz: 1, focus: 0.32, lift: 0.3,
      prep: async (r) => { await r.go("/job?id=j1"); },
      run: async (r) => { await r.spot(r.t("Milestones ·", "Étapes ·"), margin(r), [20, 54]); await r.hold(2.4); },
    },
    {
      caption: { en: "Invoices go out on schedule. Card or e-Transfer.", fr: "Les factures partent à temps. Carte ou virement Interac." },
      cut: "wipe", bg: "light", z: [1.02, 1.06], ry: [11, 6], rx: 3, rz: 1, focus: 0.3, lift: 0.3,
      prep: async (r) => { r.set({ paid: true }); await r.go("/invoice?id=i1"); },
      run: async (r) => { await r.spot(r.t("INV-2026-038", "INV-2026-038"), r.exact(r.lang === "fr" ? "Échéance" : "Due"), [8, 44]); await r.hold(2.4); },
    },
  ],
  after: [{ type: "end", secs: 2.8, cut: "wipe", bg: "light", line: { en: "From a voice note to a paid invoice.", fr: "D’une note vocale à une facture payée." } }],
};
