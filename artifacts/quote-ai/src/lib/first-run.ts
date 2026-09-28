// Phase 121: the first run — welcome, sign-in, company basics, the first quote.
// What the device remembers about it (all per device; nothing here is secret)
// and the small pure rules the screens use (tested in first-run.test.ts).

const WELCOME_KEY = "quoteai.welcomeSeen";
const firstQuoteKey = (userId: string) => `quoteai.firstQuote.${userId}`;

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** The app's welcome is shown once; after that a signed-out app opens on sign-in. */
function welcomeSeen(): boolean {
  return get(WELCOME_KEY) === "1";
}
export function markWelcomeSeen(): void {
  set(WELCOME_KEY, "1");
}
/** Where a signed-out phone app goes (the website always goes to sign-in). */
export function signedOutPath(native: boolean): string {
  return native && !welcomeSeen() ? "/welcome" : "/sign-in";
}

/** The fingerprint / face lock (components/native/app-lock.tsx) asks again after this long in the background. */
export const LOCK_AFTER_MS = 5 * 60_000;

/** Does coming back after `awayMs` in the background lock the app? */
export function locksOnReturn(on: boolean, awayMs: number): boolean {
  return on && awayMs >= LOCK_AFTER_MS;
}

// ── The guided first quote ─────────────────────────────────────────────────
// compose (describe one real job) → review (it priced; send it to yourself) → done.

export type FirstQuoteStage = "compose" | "review" | "done";

export function firstQuoteStage(userId: string | null | undefined): FirstQuoteStage | null {
  if (!userId) return null;
  const v = get(firstQuoteKey(userId));
  return v === "compose" || v === "review" || v === "done" ? v : null;
}
export function setFirstQuoteStage(userId: string | null | undefined, stage: FirstQuoteStage | null): void {
  if (userId) set(firstQuoteKey(userId), stage);
}

/** "3 min" / "1 h 5 min" — how long from account to first quote sent, for the done sheet. */
export function elapsedLabel(fromIso: string | null | undefined, now: number): string | null {
  if (!fromIso) return null;
  const start = Date.parse(fromIso);
  if (!Number.isFinite(start) || now < start) return null;
  const mins = Math.max(1, Math.round((now - start) / 60_000));
  if (mins > 24 * 60) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// ── Trades → the example that fits ─────────────────────────────────────────

/** The new-quote examples (dashboard.new.examples.<key>) in the order they are shown. */
export const EXAMPLE_KEYS = ["painter", "electrician", "plumber", "renovation", "mason"] as const;
export type ExampleKey = (typeof EXAMPLE_KEYS)[number];

const TRADE_EXAMPLE: Record<string, ExampleKey> = {
  painting: "painter",
  drywall: "painter",
  electrical: "electrician",
  hvac: "electrician",
  plumbing: "plumber",
  masonry: "mason",
  concrete: "mason",
  landscaping: "mason",
  general: "renovation",
  renovation: "renovation",
  carpentry: "renovation",
  flooring: "renovation",
  roofing: "renovation",
};

/** The examples with the ones for this company's trades first (their order kept). */
export function examplesForTrades(trades: readonly string[] | null | undefined): ExampleKey[] {
  const first: ExampleKey[] = [];
  for (const trade of trades ?? []) {
    const key = TRADE_EXAMPLE[trade];
    if (key && !first.includes(key)) first.push(key);
  }
  return [...first, ...EXAMPLE_KEYS.filter((k) => !first.includes(k))];
}

// ── A crew member's way in ─────────────────────────────────────────────────

export type JoinTarget = { kind: "code"; code: string } | { kind: "path"; path: string };

const CODE_ALPHABET = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/;

/**
 * What a crew member pasted or typed on the welcome's "join your team" screen:
 * the link the office texted (quoteai.ca/t/…, an invite link, a /join?code=
 * link) or an access code (XXXXX-XXXXX, look-alike letters forgiven).
 */
export function parseJoinInput(raw: string): JoinTarget | null {
  const text = raw.trim();
  if (!text) return null;
  const inLink = text.match(/\/(t|team-invite)\/([A-Za-z0-9_-]{8,})/);
  if (inLink) return { kind: "path", path: `/${inLink[1]}/${inLink[2]}` };
  const codeParam = text.match(/[?&]code=([A-Za-z0-9-]+)/);
  const candidate = (codeParam ? codeParam[1]! : text).toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (CODE_ALPHABET.test(candidate)) return { kind: "code", code: `${candidate.slice(0, 5)}-${candidate.slice(5)}` };
  if (/^[A-Za-z0-9_-]{16,}$/.test(text)) return { kind: "path", path: `/t/${text}` };
  return null;
}

/** The account's creation time as the session hands it (a Date or an ISO string). */
export function createdAtIso(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  return typeof v === "string" && v ? v : null;
}

/** Seconds from account to now, for the `first_quote_sent` count (null when unknown). */
export function secondsSince(v: unknown, now = Date.now()): number | null {
  const iso = createdAtIso(v);
  const start = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(start) && now >= start ? Math.round((now - start) / 1000) : null;
}
