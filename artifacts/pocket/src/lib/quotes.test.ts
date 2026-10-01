import assert from "node:assert/strict";
import { test } from "node:test";
import { activityAt, daysLeft, glance, groupOf, jobLine, matchesFilter, matchesSearch, quoteState, validUntil, type QuoteLike } from "./quotes.ts";

const now = new Date("2026-09-29T15:00:00Z");
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
const q = (o: Partial<QuoteLike> = {}): QuoteLike => ({ id: "1", status: "draft", totale: 100, createdAt: iso(5), updatedAt: iso(1), clientData: { nome: "Priya Nair", indirizzo: "212 Dovercourt Rd" }, ...o });

test("a quote that was never sent is a draft", () => assert.equal(quoteState(q(), now), "draft"));
test("sent and inside its 30 days is sent", () => assert.equal(quoteState(q({ sentAt: iso(4) }), now), "sent"));
test("the last 3 days are expiring", () => assert.equal(quoteState(q({ sentAt: iso(28) }), now), "expiring"));
test("past 30 days is expired", () => assert.equal(quoteState(q({ sentAt: iso(31) }), now), "expired"));
test("opened by the client is viewed", () => assert.equal(quoteState(q({ sentAt: iso(4), firstViewedAt: iso(3) }), now), "viewed"));
test("expiring beats viewed", () => assert.equal(quoteState(q({ sentAt: iso(28), firstViewedAt: iso(20) }), now), "expiring"));
test("declined", () => assert.equal(quoteState(q({ sentAt: iso(4), declinedAt: iso(1) }), now), "declined"));
test("validDays moves the expiry", () => {
  assert.equal(quoteState(q({ sentAt: iso(10), validDays: 7 }), now), "expired");
  assert.equal(quoteState(q({ sentAt: iso(5), validDays: 7 }), now), "expiring");
  assert.equal(validUntil(iso(0), 14).getTime() - now.getTime(), 14 * 86_400_000);
});
test("accepted wins over everything", () => assert.equal(quoteState(q({ status: "accepted", sentAt: iso(60), acceptedAt: iso(50) }), now), "accepted"));
test("acceptedAt alone also means accepted", () => assert.equal(quoteState(q({ acceptedAt: iso(2) }), now), "accepted"));

test("filters", () => {
  assert.ok(matchesFilter("expiring", "waiting"));
  assert.ok(matchesFilter("sent", "waiting"));
  assert.ok(!matchesFilter("draft", "waiting"));
  assert.ok(matchesFilter("expired", "closed"));
  assert.ok(matchesFilter("declined", "closed"));
  assert.ok(matchesFilter("viewed", "waiting"));
  assert.ok(matchesFilter("accepted", "all"));
});

test("search covers client, job, number and address", () => {
  const x = q({ title: "Kitchen backsplash", numeroPreventivoData: "Q-2026-118" });
  assert.ok(matchesSearch(x, "priya"));
  assert.ok(matchesSearch(x, "BACKSPLASH"));
  assert.ok(matchesSearch(x, "2026-118"));
  assert.ok(matchesSearch(x, "dovercourt"));
  assert.ok(!matchesSearch(x, "deck"));
  assert.ok(matchesSearch(x, "  "));
});

test("the job line skips the default heading", () => {
  assert.equal(jobLine({ title: "Project Quote & Itemized Estimate", descrizioneGenerale: "Deck refinish\nsecond line" }), "Deck refinish");
  assert.equal(jobLine({ title: "Hallway flooring", descrizioneGenerale: "x" }), "Hallway flooring");
});

test("week and earlier", () => {
  assert.equal(groupOf({ updatedAt: iso(2) }, now), "week");
  assert.equal(groupOf({ updatedAt: iso(2), sentAt: iso(10) }, now), "earlier");
  assert.equal(activityAt({ updatedAt: iso(2), sentAt: iso(10), acceptedAt: iso(1) }).toISOString(), iso(1));
});

test("the glance figures", () => {
  const g = glance([
    q({ id: "a", sentAt: iso(2), totale: 1000 }),
    q({ id: "b", sentAt: iso(28), totale: 500 }),
    q({ id: "c", status: "accepted", sentAt: iso(9), acceptedAt: iso(1), totale: 2000 }),
    q({ id: "d", sentAt: iso(40), totale: 300 }),
    q({ id: "e", sentAt: iso(10), declinedAt: iso(5), totale: 100 }),
  ], now);
  assert.equal(g.waitingTotal, 1500);
  assert.equal(g.waitingCount, 2);
  assert.equal(g.expiring, 1);
  assert.equal(g.wonTotal, 2000);
  assert.equal(g.wonCount, 1);
  assert.equal(g.winRate, 1 / 3);
  assert.equal(glance([], now).winRate, null);
});

test("days left", () => {
  assert.equal(daysLeft(validUntil(iso(28)), now), 2);
  assert.equal(daysLeft(new Date(now.getTime() - 1000), now), 0);
});
