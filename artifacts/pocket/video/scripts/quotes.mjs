// "Your first quote": the sample that sets the look of the library. Each beat has its caption in both languages, then what the app does.
import { clientName, typedText } from "../fixtures.mjs";

export default {
  id: "quotes",
  start: "/quotes",
  beats: [
    {
      caption: { en: "Every quote, in one place.", fr: "Toutes vos soumissions au même endroit." },
      run: async (r) => { await r.hold(1800); await r.tap(r.t("New quote", "Nouvelle soumission")); await r.hold(900); },
    },
    {
      caption: { en: "Describe the job in your own words.", fr: "Décrivez les travaux dans vos mots." },
      run: async (r) => { await r.type(typedText(r.lang)); await r.hold(900); },
    },
    {
      caption: { en: "Pick the client.", fr: "Choisissez le client." },
      run: async (r) => { await r.tap(r.exact(clientName(r.lang))); await r.hold(900); },
    },
    {
      caption: { en: "quoteAI writes it and prices every line.", fr: "quoteAI la rédige et chiffre chaque ligne." },
      run: async (r) => { await r.tap(r.t("Write my quote", "Rédiger ma soumission")); await r.done(); await r.hold(1500); },
    },
    {
      caption: { en: "Check it, change anything, send it.", fr: "Vérifiez, modifiez, envoyez." },
      run: async (r) => { await r.tap(r.t("Open the quote", "Ouvrir la soumission")); await r.hold(1500); await r.scroll(420); await r.hold(1600); },
    },
  ],
};
