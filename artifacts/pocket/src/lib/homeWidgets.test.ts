import assert from "node:assert/strict";
import { test } from "node:test";
import { ago, changePercent, collectedOf, latestClientActivity, outstandingSplit, pipeline, sparkPath } from "./homeWidgets.ts";
import type { QuoteLike } from "./quotes.ts";

const now = new Date("2026-09-29T15:00:00Z");
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
const q = (o: Partial<QuoteLike> = {}): QuoteLike => ({ id: "1", status: "draft", totale: 100, createdAt: iso(5), updatedAt: iso(1), clientData: { nome: "Priya Nair" }, ...o });

test("sparkline", () => {
  assert.equal(sparkPath([1], 100, 40), null);
  const s = sparkPath([1, 3, 2, 5], 310, 72, 4)!;
  assert.ok(s.line.startsWith("M4.0 "));
  assert.equal(s.end.x, 306);
  assert.equal(s.end.y, 4); // the highest value sits at the top pad
  assert.ok(s.area.endsWith("Z"));
  assert.ok(sparkPath([2, 2, 2], 100, 40)); // a flat line does not divide by zero
});

test("change", () => {
  assert.equal(changePercent(112, 100), 12);
  assert.equal(changePercent(50, 100), -50);
  assert.equal(changePercent(10, 0), null);
});

test("collected", () => {
  const c = collectedOf([{ collectedCents: 100 }, { collectedCents: 300 }, { collectedCents: 450 }]);
  assert.deepEqual(c, { currentCents: 450, previousCents: 300, series: [100, 300, 450] });
  assert.deepEqual(collectedOf([]), { currentCents: 0, previousCents: 0, series: [] });
});

test("outstanding split", () => {
  assert.deepEqual(outstandingSplit(987000, 234000), { notDueCents: 753000, overdueCents: 234000, ratio: 753000 / 987000 });
  assert.equal(outstandingSplit(0, 0).ratio, 1);
  assert.equal(outstandingSplit(100, 500).overdueCents, 100);
});

test("pipeline", () => {
  const p = pipeline([
    q({ id: "a" }),
    q({ id: "b", sentAt: iso(2) }),
    q({ id: "c", sentAt: iso(3), firstViewedAt: iso(1) }),
    q({ id: "d", sentAt: iso(10), acceptedAt: iso(2), status: "accepted" }),
    q({ id: "e", sentAt: iso(60), acceptedAt: iso(50), status: "accepted" }),
    q({ id: "f", sentAt: iso(5), declinedAt: iso(1) }),
  ], now);
  assert.deepEqual(p, { drafts: 1, sent: 1, viewed: 1, won: 1 });
});

test("latest client activity", () => {
  const a = latestClientActivity([
    q({ clientData: { nome: "Priya" }, firstViewedAt: iso(2) }),
    q({ clientData: { nome: "Hart" }, acceptedAt: iso(1) }),
    q({ clientData: { nome: "Chen" }, declinedAt: iso(3) }),
  ]);
  assert.equal(a?.client, "Hart");
  assert.equal(a?.kind, "accepted");
  assert.equal(latestClientActivity([q()]), null);
});

test("how long ago", () => {
  assert.deepEqual(ago(new Date(now.getTime() - 30_000), now), { unit: "min", n: 1 });
  assert.deepEqual(ago(new Date(now.getTime() - 2 * 3_600_000), now), { unit: "h", n: 2 });
  assert.deepEqual(ago(new Date(now.getTime() - 3 * 86_400_000), now), { unit: "d", n: 3 });
});
