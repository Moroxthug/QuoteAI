// "Your first quote", cut as a film: only `run` is filmed; `prep` moves the app along off camera, so nobody sees a tap, a new page or a scroll.
// Each shot says how it arrives (`cut`: left, up or wipe), its ground (`bg`), how the phone sits (`z` zoom from and to, `ry` turn from and to, `rx`, `rz`, `focus` from 0 at the top of the
// screen to 1 at the bottom), `speed`, and `lift` when the part marked with r.spot rises out of the phone, in seconds from the start of the shot.
import { clientName, clientStreet, typedText } from "../fixtures.mjs";

export default {
  id: "quotes",
  start: "/quotes",
  shots: [
    {
      caption: { en: "Every quote, in one place.", fr: "Toutes vos soumissions au même endroit." },
      bg: "light", z: [0.94, 1.02], ry: [-16, -9], rx: 4, rz: -2, focus: 0.33,
      run: (r) => r.hold(2),
    },
    {
      caption: { en: "Describe the job in your own words.", fr: "Décrivez les travaux dans vos mots." },
      cut: "left", bg: "light", z: [1.02, 1.06], ry: [13, 8], rx: 3, rz: 1.5, focus: 0.3, lift: 0.1,
      prep: async (r) => { await r.tap(r.t("New quote", "Nouvelle soumission")); await r.hold(0.9); },
      run: async (r) => {
        await r.spot(r.field(), r.t("Photos", "Photos"), 22);
        await r.type(typedText(r.lang));
        await r.hold(0.75);
      },
    },
    {
      caption: { en: "Pick the client.", fr: "Choisissez le client." },
      cut: "left", bg: "light", z: [1.12, 1.16], ry: [-11, -7], rx: 3, rz: -1, focus: 0.68, lift: 0.1,
      prep: async (r) => { await r.jump(300); },
      run: async (r) => {
        await r.spot(r.exact(clientName(r.lang)), r.t(clientStreet(r.lang), clientStreet(r.lang)), 18);
        await r.hold(0.45);
        await r.exact(clientName(r.lang)).click();
        await r.hold(0.85);
      },
    },
    {
      caption: { en: "quoteAI writes it and prices every line.", fr: "quoteAI la rédige et chiffre chaque ligne." },
      cut: "wipe", bg: "violet", speed: 1.5, z: [1, 1.05], ry: [10, 6], rx: 3, rz: 1, focus: 0.38, lift: 0.15,
      prep: async (r) => { await r.tap(r.t("Write my quote", "Rédiger ma soumission")); await r.hold(0.3); },
      run: async (r) => {
        await r.spot(r.t("Writing your quote", "Rédaction de votre soumission"), r.t("Laying out the PDF", "Mise en page du PDF"), 26);
        await r.until(r.t("Open the quote", "Ouvrir la soumission"));
        await r.hold(0.5);
      },
    },
    {
      caption: { en: "Check it, change anything.", fr: "Vérifiez, modifiez au besoin." },
      cut: "left", bg: "violet", z: [1.04, 1.1], ry: [-12, -7], rx: 4, rz: -1.5, focus: 0.42,
      prep: async (r) => { await r.tap(r.t("Open the quote", "Ouvrir la soumission")); await r.hold(1.2); await r.jump(190); },
      run: (r) => r.hold(1.5),
    },
    {
      caption: { en: "Check it, change anything.", fr: "Vérifiez, modifiez au besoin." },
      cut: "up", bg: "violet", z: [1.1, 1.13], ry: [-7, -4], rx: 3, rz: -1, focus: 0.5, lift: 0.25,
      prep: async (r) => { await r.jump(260); },
      run: async (r) => {
        await r.spot(r.exact(r.lang === "fr" ? "Sous-total" : "Subtotal"), r.exact("Total"), 20);
        await r.hold(1.9);
      },
    },
  ],
  after: [
    { type: "pdf", secs: 6, cut: "wipe", bg: "light", caption: { en: "Your client gets a clean PDF, with your logo.", fr: "Votre client reçoit un PDF soigné, avec votre logo." } },
    { type: "end", secs: 2.8, cut: "wipe", bg: "light", line: { en: "Describe it. Check it. Send it.", fr: "Décrivez. Vérifiez. Envoyez." } },
  ],
};
