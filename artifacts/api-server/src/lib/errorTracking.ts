// Phase 69: server-side error tracking. Thin wrapper over
// @workspace/error-reporting that adds the process context (environment,
// release, request) and never throws. Inert until SENTRY_DSN is set — every
// call is then a no-op, so the code paths below cost nothing in dev/CI.
//
// Delivery: `captureException` resolves once the event is sent (or after
// 3 s). Callers on a request path (the Express error handler, automation
// failures) await it so the Vercel function does not end before the event
// leaves — Fluid Compute usually keeps the instance alive, but "usually" is
// not a delivery guarantee.

import { buildEvent, parseDsn, sendEvent, type EventContext } from "@workspace/error-reporting";
import { logger } from "./logger";

const dsn = parseDsn(process.env.SENTRY_DSN);
const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
const release = process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? undefined;
const serverName = process.env.VERCEL_REGION ? `vercel-${process.env.VERCEL_REGION}` : undefined;

if (dsn) logger.info({ host: dsn.host, environment, release }, "Error tracking: Sentry enabled");
else logger.info("Error tracking: SENTRY_DSN not set — unhandled errors are only logged");

type Ctx = Omit<EventContext, "environment" | "release" | "serverName">;

function withDefaults(ctx: Ctx): EventContext {
  return { ...ctx, environment, release, serverName, logger: ctx.logger ?? "api-server", tags: { app: "api-server", ...ctx.tags } };
}

const inflight = new Set<Promise<boolean>>();

function track(p: Promise<boolean>): Promise<boolean> {
  inflight.add(p);
  void p.finally(() => inflight.delete(p));
  return p;
}

/** Reports an error. Resolves when delivered (true) or dropped/disabled (false). */
export function captureException(err: unknown, ctx: Ctx = {}): Promise<boolean> {
  if (!dsn) return Promise.resolve(false);
  try {
    const event = buildEvent({ error: err }, "node", withDefaults({ handled: true, mechanism: "generic", ...ctx }));
    return track(sendEvent(dsn, event, fetch as never));
  } catch (buildErr) {
    logger.warn({ err: buildErr }, "Error tracking: could not build event");
    return Promise.resolve(false);
  }
}

/** Reports a plain message (used for operational alerts that are not exceptions). */
export function captureMessage(message: string, ctx: Ctx = {}): Promise<boolean> {
  if (!dsn) return Promise.resolve(false);
  const event = buildEvent({ message }, "node", withDefaults({ level: "warning", ...ctx }));
  return track(sendEvent(dsn, event, fetch as never));
}

/** Waits for every in-flight report, at most `timeoutMs`. */
export async function flush(timeoutMs = 2000): Promise<void> {
  if (inflight.size === 0) return;
  await Promise.race([Promise.allSettled([...inflight]), new Promise((r) => setTimeout(r, timeoutMs))]);
}

/** Request context for the Express error handler: no bodies, no cookies, no auth headers. */
export function requestContext(req: { method?: string; originalUrl?: string; url?: string; headers?: Record<string, unknown>; ip?: string }): EventContext["request"] {
  const headers: Record<string, string> = {};
  for (const key of ["user-agent", "content-type", "referer", "x-vercel-id"]) {
    const v = req.headers?.[key];
    if (typeof v === "string") headers[key] = v;
  }
  return { method: req.method, url: (req.originalUrl ?? req.url ?? "").split("?")[0], headers };
}

let processHandlersInstalled = false;

/**
 * Last-resort handlers. Node would otherwise print and (for uncaughtException)
 * exit; in the Vercel function the platform recycles the instance. Either
 * way the error is reported first. Installed once per process.
 */
export function installProcessHandlers(): void {
  if (processHandlersInstalled) return;
  processHandlersInstalled = true;
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
    void captureException(reason, { mechanism: "onunhandledrejection", handled: false });
  });
  process.on("uncaughtException", (err) => {
    // Same policy as Node's default (and Sentry's): the process is in an
    // unknown state, so report, flush and exit — Vercel recycles the instance.
    logger.fatal({ err }, "Uncaught exception");
    void captureException(err, { mechanism: "onuncaughtexception", handled: false, level: "fatal" })
      .then(() => flush(2000))
      .finally(() => process.exit(1));
  });
}
