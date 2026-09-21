// Phase 69 (docs/QA-VERIFICATION-PLAN.md): a dependency-free Sentry client.
//
// Both apps report unhandled errors to Sentry through its envelope endpoint
// with this module instead of the official SDKs: `@sentry/node` pulls the
// whole OpenTelemetry stack into the esbuild bundle that runs as one Vercel
// function, and `@sentry/react` would add ~30 kB to the public entry chunk
// that Phase 68 just cut to 60 kB. What this gives up is breadcrumbs, session
// health and performance tracing; what it keeps is the part launch readiness
// needs — every unhandled error, with a symbolicated stack trace, in a place
// that can page someone.
//
// Isomorphic: no Node or DOM API is touched here. Each app wraps `sendEvent`
// with its own environment/release/user context (api-server:
// src/lib/errorTracking.ts, quote-ai: src/lib/error-tracking.ts).
//
// Source maps: `scripts/sentry-sourcemaps.mjs` runs `sentry-cli sourcemaps
// inject` on both builds, which stamps every JS file with a debug id and
// registers it in `globalThis._sentryDebugIds` at load time. `debugIdImages`
// reads that registry so Sentry can match the uploaded maps — the same
// mechanism the official SDKs use.

export type Dsn = {
  protocol: string;
  host: string;
  publicKey: string;
  projectId: string;
  /** The envelope endpoint with the auth query string already attached. */
  envelopeUrl: string;
};

export type Frame = {
  filename: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
};

export type Level = "fatal" | "error" | "warning" | "info";

export type EventContext = {
  level?: Level;
  environment?: string;
  release?: string;
  serverName?: string;
  logger?: string;
  tags?: Record<string, string | number | boolean | undefined>;
  extra?: Record<string, unknown>;
  user?: { id?: string; email?: string; ip_address?: string };
  request?: { url?: string; method?: string; headers?: Record<string, string> };
  /** How the error reached us: "generic" for captureException, "onerror", "onunhandledrejection", ... */
  mechanism?: string;
  handled?: boolean;
};

export type SentryEvent = {
  event_id: string;
  timestamp: number;
  platform: "node" | "javascript";
  level: Level;
  logger?: string;
  environment?: string;
  release?: string;
  server_name?: string;
  message?: string;
  exception?: { values: ExceptionValue[] };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: EventContext["user"];
  request?: EventContext["request"];
  debug_meta?: { images: DebugImage[] };
  sdk: { name: string; version: string };
};

type ExceptionValue = {
  type: string;
  value: string;
  stacktrace?: { frames: Frame[] };
  mechanism?: { type: string; handled: boolean };
};

type DebugImage = { type: "sourcemap"; code_file: string; debug_id: string };

export const SDK = { name: "quoteai.error-reporting", version: "1.0.0" } as const;

const MAX_FRAMES = 50;
const MAX_VALUE_LENGTH = 8_000;

export function parseDsn(raw: string | undefined | null): Dsn | null {
  if (!raw) return null;
  // https://<publicKey>@<host>/<projectId>
  const m = /^(https?):\/\/([^:@/]+)(?::[^@/]*)?@([^/]+)\/(?:.*\/)?(\d+)\/?$/.exec(raw.trim());
  if (!m) return null;
  const [, protocol, publicKey, host, projectId] = m as unknown as [string, string, string, string, string];
  const auth = `sentry_key=${publicKey}&sentry_version=7&sentry_client=${SDK.name}%2F${SDK.version}`;
  return {
    protocol,
    host,
    publicKey,
    projectId,
    envelopeUrl: `${protocol}://${host}/api/${projectId}/envelope/?${auth}`,
  };
}

// V8:      "    at fn (file:line:col)" | "    at file:line:col" | "    at async fn (...)" | "    at new X (...)"
// Gecko/WebKit: "fn@file:line:col" | "@file:line:col" | "file:line:col"
const V8_LINE = /^\s*at (?:(?:async |new )?(.+?) )?\(?(.+?)(?::(\d+))?(?::(\d+))?\)?$/;
const GECKO_LINE = /^(?:(.*?)@)?(.+?)(?::(\d+))?(?::(\d+))?$/;

/**
 * Parses an Error stack into Sentry frames — oldest call first, innermost
 * last, as Sentry expects (V8 prints the opposite order).
 */
export function parseStack(stack: string | undefined | null): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const rawLine of stack.split("\n")) {
    const line = rawLine.trim();
    let fn: string | undefined;
    let file: string | undefined;
    let lineno: string | undefined;
    let colno: string | undefined;
    if (line.startsWith("at ")) {
      const v8 = V8_LINE.exec(line);
      if (!v8) continue;
      [, fn, file, lineno, colno] = v8;
    } else if (line.includes("@")) {
      const g = GECKO_LINE.exec(line);
      if (!g) continue;
      [, fn, file, lineno, colno] = g;
    } else {
      continue; // "TypeError: message" header or a bare message line
    }
    if (!file) continue;
    // "<anonymous>" / "native" frames carry nothing symbolicable.
    if (file === "<anonymous>" || file === "native" || file === "[native code]") continue;
    // Strip a trailing ")" left by "at fn (file:1:2)" when the regex took the lazy path.
    file = file.replace(/\)$/, "");
    const frame: Frame = { filename: file };
    if (fn && fn !== "<anonymous>") frame.function = fn;
    if (lineno) frame.lineno = Number(lineno);
    if (colno) frame.colno = Number(colno);
    frame.in_app = !/node_modules|node:internal|^node:/.test(file);
    frames.push(frame);
  }
  return frames.slice(0, MAX_FRAMES).reverse();
}

