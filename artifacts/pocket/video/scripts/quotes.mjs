// "Your first quote". Each beat has its caption in both languages, where the camera looks (zoom, and focus from 0 at the top of the screen to 1 at the bottom), then what the app does.
// `after` runs once the app part ends: the real PDF, then the closing card.
import { clientName, typedText } from "../fixtures.mjs";

export default {
  id: "quotes",
  start: "/quotes",
  beats: [
    {
      caption: { en: "Every quote, in one place.", fr: "Toutes vos soumissions au même endroit." },
      zoom: 1, focus: 0.4,
      run: async (r) => { await r.hold(1.6); await r.tap(r.t("New quote", "Nouvelle soumission")); await r.hold(0.7); },
    },
    {
      caption: { en: "Describe the job in your own words.", fr: "Décrivez les travaux dans vos mots." },
      zoom: 1.32, focus: 0.2,
      run: async (r) => { await r.type(typedText(r.lang)); await r.hold(0.8); },
    },
    {
      caption: { en: "Pick the client.", fr: "Choisissez le client." },
      zoom: 1.12, focus: 0.62,
      run: async (r) => { await r.tap(r.exact(clientName(r.lang))); await r.hold(0.8); },
    },
    {
      caption: { en: "quoteAI writes it and prices every line.", fr: "quoteAI la rédige et chiffre chaque ligne." },
      zoom: 1.22, focus: 0.34,
      run: async (r) => { await r.tap(r.t("Write my quote", "Rédiger ma soumission")); await r.until(r.t("Open the quote", "Ouvrir la soumission")); await r.hold(1.3); },
    },
    {
      caption: { en: "Check it, change anything.", fr: "Vérifiez, modifiez au besoin." },
      zoom: 1.12, focus: 0.55,
      run: async (r) => { await r.tap(r.t("Open the quote", "Ouvrir la soumission")); await r.hold(1.1); await r.scroll(430, 1.1); await r.hold(0.9); await r.mark(r.exact(r.lang === "fr" ? "Aperçu" : "Preview")); },
    },
  ],
  after: [
    { type: "pdf", secs: 6.5, caption: { en: "Your client gets a clean PDF, with your logo.", fr: "Votre client reçoit un PDF soigné, avec votre logo." } },
    { type: "end", secs: 3, line: { en: "Describe it. Check it. Send it.", fr: "Décrivez. Vérifiez. Envoyez." } },
  ],
};
