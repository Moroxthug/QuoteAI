// Phase 123.4: crash reports and tester feedback through Sentry (@sentry/react-native), on the
// existing Sentry project. Inert until EXPO_PUBLIC_SENTRY_DSN is set at build time, and off in
// development. No personal data is sent (sendDefaultPii false).
import * as Sentry from "@sentry/react-native";

export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";
export const sentryOn = !!SENTRY_DSN && !__DEV__;

if (sentryOn) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENV ?? "production",
    sendDefaultPii: false,
    integrations: [Sentry.feedbackIntegration({ enableScreenshot: true })],
  });
}

/** Opens Sentry's feedback form (testers' "Send feedback"); nothing when Sentry is off. */
export function openFeedback() {
  if (sentryOn) Sentry.showFeedbackWidget();
}

/** Wraps the root component so Sentry can catch render errors and show its feedback form. */
export function withSentry(c: () => React.ReactNode): () => React.ReactNode {
  return sentryOn ? (Sentry.wrap(c as React.ComponentType<Record<string, unknown>>) as () => React.ReactNode) : c;
}
