// "Know when it's opened": the one notification ask on the done step. Push needs expo-notifications
// (a native module the current dev client does not have), so this stub says "not available yet".
export type NotifyResult = { ok: true } | { ok: false; problem: "unavailable" | "denied" };

export async function askForNotifications(): Promise<NotifyResult> {
  return { ok: false, problem: "unavailable" };
}
