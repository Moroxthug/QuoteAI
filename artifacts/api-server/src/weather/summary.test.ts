import { describe, expect, it } from "vitest";
import { MockWeatherProvider } from "./mock.js";
import { localDate, offsetLike, summarize } from "./summary.js";
import { isoOnTheHour, offsetMinutes, zonedIso } from "./time.js";
import type { Forecast } from "./types.js";

const TZ = "America/Toronto";
const fixed = () => new Date("2026-09-29T13:40:00Z"); // 9:40 am in Toronto

describe("zone helpers", () => {
  it("knows Toronto's offset in summer and winter", () => {
    expect(offsetMinutes(new Date("2026-09-29T12:00:00Z"), TZ)).toBe(-240);
    expect(offsetMinutes(new Date("2026-12-15T12:00:00Z"), TZ)).toBe(-300);
  });
  it("writes a wall-clock hour with its offset", () => {
    expect(zonedIso("2026-09-29", 7, TZ)).toBe("2026-09-29T07:00:00-04:00");
    expect(isoOnTheHour(new Date("2026-09-29T13:40:00Z"), TZ)).toBe("2026-09-29T09:00:00-04:00");
    expect(offsetLike(new Date("2026-09-29T18:00:00Z"), "2026-09-29T15:00:00-04:00")).toBe("2026-09-29T14:00:00-04:00");
  });
});

describe("the mock matches the board", () => {
  const mock = new MockWeatherProvider(fixed);
  it("Galloway Rd: 12 degrees, rain after 3 pm, plan exterior work before 14:00", async () => {
    const f = await mock.forecast(43.77, -79.23, TZ);
    expect(f.now.tempC).toBe(12);
    expect(f.hourly.map((h) => h.precipProb)).toEqual([0, 0, 5, 20, 70, 85, 60, 30]);
    const s = summarize(f, mock.now(TZ), TZ);
    expect(s).toEqual({ summaryKey: "rain_after", summaryAt: "2026-09-29T15:00:00-04:00", adviceKey: "exterior_before", adviceAt: "2026-09-29T14:00:00-04:00" });
  });
  it("Whitfield: 13 degrees and dry all day, a good day for exterior work", async () => {
    const f = await mock.forecast(43.65, -79.38, TZ);
    expect(f.now.tempC).toBe(13);
    expect(summarize(f, mock.now(TZ), TZ)).toMatchObject({ summaryKey: "dry_all_day", adviceKey: "good_exterior" });
  });
  it("rain on the 3rd and 4th day, as the board's week shows Thu and Fri", async () => {
    const f = await mock.forecast(43.77, -79.23, TZ);
    expect(f.daily7.filter((d) => d.precipProb >= 50).map((d) => d.date)).toEqual(["2026-10-01", "2026-10-02"]);
  });
});

describe("summarize", () => {
  const base = (probs: number[], type: "rain" | "snow" = "rain", temp = 12): Forecast => ({
    now: { tempC: temp, condition: "cloudy" },
    hourly: probs.map((p, i) => ({ hour: zonedIso("2026-09-29", 9 + i, TZ), tempC: temp, precipProb: p, precipType: p > 0 ? type : "none" })),
    daily7: [],
  });
  const at = (h: number, m = 0) => new Date(Date.parse(zonedIso("2026-09-29", h, TZ)) + m * 60_000);
  it("rain now ends later", () => {
    expect(summarize(base([80, 80, 20, 0, 0]), at(9, 30), TZ)).toMatchObject({ summaryKey: "rain_now", summaryAt: "2026-09-29T11:00:00-04:00", adviceKey: "exterior_after" });
  });
  it("rain in every remaining hour is all day", () => {
    expect(summarize(base([90, 90, 90, 90]), at(9, 30), TZ)).toMatchObject({ summaryKey: "rain_all_day", adviceKey: "inside_only" });
  });
  it("snow later, with the advice an hour before", () => {
    expect(summarize(base([0, 0, 60, 70], "snow", -2), at(9, 30), TZ)).toMatchObject({ summaryKey: "snow_after", summaryAt: "2026-09-29T11:00:00-04:00", adviceAt: "2026-09-29T10:00:00-04:00" });
  });
  it("dry and at or under freezing", () => {
    expect(summarize(base([0, 0, 0], "rain", -4), at(9, 30), TZ)).toMatchObject({ summaryKey: "freezing", adviceKey: null });
  });
  it("only today's hours count", () => {
    const f = base([0, 0]);
    f.hourly.push({ hour: zonedIso("2026-09-30", 9, TZ), tempC: 10, precipProb: 90, precipType: "rain" });
    expect(summarize(f, at(9, 30), TZ).summaryKey).toBe("dry_all_day");
    expect(localDate(at(9), TZ)).toBe("2026-09-29");
  });
});
