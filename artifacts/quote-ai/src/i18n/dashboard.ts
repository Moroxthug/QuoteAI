// The dashboard-only strings (./translations.dashboard.ts), in the language
// being rendered. Phase 68 imported them for their side effect from each
// dashboard root; Phase 115 loads them per language, so the roots' lazy
// imports in App.tsx wait on this instead (withDashboardStrings) and nothing
// renders with raw keys.
import { ensureStrings, getActiveLang } from "./registry";

function loadDashboardStrings(): Promise<void> {
  return ensureStrings(getActiveLang(), ["dashboard"]);
}

/** Wraps a lazy() loader so the module and the dashboard strings arrive together. */
export function withDashboardStrings<T>(load: () => Promise<T>): () => Promise<T> {
  return () => Promise.all([load(), loadDashboardStrings()]).then(([mod]) => mod);
}
