import { authClient } from "@/lib/auth-client";
import { clearOfflineCaches } from "@/lib/pwa";
import { clearOutbox } from "@/lib/offline/outbox";
import { wipeQueryCache } from "@/lib/offline/query-cache";

/** Signs out and leaves nothing of this person on the device. */
export async function signOut() {
  await authClient.signOut();
  // Phase 77: the service worker keeps API reads for offline use — not for the next person on this browser.
  // Phase 116: nor the saved app data, nor anything still waiting to be sent.
  await Promise.all([clearOfflineCaches(), wipeQueryCache(), clearOutbox()]);
  window.location.href = "/";
}
