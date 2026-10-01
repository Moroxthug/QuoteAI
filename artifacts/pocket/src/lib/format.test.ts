import { test } from "node:test";
import assert from "node:assert/strict";
import { dayDate, money, shortDate, splitMoney, time } from "./format.ts";

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
  assert.equal(dayDate(d, "en-CA"), "Tue Sep 29");
  assert.equal(dayDate(d, "fr-CA"), "mar. 29 sept.");
  assert.match(time(d, "fr-CA"), /^14\s?h\s?30$/);
});

test("sentence: one full stop after a.m.", async () => {
  const { sentence } = await import("./format.ts");
  assert.equal(sentence("Twice today, last at 9:12 a.m.."), "Twice today, last at 9:12 a.m.");
  assert.equal(sentence("Done."), "Done.");
});

test("relativeWhen: minutes, hours, today, yesterday, weekday, date", async () => {
  const { relativeWhen } = await import("./format.ts");
  const now = new Date(2026, 8, 29, 15, 0); // Tue Sep 29, 3 pm
  assert.equal(relativeWhen(new Date(2026, 8, 29, 14, 48), now, "en-CA"), "12 min ago");
  assert.equal(relativeWhen(new Date(2026, 8, 29, 13, 0), now, "en-CA"), "2 h ago");
  assert.equal(relativeWhen(new Date(2026, 8, 29, 13, 0), now, "fr-CA"), "il y a 2 h");
  assert.equal(relativeWhen(new Date(2026, 8, 29, 1, 0), now, "en-CA"), "today");
  assert.equal(relativeWhen(new Date(2026, 8, 28, 20, 0), now, "fr-CA"), "hier");
  assert.equal(relativeWhen(new Date(2026, 8, 28, 20, 0), now, "en-CA"), "yesterday");
  assert.equal(relativeWhen(new Date(2026, 8, 25, 9, 0), now, "en-CA"), "Fri");
  assert.equal(relativeWhen(new Date(2026, 8, 12, 9, 0), now, "en-CA"), "Sep 12");
  assert.equal(relativeWhen(new Date(2026, 8, 12, 9, 0), now, "fr-CA"), "12 sept.");
});

test("a date range drops the repeated month", async () => {
  const { dateRange } = await import("./format.ts");
  const d = (m: number, day: number) => new Date(2026, m - 1, day, 12);
  assert.equal(dateRange(d(10, 5), d(10, 7), "en-CA"), "Oct 5 – 7");
  assert.equal(dateRange(d(10, 5), d(10, 7), "fr-CA"), "5 – 7 oct.");
  assert.equal(dateRange(d(10, 30), d(11, 2), "en-CA"), "Oct 30 – Nov 2");
  assert.equal(dateRange(d(10, 5), d(10, 5), "en-CA"), "Oct 5");
});

test("splitMoney: the cents come apart from the rest", () => {
  const en = splitMoney(6212, "en-CA");
  assert.equal(en.whole + en.cents, money(6212, "en-CA"));
  assert.equal(en.cents, ".00");
  const fr = splitMoney(6212, "fr-CA");
  assert.equal(fr.whole + fr.cents, money(6212, "fr-CA"));
  assert.ok(fr.cents.startsWith(",00"));
  assert.ok(!fr.whole.includes(","));
});
