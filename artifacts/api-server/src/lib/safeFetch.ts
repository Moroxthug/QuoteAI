import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import type { LookupFunction } from "node:net";

/**
 * Outbound requests to URLs a customer typed (calendar feeds, webhooks) —
 * audit B5. A plain fetch() would let a customer point the server at
 * 169.254.169.254, localhost or a private network and read the answer.
 *
 * - https only, no credentials in the URL, default port only.
 * - The host is resolved and EVERY address is checked against the private,
 *   loopback, link-local, CGNAT, multicast and reserved ranges. The check runs
 *   inside the socket's own DNS lookup, so the address that is checked is the
 *   address that is connected to (no DNS-rebinding window).
 * - Redirects are never followed; a 3xx is returned as is.
 * - The body is capped; a bigger answer is cut off and refused.
 */

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv6");
}

/** True when the address must never be reached from the server. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return true;
  if (family === 6) {
    // IPv4-mapped (::ffff:a.b.c.d) is judged as the IPv4 address it carries.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return blocked.check(mapped[1]!, "ipv4");
    return blocked.check(address, "ipv6");
  }
  return blocked.check(address, "ipv4");
}

export class UnsafeUrlError extends Error {
  constructor(public readonly code: "INVALID_URL" | "HTTPS_REQUIRED" | "NO_CREDENTIALS" | "PRIVATE_HOST" | "BAD_PORT") {
    super(code);
  }
}

/** Static checks on the URL itself; the address check happens at connect time. */
export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("INVALID_URL");
  }
  if (url.protocol !== "https:") throw new UnsafeUrlError("HTTPS_REQUIRED");
  if (url.username || url.password) throw new UnsafeUrlError("NO_CREDENTIALS");
  if (url.port && url.port !== "443") throw new UnsafeUrlError("BAD_PORT");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUrlError("PRIVATE_HOST");
  }
  if (net.isIP(host) && isBlockedAddress(host)) throw new UnsafeUrlError("PRIVATE_HOST");
  return url;
}

export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      return callback(new UnsafeUrlError("PRIVATE_HOST") as NodeJS.ErrnoException, "", 0);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

export type SafeResponse = { status: number; ok: boolean; headers: Record<string, string | string[] | undefined>; text: string };

type SafeFetchOptions = { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxBytes?: number; maxRedirects?: number };

/**
 * GET may follow up to `maxRedirects` (default 0) redirects; each hop goes
 * through the same URL and address checks. POST never follows one.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> {
  let url = rawUrl;
  let hops = opts.method === "POST" ? 0 : (opts.maxRedirects ?? 0);
  for (;;) {
    const res = await safeRequest(url, opts);
    const location = res.headers.location;
    if (res.status >= 300 && res.status < 400 && typeof location === "string" && hops > 0) {
      url = new URL(location, url).toString();
      hops--;
      continue;
    }
    return res;
  }
}

function safeRequest(rawUrl: string, opts: SafeFetchOptions): Promise<SafeResponse> {
  const url = assertPublicHttpsUrl(rawUrl);
  const maxBytes = opts.maxBytes ?? 1_000_000;
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: opts.method ?? "GET",
        headers: { ...(opts.headers ?? {}), ...(opts.body !== undefined ? { "Content-Length": Buffer.byteLength(opts.body) } : {}) },
        lookup: guardedLookup,
        timeout: opts.timeoutMs ?? 10_000,
        agent: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy(new Error("RESPONSE_TOO_LARGE"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          resolve({ status, ok: status >= 200 && status < 300, headers: res.headers, text: Buffer.concat(chunks).toString("utf8") });
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("TIMEOUT")));
    req.on("error", reject);
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}
