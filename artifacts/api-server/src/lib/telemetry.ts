import { PostHog } from "posthog-node";
import { logger } from "./logger.js";

const posthogKey = process.env.POSTHOG_KEY || process.env.posthog_key || "";
const posthogHost = process.env.POSTHOG_HOST || process.env.posthog_host || "https://eu.i.posthog.com";

export const posthog = posthogKey
  ? new PostHog(posthogKey, { host: posthogHost })
  : null;

if (posthog) {
  logger.info("Telemetry: PostHog initialized successfully.");
} else {
  logger.info("Telemetry: PostHog not configured (missing POSTHOG_KEY).");
}

export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, any>
) {
  if (!posthog) return;
  try {
    posthog.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        $lib: "api-server",
      },
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to send telemetry event");
  }
}

export function identifyUser(userId: string, properties: Record<string, any>) {
  if (!posthog) return;
  try {
    posthog.identify({
      distinctId: userId,
      properties,
    });
  } catch (err) {
    logger.error({ err, userId }, "Failed to identify user in telemetry");
  }
}
