// Tells the owner's notification hub about an event. Best-effort like the rest
// of ops: never throws, gives up after 3 s, and does nothing until HUB_URL and
// HUB_SECRET are set.

import { logger } from "./logger";

export async function notifyHub(type: "signup" | "alert", title: string, detail?: string): Promise<void> {
  const url = process.env.HUB_URL;
  const secret = process.env.HUB_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(`${url}/api/event`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ type, title, detail }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    logger.warn({ err }, "Hub notification failed");
  }
}
