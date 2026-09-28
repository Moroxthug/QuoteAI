// Phase 119: a crew member's link (/t/<token>) opened in the app is
// remembered, so the app opens on their Now screen next time and offers the
// "Clock in" home-screen shortcut. Forgotten when the link stops working.

const KEY = "quoteai.crewLink";

export function rememberCrewLink(path: string | null): void {
  try {
    if (path) localStorage.setItem(KEY, path);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function crewLink(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && /^\/t\/[A-Za-z0-9_-]+$/.test(v) ? v : null;
  } catch {
    return null;
  }
}
