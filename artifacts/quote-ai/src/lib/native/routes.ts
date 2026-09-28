// Phase 118: what the phone app shows. It is the signed-in app and the way
// into it — no marketing site. Client links (/p quotes, /sign contracts,
// /i invoices, /portal) stay in the browser: they are for the contractor's
// clients, and the app does not claim them.
// Phase 119: a crew member's link (/t/<token>) is theirs to use in the app —
// clock in with the phone's location, photos from its camera — so the app
// shows it and claims it (App Links: /dashboard and /t).

const APP_PATHS = /^\/(dashboard|onboarding|sign-in|sign-up|join|team-invite|t\/[^/]+)(\/|$)/;

/** A path the app shows itself; anything else opens the app's home. */
export function isAppPath(pathname: string): boolean {
  return APP_PATHS.test(pathname);
}

/** The in-app path for a link that opened the app (App Link / Universal Link), or null. */
export function appPathForLink(url: string, siteHosts: string[]): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!siteHosts.includes(u.host)) return null;
  if (!isAppPath(u.pathname)) return null;
  return u.pathname + u.search + u.hash;
}

/** Android back at one of these leaves the app instead of stepping back. */
export function isRootScreen(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p === "/dashboard" || p === "/sign-in" || p === "/onboarding" || /^\/t\/[^/]+$/.test(p);
}

/** The website's homepage (a logo link, after sign-out) means the app's home, not a browser tab. */
export function opensHome(pathname: string): boolean {
  return /^\/(fr\/?)?$/.test(pathname);
}
