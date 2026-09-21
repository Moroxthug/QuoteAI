/**
 * "YYYY-MM-DD" for a Date in the browser's own timezone. `toISOString()`
 * gives the UTC day, which is tomorrow every evening in Canada (Phase 66:
 * cost, payment and time-entry dates defaulted to the wrong day after ~8 pm).
 */
export function localDay(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
