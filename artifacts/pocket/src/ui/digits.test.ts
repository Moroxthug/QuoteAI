import { test } from "node:test";
import assert from "node:assert/strict";
import { splitDigits } from "./digits.ts";

const digits = (s: string) => splitDigits(s).filter((r) => r.digits).map((r) => r.text);

test("digits inside a sentence are their own runs", () => {
  assert.deepEqual(splitDigits("Sent 6 days ago"), [
    { text: "Sent ", digits: false },
    { text: "6", digits: true },
    { text: " days ago", digits: false },
  ]);
});

// The handoff's pattern: a separator only joins when digits follow it, so fr-CA's "$" after
// the no-break space is its own (Manrope) run.
test("money in both locales", () => {
  assert.deepEqual(digits("Total $4,131.05 due"), ["$4,131.05"]);
  assert.deepEqual(digits("Total 4 131,05 $ dû"), ["4 131,05", "$"]);
});

test("percent, minus, degrees, times", () => {
  assert.deepEqual(digits("HST 13% · −5° · 14 h 30"), ["13%", "−5°", "14", "30"]);
});

test("no digits: one word run", () => {
  assert.deepEqual(splitDigits("Clients"), [{ text: "Clients", digits: false }]);
});
