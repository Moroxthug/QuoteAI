// Phase 65 — stub third-party HTTP APIs at the `fetch` boundary.
//
// Every vendor client in src/lib (WhatsApp Cloud API, Gmail, Google Calendar,
// QuickBooks, Wave, Meta, …) is plain `fetch` against the vendor's host, so
// the integration wiring — token lookup + decryption, payload shape, sync
// log rows, fallbacks — can be exercised end-to-end without credentials by
// answering for those hosts here. Everything else (our own in-process server
// on 127.0.0.1, Supabase storage) passes through untouched.
//
// This is deliberately NOT a substitute for the live smoke with real sandbox
// accounts (docs/QA-VERIFICATION-PLAN.md Phase 65, user-driven): it proves
// our side of the contract, not the vendor's.

export type StubbedRequest = { method: string; url: string; headers: Record<string, string>; body: string | null; json: unknown };
export type StubHandler = (req: StubbedRequest) => Response | Promise<Response>;

const realFetch = globalThis.fetch;
const handlers = new Map<string, StubHandler>();
export const recorded: StubbedRequest[] = [];

/** Answer every request whose URL starts with `hostPrefix` (e.g. "https://graph.facebook.com/"). */
export function stubHost(hostPrefix: string, handler: StubHandler): void {
  handlers.set(hostPrefix, handler);
}

export function unstubHost(hostPrefix: string): void {
  handlers.delete(hostPrefix);
}

export function requestsTo(hostPrefix: string): StubbedRequest[] {
  return recorded.filter((r) => r.url.startsWith(hostPrefix));
}

export function resetRecorded(): void {
  recorded.length = 0;
}

export const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let installed = false;

/** Idempotent: replaces `globalThis.fetch` once per process. */
export function installVendorStubs(): void {
  if (installed) return;
  installed = true;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    for (const [prefix, handler] of handlers) {
      if (!url.startsWith(prefix)) continue;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const headers: Record<string, string> = {};
      const h = init?.headers ?? (input instanceof Request ? input.headers : undefined);
      if (h instanceof Headers) h.forEach((v, k) => (headers[k.toLowerCase()] = v));
      else if (Array.isArray(h)) for (const [k, v] of h) headers[k.toLowerCase()] = v;
      else if (h) for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = String(v);
      let body: string | null = null;
      if (typeof init?.body === "string") body = init.body;
      else if (init?.body instanceof URLSearchParams) body = init.body.toString();
      else if (init?.body instanceof FormData) body = "[multipart]";
      let parsed: unknown = null;
      try {
        parsed = body ? JSON.parse(body) : null;
      } catch {
        /* form-encoded or multipart */
      }
      const req: StubbedRequest = { method, url, headers, body, json: parsed };
      recorded.push(req);
      return handler(req);
    }
    return realFetch(input, init);
  }) as typeof fetch;
}
