// Phase 117: the browser's own fetch, captured before lib/sync/sync-fetch.ts
// wraps it — the outbox replay and the live feed send through this so their
// requests are never queued or rewritten a second time.
const original: typeof fetch = typeof window !== "undefined" && typeof window.fetch === "function" ? window.fetch.bind(window) : (...args) => fetch(...args);

export const rawFetch: typeof fetch = (input, init) => original(input, init);
