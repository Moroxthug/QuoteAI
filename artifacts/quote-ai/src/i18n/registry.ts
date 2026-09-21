// Phase 68: runtime dictionary. The public entry bundle ships only
// ./translations.ts; the dashboard chunk registers ./translations.dashboard.ts
// on load (see ./dashboard.ts) so `t()` resolves those keys too. Lookups fall
// back to English, then to the raw key, exactly as before the split.
import { translations, type Lang } from "./translations";

const dict: Record<Lang, Record<string, string>> = {
  en: { ...translations.en },
  fr: { ...translations.fr },
};

let version = 0;
const listeners = new Set<() => void>();

export function registerTranslations(extra: Record<Lang, Record<string, string>>): void {
  Object.assign(dict.en, extra.en);
  Object.assign(dict.fr, extra.fr);
  version++;
  for (const l of listeners) l();
}

/** useSyncExternalStore hooks: re-render `t()` consumers after a late registration. */
export function subscribeTranslations(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getTranslationsVersion(): number {
  return version;
}

export function lookup(lang: Lang, key: string): string {
  return dict[lang][key] ?? dict.en[key] ?? key;
}
