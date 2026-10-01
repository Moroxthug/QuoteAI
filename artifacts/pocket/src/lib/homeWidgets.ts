// The Home widgets' rules (HOME-WIDGETS-SPEC.md), pure so they are tested (homeWidgets.test.ts).
import { quoteState, type QuoteLike } from "./quotes.ts";

export type Spark = { line: string; area: string; end: { x: number; y: number } };

/** A smooth-ish polyline through the values (oldest first) inside width x height, `pad` clear on every side. */
export function sparkPath(values: number[], width: number, height: number, pad = 4): Spark | null {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: pad + (i * (width - 2 * pad)) / (values.length - 1),
    y: height - pad - ((v - min) / span) * (height - 2 * pad),
  }));
  // Catmull-Rom to cubic Bezier for a soft line.
  let d = `M${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1]!;
  return { line: d, area: `${d} L${last.x.toFixed(1)} ${height} L${pts[0]!.x.toFixed(1)} ${height} Z`, end: last };
}

/** The change against the period before, in whole percent; null when there is nothing to compare with. */
export function changePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export type Collected = { currentCents: number; previousCents: number; series: number[] };

export function collectedOf(buckets: { collectedCents: number }[]): Collected {
  const v = buckets.map((b) => b.collectedCents);
  return { currentCents: v[v.length - 1] ?? 0, previousCents: v[v.length - 2] ?? 0, series: v };
}

export type Split = { notDueCents: number; overdueCents: number; /** The not-yet-due share, 0 to 1. */ ratio: number };

export function outstandingSplit(balanceCents: number, overdueCents: number): Split {
  const overdue = Math.min(Math.max(overdueCents, 0), Math.max(balanceCents, 0));
  const notDue = Math.max(balanceCents, 0) - overdue;
  return { notDueCents: notDue, overdueCents: overdue, ratio: balanceCents > 0 ? notDue / balanceCents : 1 };
}

export type Pipeline = { drafts: number; sent: number; viewed: number; won: number };

/** Drafts, Sent (waiting, not opened), Viewed (opened, waiting) and Won this month. */
export function pipeline(quotes: QuoteLike[], now: Date): Pipeline {
  const out: Pipeline = { drafts: 0, sent: 0, viewed: 0, won: 0 };
  for (const q of quotes) {
    const s = quoteState(q, now);
    if (s === "draft") out.drafts++;
    else if (s === "sent" || s === "expiring") out.sent++;
    else if (s === "viewed") out.viewed++;
    else if (s === "accepted" && q.acceptedAt) {
      const d = new Date(q.acceptedAt);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) out.won++;
    }
  }
  return out;
}

/** The newest thing a client did on a quote: opened it, accepted it or declined it, with when. */
export function latestClientActivity(quotes: QuoteLike[]): { kind: "viewed" | "accepted" | "declined"; client: string; at: Date } | null {
  let best: { kind: "viewed" | "accepted" | "declined"; client: string; at: Date } | null = null;
  const take = (kind: "viewed" | "accepted" | "declined", iso: string | null | undefined, client: string) => {
    if (!iso) return;
    const at = new Date(iso);
    if (!best || at > best.at) best = { kind, client, at };
  };
  for (const q of quotes) {
    take("viewed", q.firstViewedAt, q.clientData.nome);
    take("accepted", q.acceptedAt, q.clientData.nome);
    take("declined", q.declinedAt, q.clientData.nome);
  }
  return best;
}

/** "2 h ago" parts: whole minutes, hours or days since `at`. */
export function ago(at: Date, now: Date): { unit: "min" | "h" | "d"; n: number } {
  const mins = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  if (mins < 60) return { unit: "min", n: Math.max(1, mins) };
  if (mins < 60 * 24) return { unit: "h", n: Math.round(mins / 60) };
  return { unit: "d", n: Math.round(mins / 1440) };
}
