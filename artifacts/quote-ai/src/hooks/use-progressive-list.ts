import { useEffect, useState } from "react";

// Phase 115 (docs/APP-PLAN.md "Instant": lists past ~50 rows): a list with no
// pagination renders its first rows in the same frame as the page, then the
// rest in idle-time slices, so a company with 2,000 quotes opens the list as
// fast as one with 20. Phone rows are also skipped off screen by the browser
// (content-visibility on `.lrows > li`, mockup-system.css); a <table> row
// can't be contained, so for tables this is the whole treatment. No
// virtualisation library: every row still ends up in the DOM, so find-in-page,
// the screen reader's list count and "Showing N of M" stay true.

type IdleHandle = number;
const requestIdle: (cb: () => void) => IdleHandle =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 400 })
    : (cb) => window.setTimeout(cb, 40);
const cancelIdle: (h: IdleHandle) => void =
  typeof window !== "undefined" && "cancelIdleCallback" in window ? (h) => window.cancelIdleCallback(h) : (h) => window.clearTimeout(h);

/** The first `first` rows now, `step` more per idle slice until all are shown. */
export function useProgressiveList<T>(rows: T[], first = 50, step = 250): T[] {
  const [limit, setLimit] = useState(first);
  const more = rows.length > limit;
  useEffect(() => {
    if (!more) return;
    const h = requestIdle(() => setLimit((l) => l + step));
    return () => cancelIdle(h);
  }, [more, limit, step]);
  return more ? rows.slice(0, limit) : rows;
}
