// Phase 121: the first run's pure rules. Run: pnpm --filter @workspace/quote-ai test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { elapsedLabel, examplesForTrades, parseJoinInput, EXAMPLE_KEYS, locksOnReturn, LOCK_AFTER_MS } from "./first-run";
import { isAppPath, isRootScreen } from "./native/routes";

test("a crew link, pasted any way the office sent it, opens the Now screen", () => {
  assert.deepEqual(parseJoinInput("https://quoteai.ca/t/AbC_d-123456789xyz"), { kind: "path", path: "/t/AbC_d-123456789xyz" });
  assert.deepEqual(parseJoinInput("  Your hours: quoteai.ca/t/AbC_d-123456789xyz thanks "), { kind: "path", path: "/t/AbC_d-123456789xyz" });
  assert.deepEqual(parseJoinInput("AbC_d-123456789xyzAbC"), { kind: "path", path: "/t/AbC_d-123456789xyzAbC" });
  assert.deepEqual(parseJoinInput("https://quoteai.ca/team-invite/tok_1234567890"), { kind: "path", path: "/team-invite/tok_1234567890" });
});

test("an access code is recognised with look-alike letters, spaces and case forgiven", () => {
  assert.deepEqual(parseJoinInput("7k3pq-9zx2m"), { kind: "code", code: "7K3PQ-9ZX2M" });
  assert.deepEqual(parseJoinInput("7K3PQ 9ZX2M"), { kind: "code", code: "7K3PQ-9ZX2M" });
  assert.deepEqual(parseJoinInput("OI3PQ-9ZX2L"), { kind: "code", code: "013PQ-9ZX21" });
  assert.deepEqual(parseJoinInput("https://quoteai.ca/join?code=7K3PQ-9ZX2M"), { kind: "code", code: "7K3PQ-9ZX2M" });
});

test("anything else is not guessed at", () => {
  assert.equal(parseJoinInput(""), null);
  assert.equal(parseJoinInput("hello"), null);
  assert.equal(parseJoinInput("7K3PQ-9ZX2"), null);
  assert.equal(parseJoinInput("https://example.com/some/page"), null);
});

test("the examples for the company's trades come first, none lost", () => {
  assert.deepEqual(examplesForTrades(["plumbing"]), ["plumber", "painter", "electrician", "renovation", "mason"]);
  assert.deepEqual(examplesForTrades(["concrete", "painting", "masonry"]), ["mason", "painter", "electrician", "plumber", "renovation"]);
  assert.deepEqual(examplesForTrades([]), [...EXAMPLE_KEYS]);
  assert.deepEqual(examplesForTrades(["cleaning", "other"]), [...EXAMPLE_KEYS]);
  assert.deepEqual(examplesForTrades(null), [...EXAMPLE_KEYS]);
});

test("time to the first quote reads like a person would say it", () => {
  const start = "2026-09-27T12:00:00.000Z";
  const at = (min: number) => Date.parse(start) + min * 60_000;
  assert.equal(elapsedLabel(start, at(0.2)), "1 min");
  assert.equal(elapsedLabel(start, at(4.4)), "4 min");
  assert.equal(elapsedLabel(start, at(65)), "1 h 5 min");
  assert.equal(elapsedLabel(start, at(120)), "2 h");
  assert.equal(elapsedLabel(start, at(60 * 30)), null, "days later is not a first run");
  assert.equal(elapsedLabel(null, at(3)), null);
  assert.equal(elapsedLabel(start, at(-5)), null);
});

test("the app locks again after five minutes away, and only when switched on", () => {
  assert.equal(locksOnReturn(true, LOCK_AFTER_MS - 1), false);
  assert.equal(locksOnReturn(true, LOCK_AFTER_MS), true);
  assert.equal(locksOnReturn(false, LOCK_AFTER_MS * 10), false);
});

test("the welcome is part of the app, and a screen Android back leaves from", () => {
  assert.ok(isAppPath("/welcome"));
  assert.ok(isAppPath("/welcome/crew"));
  assert.ok(isRootScreen("/welcome"));
  assert.ok(!isRootScreen("/welcome/crew"));
});

test("sign-in opened from the welcome goes back to it", () => {
  assert.ok(isRootScreen("/sign-in"));
  assert.ok(!isRootScreen("/sign-in", "?from=welcome"));
});
