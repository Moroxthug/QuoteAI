// COMPONENTS §1: every run of digits (and $ % + − °, with the separators inside a number)
// renders in Manrope, even mid-sentence. React Native can't merge fonts, so Text splits its
// string into runs with this.
export const DIGIT_RUN = /[0-9$%+−°]+(?:[.,   ][0-9]+)*/g;

export type Run = { text: string; digits: boolean };

export function splitDigits(s: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const m of s.matchAll(DIGIT_RUN)) {
    const at = m.index ?? 0;
    if (at > last) runs.push({ text: s.slice(last, at), digits: false });
    runs.push({ text: m[0], digits: true });
    last = at + m[0].length;
  }
  if (last < s.length) runs.push({ text: s.slice(last), digits: false });
  return runs;
}
