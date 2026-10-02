// The tab bar a person sees: Home and the three tabs their role (or their own choice in Customize home) gives them. Below Business everyone has the four the app started with.
export const DEFAULT_TABS = ["quotes", "jobs", "clients"] as const;

/** The screen each tab opens (names in lib/nav.ts). */
export const TAB_SCREEN: Record<string, string> = {
  home: "SmartHome", quotes: "Quotes", leads: "Leads", clients: "Clients", jobs: "Jobs", schedule: "Schedule", invoices: "Invoices", map: "CrewMap", docs: "Documents", books: "Books", pay: "Pay",
  team: "Team", hours: "CrewHours", photos: "Documents", travel: "CrewTravel",
};

/** The bar's keys in order: Home first, then the three. */
export function barOf(tabs: readonly string[] | null | undefined): string[] {
  const own = (tabs ?? []).filter((k) => k !== "home" && k in TAB_SCREEN).slice(0, 3);
  return ["home", ...(own.length ? own : DEFAULT_TABS)];
}

/** Whether `screenKey` is one of the bar's tabs, so the bar shows on that screen. */
export const barHas = (bar: readonly string[], screenKey: string): boolean => bar.includes(screenKey);
