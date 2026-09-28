import { AppShortcuts } from "@capawesome/capacitor-app-shortcuts";
import { crewLink } from "./crew-link";

// Phase 119: long-press the QuoteAI icon — New quote, Snap a receipt, and
// Clock in for a crew member whose link the app knows. Icons are vector
// drawables in the Android project (res/drawable/shortcut_*.xml).

type Id = "new_quote" | "receipt" | "clock_in";

export async function startShortcuts(opts: { go: (path: string) => void; lang: "en" | "fr" }): Promise<void> {
  const fr = opts.lang === "fr";
  const crew = crewLink();
  const list: { id: Id; title: string; androidIcon: string }[] = [
    ...(crew ? [{ id: "clock_in" as const, title: fr ? "Pointer" : "Clock in", androidIcon: "shortcut_clock_in" }] : []),
    { id: "new_quote", title: fr ? "Nouvelle soumission" : "New quote", androidIcon: "shortcut_new_quote" },
    { id: "receipt", title: fr ? "Photo d'un reçu" : "Snap a receipt", androidIcon: "shortcut_receipt" },
  ];
  await AppShortcuts.set({ shortcuts: list }).catch(() => undefined);
  await AppShortcuts.addListener("click", ({ shortcutId }) => {
    if (shortcutId === "new_quote") opts.go("/dashboard/new");
    else if (shortcutId === "clock_in") opts.go(crewLink() ?? "/dashboard");
    else if (shortcutId === "receipt") {
      opts.go("/dashboard/jobs");
      // The + sheet's receipt flow (components/layout/phone-nav.tsx): pick the job, then the scanner.
      setTimeout(() => window.dispatchEvent(new CustomEvent("quoteai:new", { detail: "receipt" })), 300);
    }
  });
}
