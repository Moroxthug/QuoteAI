// Phase 68: runtime dictionary, split in two packs — `core` (marketing, auth
// and public pages) and `dashboard` (the signed-in app).
// Phase 115: and split per language. Each pack/language pair is its own chunk
// (virtual:i18n/<pack>/<lang>, built by the i18n-split plugin in
// vite.config.ts), so a visitor downloads one language, not both. Nothing
// renders before its strings are here: main.tsx and entry-server.tsx await
// ensureStrings() for the first render, the dashboard's lazy roots await the
// dashboard pack (App.tsx), and switching language loads before it switches
// (LanguageContext). Lookups fall back to English, then to the raw key.
import type { Lang } from "./translations";

export type Pack = "core" | "dashboard";
type Dict = Record<string, string>;

const LOADERS: Record<Pack, Record<Lang, () => Promise<{ default: Dict }>>> = {
  core: { en: () => import("virtual:i18n/core/en"), fr: () => import("virtual:i18n/core/fr") },
  dashboard: { en: () => import("virtual:i18n/dashboard/en"), fr: () => import("virtual:i18n/dashboard/fr") },
};

const dict: Record<Lang, Dict> = { en: {}, fr: {} };
const loaded = new Set<string>();
const inflight = new Map<string, Promise<void>>();
// Packs the session has asked for: a language switch loads all of them.
const wanted = new Set<Pack>(["core"]);

let version = 0;
const listeners = new Set<() => void>();

function loadPack(pack: Pack, lang: Lang): Promise<void> {
  const key = `${pack}:${lang}`;
  if (loaded.has(key)) return Promise.resolve();
  let p = inflight.get(key);
  if (!p) {
    p = LOADERS[pack][lang]().then((m) => {
      Object.assign(dict[lang], m.default);
      loaded.add(key);
      inflight.delete(key);
      version++;
      for (const l of listeners) l();
    }, (err: unknown) => {
      // Let a later call retry (a flaky network, a deploy in between).
      inflight.delete(key);
      throw err;
    });
    inflight.set(key, p);
  }
  return p;
}

/** Loads `lang` for every pack wanted so far plus `packs`. Resolves at once when all are loaded. */
export function ensureStrings(lang: Lang, packs: Pack[] = []): Promise<void> {
  for (const p of packs) wanted.add(p);
  return Promise.all([...wanted].map((p) => loadPack(p, lang))).then(() => undefined);
}

/** True when every wanted pack is loaded for `lang` (a switch can happen without waiting). */
export function stringsReady(lang: Lang): boolean {
  return [...wanted].every((p) => loaded.has(`${p}:${lang}`));
}

// The language the provider is rendering in, so code outside React (the
// dashboard's lazy roots in App.tsx) loads the right pack.
let activeLang: Lang = "en";
export function setActiveLang(lang: Lang): void {
  activeLang = lang;
}
export function getActiveLang(): Lang {
  return activeLang;
}

/** useSyncExternalStore hooks: re-render `t()` consumers after a late load. */
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
