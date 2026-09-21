import { describe, expect, test } from "vitest";
import { localDayFor, timeZoneForProvince, toIsoDate } from "./dates.js";

describe("localDayFor (Phase 66)", () => {
  test("an evening clock-in in Ottawa stays on the Ottawa calendar day", () => {
    // 20:18 EDT on Sept 20 = 00:18 UTC on Sept 21
    const instant = new Date("2026-09-21T00:18:00Z");
    expect(toIsoDate(localDayFor(instant, "ON"))).toBe("2026-09-20");
    expect(toIsoDate(localDayFor(instant, "QC"))).toBe("2026-09-20");
    expect(toIsoDate(localDayFor(instant, "BC"))).toBe("2026-09-20");
    // Newfoundland (UTC-2:30 in September) has already crossed midnight? 00:18 UTC = 21:48 NDT → still Sept 20
    expect(toIsoDate(localDayFor(instant, "NL"))).toBe("2026-09-20");
  });

  test("returns UTC midnight of that day (the `date` column convention)", () => {
    const d = localDayFor(new Date("2026-03-01T03:00:00Z"), "AB"); // 20:00 MST Feb 28
    expect(d.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  test("unknown provinces fall back to Toronto", () => {
    expect(timeZoneForProvince(null)).toBe("America/Toronto");
    expect(timeZoneForProvince("ZZ")).toBe("America/Toronto");
    expect(timeZoneForProvince("sk")).toBe("America/Regina");
  });
});
