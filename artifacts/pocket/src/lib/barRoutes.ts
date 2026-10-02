// Where the tab bar does not show: signing in and setting up, the assistant layer, the "What's new" sheet and the component gallery. Everywhere else a signed-in person has it. Pure, so it can be tested.
const HIDDEN = ["/", "/welcome", "/sign-in", "/sign-up", "/verify", "/forgot-password", "/two-step", "/onboarding", "/first-quote", "/company-picker", "/invites", "/join-code", "/assistant", "/whats-new", "/crew-pair", "/crew-now", "/crew-expired", "/live-location"];

export function barHiddenOn(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return HIDDEN.includes(p) || p.startsWith("/sandbox");
}

/** The bar's tab a path belongs to (the screen that tab opens), or null when the person is somewhere else. */
export function activeTabOf(pathname: string, routeOfTab: Record<string, string | undefined>): string | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const [tab, route] of Object.entries(routeOfTab)) if (route === p) return tab;
  return null;
}
