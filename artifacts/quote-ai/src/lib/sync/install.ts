import { rawFetch } from "./raw-fetch";

// Phase 117: what every page carries of the sync layer — just this. The
// first write (POST/PUT/PATCH/DELETE) loads lib/sync/sync-fetch.ts, which
// does the work (idempotency keys, versions, queue, merge); reads never
// touch it, so public pages that never write pay for nothing more.

const MUTATING = /^(POST|PUT|PATCH|DELETE)$/i;
let installed = false;

export function installSyncFetch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  let core: Promise<typeof import("./sync-fetch")> | null = null;
  window.fetch = (input, init) => {
    if (input instanceof Request || !MUTATING.test(init?.method ?? "GET")) return rawFetch(input, init);
    core ??= import("./sync-fetch");
    return core.then((m) => m.syncFetch(input, init));
  };
}
