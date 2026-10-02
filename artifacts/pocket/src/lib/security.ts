// Sign-in and security: the pure parts. A device is named from its user agent ("Chrome on Windows"), the person's own security events become the
// "Recent activity" rows, and the deletion sheet opens its button only for the word DELETE.
export type Device = { token: string; agent: string; ip: string; at: string; here: boolean };

const BROWSERS: [RegExp, string][] = [[/edg\//i, "Edge"], [/opr\/|opera/i, "Opera"], [/firefox|fxios/i, "Firefox"], [/chrome|crios/i, "Chrome"], [/safari/i, "Safari"]];
const SYSTEMS: [RegExp, string][] = [[/iphone/i, "iPhone"], [/ipad/i, "iPad"], [/android/i, "Android"], [/windows/i, "Windows"], [/mac os|macintosh/i, "Mac"], [/linux/i, "Linux"]];

/** "Chrome on Windows", "Safari on iPad", or `null` when the agent says nothing (the app's own calls). */
export function agentParts(agent: string): { browser: string; system: string } | null {
  if (!agent) return null;
  const browser = BROWSERS.find(([re]) => re.test(agent))?.[1] ?? "";
  const system = SYSTEMS.find(([re]) => re.test(agent))?.[1] ?? "";
  if (!browser && !system) return null;
  return { browser, system };
}

/** The other devices first by most recent use. */
export function othersFirst(items: Device[]): Device[] {
  return items.filter((d) => !d.here).sort((a, b) => (a.at < b.at ? 1 : -1));
}

export type Activity = { id: string; kind: "login" | "twoOn" | "twoOff" | "signedOut" | "signedOutAll"; at: string; agent: string };
const KINDS: Record<string, Activity["kind"]> = { login: "login", "two_factor.enabled": "twoOn", "two_factor.disabled": "twoOff", "session.revoked": "signedOut", "session.revoked_all": "signedOutAll" };

/** What this person did lately, newest first, from the company's audit log (`actorId` is the person). */
export function activityOf(events: { id: string; action: string; actorId: string | null; userAgent: string | null; createdAt: string }[], me: string, limit = 5): Activity[] {
  return events
    .filter((e) => e.actorId === me && KINDS[e.action])
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((e) => ({ id: e.id, kind: KINDS[e.action]!, at: e.createdAt, agent: e.userAgent ?? "" }));
}

/** The deletion button wakes up for the word DELETE (SUPPRIMER in French) in any case, with spaces around it ignored. */
export const deleteTyped = (s: string, word = "DELETE"): boolean => s.trim().toUpperCase() === word.toUpperCase();

/** Which of the two sheets' fields are still missing: the password always, a code when the second step is on. */
export function deleteReady(typed: string, password: string, twoStep: boolean, code: string, word = "DELETE"): boolean {
  return deleteTyped(typed, word) && password.length > 0 && (!twoStep || code.replace(/\s+/g, "").length >= 6);
}
