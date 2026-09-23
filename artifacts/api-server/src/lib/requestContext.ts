import { AsyncLocalStorage } from "node:async_hooks";

// ── Phase 91: who is acting, for the whole request ───────────────────────────
// `requireAuth` knows the real person behind a request (res.locals.actorUserId);
// the services that create quotes, invoices, jobs and contracts do not, and
// threading an actor argument through every one of them (and every caller)
// would touch half the codebase. The request runs inside this store instead,
// so a create can stamp `created_by_user_id` and an audit row can name the
// person rather than the company. Outside a signed-in request (cron, webhooks,
// the WhatsApp bot, the public API) there is no actor and both stay as before.

type Ctx = { actorUserId: string; orgId: string };
const store = new AsyncLocalStorage<Ctx>();

export function runWithActor<T>(ctx: Ctx, fn: () => T): T {
  return store.run(ctx, fn);
}

/** The signed-in person making this request, or null outside one. */
export function currentActorId(): string | null {
  return store.getStore()?.actorUserId ?? null;
}
