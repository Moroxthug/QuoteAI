import { describe, expect, test } from "vitest";
import { localToday, touchesLocalDay } from "./service.js";

// Phase 86: "today" on the worker page and the foreman's day is the company's
// local day, while blocks are stored as UTC instants.

const block = (startsAt: string, endsAt: string) => ({ startsAt: new Date(startsAt), endsAt: new Date(endsAt) });

describe("touchesLocalDay", () => {
  test("a Vancouver evening shift is on its local day, not on the UTC date it spills into", () => {
    // 17:00-21:00 PDT on 2026-09-22 = 00:00-04:00 UTC on the 23rd.
    const b = block("2026-09-23T00:00:00Z", "2026-09-23T04:00:00Z");
    expect(touchesLocalDay(b, "2026-09-22", "BC")).toBe(true);
    expect(touchesLocalDay(b, "2026-09-23", "BC")).toBe(false);
  });

  test("a block ending exactly at local midnight does not reach the next day", () => {
    // 08:00-24:00 EDT on 2026-09-22.
    const b = block("2026-09-22T12:00:00Z", "2026-09-23T04:00:00Z");
    expect(touchesLocalDay(b, "2026-09-22", "ON")).toBe(true);
    expect(touchesLocalDay(b, "2026-09-23", "ON")).toBe(false);
  });

  test("a multi-day block covers every day in between", () => {
    const b = block("2026-09-21T12:00:00Z", "2026-09-24T20:00:00Z");
    for (const d of ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]) expect(touchesLocalDay(b, d, "QC")).toBe(true);
    expect(touchesLocalDay(b, "2026-09-25", "QC")).toBe(false);
    expect(touchesLocalDay(b, "2026-09-20", "QC")).toBe(false);
  });
});

describe("localToday", () => {
  test("is the province's date, not the server's", () => {
    const lateEvening = new Date("2026-09-23T03:30:00Z"); // 20:30 PDT / 23:30 EDT on the 22nd
    expect(localToday("BC", lateEvening)).toBe("2026-09-22");
    expect(localToday("ON", lateEvening)).toBe("2026-09-22");
    expect(localToday("NS", lateEvening)).toBe("2026-09-23"); // 00:30 ADT
  });
});
