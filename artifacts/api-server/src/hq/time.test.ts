import { describe, expect, it } from "vitest";
import { addDays, bucketSpan, bucketStart, bucketStarts, daysInclusive, makeRange, parseRange, torontoDate, torontoDayStart } from "./time";

describe("Toronto time", () => {
  it("day start follows daylight saving", () => {
    expect(torontoDayStart("2026-01-15").toISOString()).toBe("2026-01-15T05:00:00.000Z"); // EST
    expect(torontoDayStart("2026-07-15").toISOString()).toBe("2026-07-15T04:00:00.000Z"); // EDT
    expect(torontoDayStart("2026-03-08").toISOString()).toBe("2026-03-08T05:00:00.000Z"); // spring-forward day starts in EST
    expect(torontoDayStart("2026-03-09").toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(torontoDayStart("2026-11-01").toISOString()).toBe("2026-11-01T04:00:00.000Z"); // fall-back day starts in EDT
  });
  it("an evening in Toronto is still that day, though UTC has rolled over", () => {
    expect(torontoDate(new Date("2026-10-20T02:30:00Z"))).toBe("2026-10-19");
    expect(torontoDate(new Date("2026-10-20T04:30:00Z"))).toBe("2026-10-20");
  });
  it("range end is the exclusive start of the next day", () => {
    const r = makeRange("2026-03-07", "2026-03-08");
    expect(r.days).toBe(2);
    expect(r.endAt.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });
  it("buckets: weeks start Monday, months on the 1st", () => {
    expect(bucketStart("2026-10-19", "week")).toBe("2026-10-19"); // a Monday
    expect(bucketStart("2026-10-18", "week")).toBe("2026-10-12");
    expect(bucketStart("2026-10-19", "month")).toBe("2026-10-01");
    expect(bucketStarts("2026-10-18", "2026-10-26", "week")).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(bucketStarts("2026-11-15", "2027-01-02", "month")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
    expect(bucketStarts("2026-10-30", "2026-11-01", "day")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });
  it("bucket span is clipped to the range", () => {
    expect(bucketSpan("2026-10-12", "week", "2026-10-14", "2026-10-30")).toEqual({ start: "2026-10-14", end: "2026-10-18", days: 5 });
    expect(bucketSpan("2026-10-26", "week", "2026-10-14", "2026-10-28")).toEqual({ start: "2026-10-26", end: "2026-10-28", days: 3 });
  });
  it("date arithmetic", () => {
    expect(addDays("2028-02-28", 2)).toBe("2028-03-01");
    expect(daysInclusive("2026-10-01", "2026-10-31")).toBe(31);
  });
  it("parses the query: defaults, bad dates, order, size", () => {
    const now = new Date("2026-10-19T15:00:00Z");
    expect(parseRange({}, now)).toMatchObject({ from: "2026-09-20", to: "2026-10-19", days: 30 });
    expect(parseRange({ from: "nope" }, now)).toMatch(/from/);
    expect(parseRange({ from: "2026-02-30" }, now)).toMatch(/from/);
    expect(parseRange({ from: "2026-10-20", to: "2026-10-19" }, now)).toMatch(/after/);
    expect(parseRange({ from: "2020-01-01", to: "2026-10-19" }, now)).toMatch(/limited/);
  });
});
