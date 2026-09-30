import { test } from "node:test";
import assert from "node:assert/strict";
import { money, shortDate, time } from "./format.ts";

// fr-CA thousands: COMPONENTS §1 says a narrow no-break space, CLDR's fr-CA gives a no-break
// space. The rule is "use Intl, never build the string", so either passes.
const SPACE = "[  ]";

test("money: en-CA and fr-CA", () => {
  assert.equal(money(4131.05, "en-CA"), "$4,131.05");
  assert.match(money(4131.05, "fr-CA"), new RegExp(`^4${SPACE}131,05 \\$$`));
});

test("dates and times", () => {
  const d = new Date(2026, 8, 29, 14, 30);
  assert.equal(shortDate(d, "en-CA"), "Sep 29");
  assert.equal(shortDate(d, "fr-CA"), "29 sept.");
  assert.match(time(d, "fr-CA"), /^14\s?h\s?30$/);
});
