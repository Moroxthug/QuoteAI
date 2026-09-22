// Phase 77 (docs/PILOT-LAUNCH-PLAN.md): one-off VAPID key pair for Web Push.
//
//   pnpm --filter @workspace/scripts vapid-keys
//
// Prints the two Vercel env vars. Generate once per environment and never
// rotate casually: every browser subscribed with the old public key stops
// receiving pushes (they re-subscribe the next time they open the
// notifications page). Same P-256 material api-server/src/lib/webPush.ts
// expects — base64url, 65-byte uncompressed public point, 32-byte private.

import { createECDH } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
const publicKey = ecdh.getPublicKey().toString("base64url");
const privateKey = ecdh.getPrivateKey().toString("base64url");

console.log("# Add to Vercel → Settings → Environment Variables (Production + Preview). Mark the private key Sensitive.");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:support@quoteai.ca");
