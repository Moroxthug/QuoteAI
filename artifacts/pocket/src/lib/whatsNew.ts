// What's new: shown once for each version after an update, never on a first install. (The pure part; lib/whatsNewSync.ts reads and writes what the phone remembers.)
/** "2.4.1" shows as "2.4"; a one-part version stays as it is. */
export const shortVersion = (v: string): string => v.split(".").slice(0, 2).join(".");

/** Should the sheet open now? Yes for a version the person hasn't seen; a first install only records the version. */
export function shouldShow(seen: string | null, current: string): { show: boolean; record: boolean } {
  if (seen === null) return { show: false, record: true };
  return { show: seen !== current, record: false };
}
