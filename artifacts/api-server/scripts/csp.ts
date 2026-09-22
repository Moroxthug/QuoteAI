// Shared by scripts/csp-hashes.ts (writer) and scripts/security-headers.test.ts
// (CI guard): the CSP source expressions for the inline <script> blocks of a
// page. JSON-LD blocks are data and are ignored by CSP, so they are skipped.

import { createHash } from "node:crypto";

export function inlineScriptHashes(html: string): string[] {
  const out: string[] = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = m[1] ?? "";
    if (/\bsrc=/.test(attrs)) continue;
    if (/type=["']application\/ld\+json["']/.test(attrs)) continue;
    // Phase 81: hash the LF form. The repo stores index.html with LF and
    // Vercel builds from that checkout, but a Windows working copy has CRLF
    // (core.autocrlf), which hashes differently — so without this the guard
    // failed locally and "fixing" it would have written hashes that no
    // browser could ever match in production.
    const body = m[2]!.split("\r\n").join("\n");
    out.push(`'sha256-${createHash("sha256").update(body).digest("base64")}'`);
  }
  return out;
}
