// Phase 131 (docs/GROWTH-PLAN.md): where a visitor came from. The first visit's tags (utm_*, the referrer, the landing page) and an anonymous id are kept in this browser; the visit is reported
// to our own server (not a third party), and the tags are attached to the company once, right after sign-up. Nothing personal is sent: no email, no name, no IP is stored with the tags.
import { isNativeApp } from "./native/env.ts";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const KEY = "quoteai_attr";
const ANON = "quoteai_anon";
const SENT = "quoteai_attr_sent";

type Stored = { source?: string; medium?: string; campaign?: string; referrer?: string; landingPath?: string; referralCode?: string };

const read = <T,>(k: string): T | null => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown): void => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode: tracking is best effort */
  }
};

function anonId(): string {
  const have = read<string>(ANON);
  if (have) return have;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  write(ANON, id);
  return id;
}

const post = (path: string, body: unknown): void => {
  try {
    const url = `${BASE}/api${path}`;
    const data = JSON.stringify(body);
    if (path === "/growth/track" && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon(url, new Blob([data], { type: "application/json" }));
      return;
    }
    void fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: data, credentials: "include", keepalive: true }).catch(() => undefined);
  } catch {
    /* never get in the way of the page */
  }
};

/** Keeps the first visit's tags (later visits never overwrite them) and reports the landing view once per browser session. Call once at start-up. */
export function captureLanding(): void {
  if (typeof window === "undefined" || isNativeApp) return;
  const q = new URLSearchParams(window.location.search);
  const ref = q.get("ref") ?? undefined; // a referral link: quoteai.ca/?ref=CODE
  if (!read<Stored>(KEY)) {
    write(KEY, {
      source: q.get("utm_source") ?? undefined,
      medium: q.get("utm_medium") ?? undefined,
      campaign: q.get("utm_campaign") ?? undefined,
      referrer: document.referrer || undefined,
      landingPath: window.location.pathname.slice(0, 200),
      referralCode: ref,
    } satisfies Stored);
  } else if (ref && !read<Stored>(KEY)?.referralCode) {
    write(KEY, { ...read<Stored>(KEY), referralCode: ref });
  }
  try {
    if (sessionStorage.getItem("quoteai_landing_sent")) return;
    sessionStorage.setItem("quoteai_landing_sent", "1");
  } catch {
    /* ignore */
  }
  const s = read<Stored>(KEY) ?? {};
  post("/growth/track", { event: "landing_view", anonId: anonId(), platform: "web", source: s.source, campaign: s.campaign, referrer: s.referrer, landingPath: window.location.pathname.slice(0, 200) });
}

/** Right after sign-up: the saved tags go to the company, once (the server also ignores a second attempt). */
export function reportAttributionOnce(userId: string): void {
  if (typeof window === "undefined" || isNativeApp) return;
  if (read<string>(SENT) === userId) return;
  write(SENT, userId);
  const s = read<Stored>(KEY) ?? {};
  post("/growth/attribution", { anonId: anonId(), platform: "web", ...s });
}
