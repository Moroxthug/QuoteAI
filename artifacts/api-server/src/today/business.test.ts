import { describe, expect, it } from "vitest";
import { localMidnight, periodStarts } from "./business.js";

describe("periodStarts", () => {
  it("weeks start on Monday, the current one last", () => {
    // Tuesday 29 Sep 2026
    expect(periodStarts("W", "2026-09-29")).toEqual({
      starts: ["2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"],
      end: "2026-10-05",
    });
    // A Sunday belongs to the week that began the Monday before.
    expect(periodStarts("W", "2026-10-04").starts.at(-1)).toBe("2026-09-28");
  });
  it("six months, across a year", () => {
    expect(periodStarts("M", "2026-02-15")).toEqual({ starts: ["2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"], end: "2026-03-01" });
  });
  it("four quarters", () => {
    expect(periodStarts("Q", "2026-09-29")).toEqual({ starts: ["2025-10-01", "2026-01-01", "2026-04-01", "2026-07-01"], end: "2026-10-01" });
  });
});

describe("localMidnight", () => {
  it("is the zone's midnight, summer and winter", () => {
    expect(localMidnight("2026-09-29", "America/Toronto").toISOString()).toBe("2026-09-29T04:00:00.000Z");
    expect(localMidnight("2026-01-15", "America/Toronto").toISOString()).toBe("2026-01-15T05:00:00.000Z");
    expect(localMidnight("2026-07-01", "America/Vancouver").toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(localMidnight("2026-03-08", "America/St_Johns").toISOString()).toBe("2026-03-08T03:30:00.000Z");
  });
});
