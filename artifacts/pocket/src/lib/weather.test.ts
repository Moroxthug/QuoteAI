import assert from "node:assert/strict";
import { test } from "node:test";
import { adviceWords, clockText, glyphOf, hourText, isOld, primaryOf, rainBars, summaryWords, tempText, twoHourSlots, viewOf, weekDays, weekPlan, type Site, type WeatherToday } from "./weather.ts";

const mk = (probs: number[], temps: number[], hours: number[]) => hours.map((h, i) => ({ hour: `2026-09-29T${String(h).padStart(2, "0")}:00:00-04:00`, tempC: temps[i]!, precipProb: probs[i]!, precipType: probs[i]! > 0 ? "rain" as const : "none" as const }));
const galloway: Site = {
  siteId: "g", name: "Galloway Rd basement", area: "Scarborough", crewCount: 2, now: { tempC: 12, condition: "cloudy" },
  hourly: mk([0, 0, 5, 20, 70, 85, 60, 30], [11, 12, 13, 13, 12, 11, 10, 9], [7, 9, 11, 13, 15, 17, 19, 21]),
  daily7: [30, 20, 80, 90, 10, 0, 30].map((p, i) => ({ date: `2026-09-${29 + i > 30 ? "0" : ""}${29 + i > 30 ? 29 + i - 30 : 29 + i}`, precipProb: p, precipType: "rain" as const, visits: [3, 3, 2, 2, 1, 0, 3][i]! })).map((d, i) => ({ ...d, date: ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"][i]! })),
  summaryKey: "rain_after", summaryAt: "2026-09-29T15:00:00-04:00", adviceKey: "exterior_before", adviceAt: "2026-09-29T14:00:00-04:00",
};

test("temperatures use the real minus and whole degrees", () => {
  assert.equal(tempText(12), "12°");
  assert.equal(tempText(-4), "−4°");
  assert.equal(tempText(0.4), "0°");
});

test("hours read in the company's own clock, 3 pm and 15 h, never 15:00 in the header", () => {
  assert.equal(hourText("2026-09-29T15:00:00-04:00", "en-CA"), "3 pm");
  assert.equal(hourText("2026-09-29T15:00:00-04:00", "fr-CA"), "15 h");
  assert.equal(hourText("2026-09-29T00:00:00-04:00", "en-CA"), "12 am");
  assert.equal(clockText("2026-09-29T14:00:00-04:00", "en-CA"), "14:00");
  assert.equal(clockText("2026-09-29T14:00:00-04:00", "fr-CA"), "14 h");
});

test("the words are keys with a time", () => {
  assert.deepEqual(summaryWords(galloway, "en-CA"), { key: "sum.rain_after", vars: { time: "3 pm" } });
  assert.deepEqual(adviceWords(galloway, "en-CA"), { key: "adv.exterior_before", vars: { time: "14:00" } });
  assert.equal(adviceWords({ adviceKey: null, adviceAt: null }, "en-CA"), null);
});

test("the 8 bars are the board's: height from the chance, opacity .25 to 1", () => {
  const bars = rainBars(galloway, "2026-09-29");
  assert.equal(bars.length, 8);
  assert.deepEqual(bars.map((b) => b.prob), [0, 0, 5, 20, 70, 85, 60, 30]);
  assert.equal(bars[0]!.height, 3);
  assert.equal(bars[5]!.height, Math.round(0.85 * 34));
  assert.equal(bars[5]!.opacity, 0.89);
});

test("more than 8 hours are spread evenly, and only the working day counts", () => {
  const hourly = mk(Array(24).fill(10), Array(24).fill(10), Array.from({ length: 24 }, (_, i) => i));
  assert.equal(rainBars({ hourly }, "2026-09-29").length, 8);
});

test("the expanded card has six two-hour slots from 7 am and marks 50 % or more", () => {
  const s = twoHourSlots(galloway, "2026-09-29");
  assert.equal(s.length, 6);
  assert.deepEqual(s.map((x) => x.label), ["7", "9", "11", "13", "15", "17"]);
  assert.deepEqual(s.map((x) => x.wet), [false, false, false, false, true, true]);
  assert.equal(s[4]!.temp, "12°");
});

test("This week: weekday, date, visit dots (3 at most) and a drop on rain days", () => {
  const d = weekDays(galloway, "en-CA");
  assert.equal(d.length, 7);
  assert.equal(d[0]!.dow, "Tue");
  assert.equal(d[0]!.date, 29);
  assert.equal(d[0]!.today, true);
  assert.deepEqual(d.map((x) => x.rain), [false, false, true, true, false, false, false]);
  assert.deepEqual(d.map((x) => x.dots), [3, 3, 2, 2, 1, 0, 3]);
  assert.equal(weekDays(galloway, "fr-CA")[2]!.dow, "jeu");
});

test("the best dry day is the least wet one before the rain: Wed, as the board says", () => {
  const p = weekPlan(weekDays(galloway, "en-CA"));
  assert.deepEqual(p.rainDays, ["2026-10-01", "2026-10-02"]);
  assert.equal(p.best, "2026-09-30");
  assert.equal(weekPlan([{ iso: "a", prob: 80 }, { iso: "b", prob: 90 }]).best, null);
  assert.equal(weekPlan([{ iso: "a", prob: 30 }, { iso: "b", prob: 10 }, { iso: "c", prob: 20 }]).best, "b");
});

test("a condition has one glyph, rain draws drops", () => {
  assert.deepEqual(glyphOf("clear"), { glyph: "sun", wet: false });
  assert.deepEqual(glyphOf("cloudy"), { glyph: "cloud", wet: false });
  assert.deepEqual(glyphOf("showers"), { glyph: "cloudRain", wet: true });
});

test("the state: loading, loaded, stale under 6 hours, unavailable", () => {
  const w: WeatherToday = { fetchedAt: "2026-09-29T13:00:00Z", primarySiteId: "g", sites: [galloway], provider: "mock", attribution: null };
  const now = 1_000_000_000_000;
  assert.equal(viewOf({ fetching: true, data: null, fromCache: false, savedAt: null, now }), "loading");
  assert.equal(viewOf({ fetching: false, data: w, fromCache: false, savedAt: null, now }), "loaded");
  assert.equal(viewOf({ fetching: false, data: w, fromCache: true, savedAt: now - 5 * 3_600_000, now }), "stale");
  assert.equal(viewOf({ fetching: false, data: w, fromCache: true, savedAt: now - 7 * 3_600_000, now }), "unavailable");
  assert.equal(viewOf({ fetching: false, data: null, fromCache: false, savedAt: null, now }), "unavailable");
  assert.equal(primaryOf(w)?.siteId, "g");
});

test("an answer older than 30 minutes is asked for again", () => {
  assert.equal(isOld("2026-09-29T13:00:00Z", Date.parse("2026-09-29T13:29:00Z")), false);
  assert.equal(isOld("2026-09-29T13:00:00Z", Date.parse("2026-09-29T13:31:00Z")), true);
});
