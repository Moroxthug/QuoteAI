// Phase 119: which taps in the phone app leave the web page. Pure, so
// native.test.ts can pin them down.

/**
 * An /api link on an anchor or window.open is always a file in the app (a
 * PDF, a CSV export, a stored photo or receipt). The app fetches it with its
 * token and opens the share sheet (files.ts); sign-in links are not files.
 */
export function isApiFileLink(href: string, apiOrigin: string): boolean {
  let path: string;
  if (href.startsWith("/api/")) path = href;
  else if (apiOrigin && href.startsWith(`${apiOrigin}/api/`)) path = href.slice(apiOrigin.length);
  else return false;
  return !path.startsWith("/api/auth/");
}

/** The place searched for by a Google / Apple Maps link the site builds (components/crew/worker-today.tsx mapsUrl), or null. */
export function mapsQueryOf(href: string): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const host = u.host.replace(/^www\./, "");
  if (host === "google.com" && u.pathname.startsWith("/maps")) return u.searchParams.get("query") ?? u.searchParams.get("q") ?? u.searchParams.get("destination");
  if (host === "maps.google.com" || host === "maps.apple.com") return u.searchParams.get("q") ?? u.searchParams.get("daddr");
  return null;
}

/** The phone's maps app for a place: Android's geo: intent (Google Maps, Waze… whichever the person uses), Apple Maps on iPhone. */
export function nativeMapsUrl(query: string, platform: string): string {
  const q = encodeURIComponent(query);
  return platform === "ios" ? `maps://?q=${q}` : `geo:0,0?q=${q}`;
}

/** The file name for a download: the one given, the server's Content-Disposition, or the URL's last part. */
export function fileNameFor(url: string, given: string | null | undefined, disposition: string | null, type: string | null): string {
  let name = given?.trim() || "";
  if (!name && disposition) {
    const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition);
    const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
    try {
      name = star ? decodeURIComponent(star[1]!) : plain ? plain[1]! : "";
    } catch {
      name = plain?.[1] ?? "";
    }
  }
  if (!name && !url.startsWith("blob:") && !url.startsWith("data:")) {
    try {
      name = decodeURIComponent(new URL(url, "https://app.invalid").pathname.split("/").filter(Boolean).pop() ?? "");
    } catch {
      name = "";
    }
    if (name === "pdf" || name === "download" || name === "file") name = "";
  }
  name = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim() || "QuoteAI";
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += extensionFor(type);
  return name.slice(0, 120);
}

function extensionFor(type: string | null): string {
  const t = (type ?? "").split(";")[0]!.trim().toLowerCase();
  const known: Record<string, string> = {
    "application/pdf": ".pdf",
    "text/csv": ".csv",
    "application/zip": ".zip",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  };
  return known[t] ?? "";
}
