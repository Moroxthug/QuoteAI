// Phase 117: what the outbox needs to replay a queued edit, in one chunk the
// outbox loads the first time it has such an edit to send (lib/offline/outbox.ts
// is on every page; this is not).
export { sendEdit, rebase, rowIn } from "./protocol";
export { recordServerData } from "./versions";
export { resolvePatch } from "./merge";
export { matchRoute, changeOf } from "./routes";
export { affectsAny } from "./affects";
