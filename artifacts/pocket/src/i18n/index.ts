// en-CA and fr-CA from the first string (CLAUDE.md). The phone's language picks French for
// any fr-* locale, English otherwise; the sandbox can switch it for side-by-side checks.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import { en } from "./en";
import { fr } from "./fr";

export type Lang = "en" | "fr";
export const LOCALE: Record<Lang, string> = { en: "en-CA", fr: "fr-CA" };

export function phoneLang(): Lang {
  return getLocales()[0]?.languageCode === "fr" ? "fr" : "en";
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: phoneLang(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
