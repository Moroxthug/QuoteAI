// TwoStep: the pure parts. The server (better-auth twoFactor) hands out backup codes as ten
// letters and digits with a dash after the fifth ("aB3dE-fG7hJ"), compared as typed, so case is kept.
import type { AuthProblem } from "./auth";

export const CODE_LENGTH = 6;
export const BACKUP_LENGTH = 10;
/** Wrong codes the board counts down from ("5 tries left"); the server's own lock has the last word. */
export const MAX_TRIES = 5;

/** Digits only, at most six. */
export function cleanCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/** What the backup field shows: letters and digits, a dash after the fifth. */
export function formatBackup(input: string): string {
  const v = input.replace(/[^A-Za-z0-9]/g, "").slice(0, BACKUP_LENGTH);
  return v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
}

export function backupComplete(shown: string): boolean {
  return shown.replace(/[^A-Za-z0-9]/g, "").length === BACKUP_LENGTH;
}

export type Outcome = "ok" | "wrong" | "locked" | "offline" | "ended" | "failed";

/**
 * Reads the server's answer to a code. `ended`: the password step is no longer pending (no
 * two-factor cookie: the app was restarted, or the step ran out), so the person has to sign in again.
 */
export function outcomeOf(r: { ok: true } | { ok: false; problem: AuthProblem; message?: string }): Outcome {
  if (r.ok) return "ok";
  if (r.problem === "offline") return "offline";
  if (r.problem === "locked") return "locked";
  if (/cookie/i.test(r.message ?? "")) return "ended";
  if (r.problem === "wrong") return "wrong";
  return "failed";
}

/** Tries left after a wrong code (never below 0). */
export function triesAfterWrong(tries: number): number {
  return Math.max(0, tries - 1);
}
