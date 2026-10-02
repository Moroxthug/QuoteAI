import assert from "node:assert/strict";
import { test } from "node:test";
import { ampFor, firstWords, lastReply, moodAt, words } from "./assistantChat.ts";

test("busy wins, then muted, then the voice cycle", () => {
  assert.equal(moodAt(0, { voice: true, muted: true, busy: "think" }), "think");
  assert.equal(moodAt(0, { voice: true, muted: true, busy: null }), "mute");
  assert.equal(moodAt(0, { voice: false, muted: false, busy: null }), "idle");
  assert.equal(moodAt(1, { voice: true, muted: false, busy: null }), "listen");
  assert.equal(moodAt(4, { voice: true, muted: false, busy: null, cycle: true }), "think");
  assert.equal(moodAt(6, { voice: true, muted: false, busy: null, cycle: true }), "speak");
});

test("the swell stays in range", () => {
  for (const m of ["listen", "think", "speak", "idle", "mute"] as const) for (let t = 0; t < 10; t += 0.13) { const a = ampFor(m, t); assert.ok(a >= 0 && a <= 1, `${m} ${t} ${a}`); }
});

test("a reply is shown word by word", () => {
  assert.deepEqual(words("  one two  three "), ["one", "two", "three"]);
  assert.equal(firstWords("one two three", 2), "one two");
  assert.equal(firstWords("one two", 0), "");
});

test("the last assistant text is the reply", () => {
  assert.equal(lastReply([{ role: "user", content: "hi" }, { role: "assistant", content: "Hello." }, { role: "tool", content: "x" }]), "Hello.");
  assert.equal(lastReply([{ role: "assistant", content: null }]), "");
});