function errorName(err: unknown): string {
  if (err instanceof Error) return err.name || "Error";
  if (err && typeof err === "object" && "name" in err && typeof (err as { name: unknown }).name === "string") {
    return (err as { name: string }).name;
  }
  return "Error";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err) ?? String(err);
  } catch {
    return String(err);
  }
}

function exceptionValues(err: unknown, mechanism: string, handled: boolean): ExceptionValue[] {
  // Sentry wants the root cause first and the error that was caught last.
  const chain: unknown[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur !== undefined && cur !== null; i++) {
    chain.unshift(cur);
    cur = cur instanceof Error ? cur.cause : undefined;
  }
  return chain.map((e, i) => {
    const value: ExceptionValue = {
      type: errorName(e),
      value: errorMessage(e).slice(0, MAX_VALUE_LENGTH),
    };
    const frames = parseStack(e instanceof Error ? e.stack : undefined);
    if (frames.length) value.stacktrace = { frames };
    if (i === chain.length - 1) value.mechanism = { type: mechanism, handled };
    return value;
  });
}

/** 32 lowercase hex chars, from whatever randomness the runtime offers. */
export function newEventId(random: () => number = Math.random): string {
  let out = "";
  const g = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (g?.getRandomValues) {
    const bytes = g.getRandomValues(new Uint8Array(16));
    for (const b of bytes) out += b.toString(16).padStart(2, "0");
    return out;
  }
  while (out.length < 32) out += Math.floor(random() * 16).toString(16);
  return out;
}

/**
 * `sentry-cli sourcemaps inject` prepends a snippet to every JS file that
 * stores `new Error().stack` → debug id in `globalThis._sentryDebugIds`. The
 * innermost frame of each key is the file itself; map filename → id and emit
 * one image per file that appears in the event.
 */
export function debugIdImages(frames: Frame[]): DebugImage[] {
  const registry = (globalThis as { _sentryDebugIds?: Record<string, string> })._sentryDebugIds;
  if (!registry) return [];
  const byFile = new Map<string, string>();
  for (const [stack, id] of Object.entries(registry)) {
    const parsed = parseStack(stack);
    const innermost = parsed[parsed.length - 1];
    if (innermost?.filename && typeof id === "string") byFile.set(innermost.filename, id);
  }
  const images: DebugImage[] = [];
  const seen = new Set<string>();
  for (const f of frames) {
    const id = byFile.get(f.filename);
    if (!id || seen.has(f.filename)) continue;
    seen.add(f.filename);
    images.push({ type: "sourcemap", code_file: f.filename, debug_id: id });
  }
  return images;
}

function stringTags(tags: EventContext["tags"]): Record<string, string> | undefined {
  if (!tags) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags)) if (v !== undefined) out[k] = String(v).slice(0, 200);
  return Object.keys(out).length ? out : undefined;
}

export function buildEvent(
  input: { error: unknown } | { message: string },
  platform: SentryEvent["platform"],
  ctx: EventContext = {},
): SentryEvent {
  const event: SentryEvent = {
    event_id: newEventId(),
    timestamp: Date.now() / 1000,
    platform,
    level: ctx.level ?? "error",
    sdk: { ...SDK },
  };
  if (ctx.logger) event.logger = ctx.logger;
  if (ctx.environment) event.environment = ctx.environment;
  if (ctx.release) event.release = ctx.release;
  if (ctx.serverName) event.server_name = ctx.serverName;
  if ("message" in input) {
    event.message = input.message.slice(0, MAX_VALUE_LENGTH);
  } else {
    const values = exceptionValues(input.error, ctx.mechanism ?? "generic", ctx.handled ?? true);
    event.exception = { values };
    const frames = values.flatMap((v) => v.stacktrace?.frames ?? []);
    const images = debugIdImages(frames);
    if (images.length) event.debug_meta = { images };
  }
  const tags = stringTags(ctx.tags);
  if (tags) event.tags = tags;
  if (ctx.extra && Object.keys(ctx.extra).length) event.extra = ctx.extra;
  if (ctx.user) event.user = ctx.user;
  if (ctx.request) event.request = ctx.request;
  return event;
}

/** The three-line envelope Sentry's `/envelope/` endpoint accepts. */
export function serializeEnvelope(dsn: Dsn, event: SentryEvent): string {
  const header = {
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
    dsn: `${dsn.protocol}://${dsn.publicKey}@${dsn.host}/${dsn.projectId}`,
    sdk: event.sdk,
  };
  return `${JSON.stringify(header)}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
}

export type FetchLike = (url: string, init: { method: string; body: string; headers: Record<string, string>; keepalive?: boolean; signal?: AbortSignal }) => Promise<{ status: number }>;

/**
 * Posts one event. Resolves `true` on a 2xx, `false` on anything else
 * (including network failure) — never throws, so a broken tracker can never
 * take the app down with it.
 */
export async function sendEvent(
  dsn: Dsn,
  event: SentryEvent,
  fetchImpl: FetchLike,
  opts: { timeoutMs?: number; keepalive?: boolean } = {},
): Promise<boolean> {
  const controller = typeof AbortController === "function" ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), opts.timeoutMs ?? 3000) : undefined;
  try {
    const res = await fetchImpl(dsn.envelopeUrl, {
      method: "POST",
      body: serializeEnvelope(dsn, event),
      // text/plain keeps the browser from preflighting; Sentry accepts it.
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      keepalive: opts.keepalive,
      signal: controller?.signal,
    });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
