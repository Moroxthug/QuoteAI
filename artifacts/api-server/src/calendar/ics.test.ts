// Phase 85 — the iCalendar parser and writer.
//
// These are the parts with no network and no database, and the parts most
// likely to meet a feed that does something slightly different from the last
// one, so they are unit-tested against the shapes real feeds emit.

import { describe, test, expect } from "vitest";
import { buildIcs, expandRecurrence, parseIcs } from "./ics.js";

const WINDOW_FROM = new Date("2026-09-01T00:00:00.000Z");
const WINDOW_TO = new Date("2026-12-01T00:00:00.000Z");

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\n${body}\r\nEND:VCALENDAR\r\n`;

describe("parseIcs", () => {
  test("a timed event with a TZID, and an all-day event", () => {
    const events = parseIcs(
      wrap(
        [
          "BEGIN:VEVENT",
          "UID:timed-1",
          "SUMMARY:Site visit — 44 Bloor",
          "LOCATION:44 Bloor St W",
          "DTSTART;TZID=America/Toronto:20260930T090000",
          "DTEND;TZID=America/Toronto:20260930T103000",
          "END:VEVENT",
          "BEGIN:VEVENT",
          "UID:allday-1",
          "SUMMARY:Statutory holiday",
          "DTSTART;VALUE=DATE:20261012",
          "DTEND;VALUE=DATE:20261013",
          "END:VEVENT",
        ].join("\r\n"),
      ),
      WINDOW_FROM,
      WINDOW_TO,
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ uid: "timed-1", title: "Site visit — 44 Bloor", location: "44 Bloor St W", allDay: false, busy: true });
    expect(events[0]!.endsAt.getTime() - events[0]!.startsAt.getTime()).toBe(90 * 60_000);
    expect(events[1]).toMatchObject({ uid: "allday-1", allDay: true });
  });

  test("folded lines, escaped text, and DURATION instead of DTEND", () => {
    const events = parseIcs(
      wrap(
        [
          "BEGIN:VEVENT",
          "UID:folded-1",
          "SUMMARY:Kitchen reno walkthrough with Mr Smith\\, then the",
          "  inspector",
          "DTSTART:20260915T140000Z",
          "DURATION:PT2H",
          "END:VEVENT",
        ].join("\r\n"),
      ),
      WINDOW_FROM,
      WINDOW_TO,
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.title).toBe("Kitchen reno walkthrough with Mr Smith, then the inspector");
    expect(events[0]!.endsAt.toISOString()).toBe("2026-09-15T16:00:00.000Z");
  });

  test("a cancelled event is dropped and a transparent one is not busy", () => {
    const events = parseIcs(
      wrap(
        [
          "BEGIN:VEVENT",
          "UID:cancelled-1",
          "SUMMARY:Called off",
          "STATUS:CANCELLED",
          "DTSTART:20260916T140000Z",
          "END:VEVENT",
          "BEGIN:VEVENT",
          "UID:free-1",
          "SUMMARY:Out of office (FYI)",
          "TRANSP:TRANSPARENT",
          "DTSTART:20260917T140000Z",
          "END:VEVENT",
        ].join("\r\n"),
      ),
      WINDOW_FROM,
      WINDOW_TO,
    );
    expect(events.map((e) => e.uid)).toEqual(["free-1"]);
    expect(events[0]!.busy).toBe(false);
  });

  test("a weekly series expands to one row per occurrence, minus EXDATEs", () => {
    const events = parseIcs(
      wrap(
        [
          "BEGIN:VEVENT",
          "UID:weekly-1",
          "SUMMARY:Toolbox talk",
          "DTSTART:20260907T130000Z",
          "DTEND:20260907T133000Z",
          "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261006T000000Z",
          "EXDATE:20260921T130000Z",
          "END:VEVENT",
        ].join("\r\n"),
      ),
      WINDOW_FROM,
      WINDOW_TO,
    );
    const days = events.map((e) => e.startsAt.toISOString().slice(0, 10));
    expect(days).toEqual(["2026-09-07", "2026-09-14", "2026-09-28", "2026-10-05"]);
    // Each occurrence needs its own id, or the mirror keeps one row for the series.
    expect(new Set(events.map((e) => e.uid)).size).toBe(events.length);
  });

  test("only the occurrences inside the window come back", () => {
    const events = parseIcs(
      wrap(
        ["BEGIN:VEVENT", "UID:daily-1", "SUMMARY:Standup", "DTSTART:20260101T120000Z", "DURATION:PT15M", "RRULE:FREQ=DAILY", "END:VEVENT"].join("\r\n"),
      ),
      new Date("2026-09-10T00:00:00.000Z"),
      new Date("2026-09-13T00:00:00.000Z"),
    );
    expect(events.map((e) => e.startsAt.toISOString().slice(0, 10))).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
  });

  test("something that is not a calendar yields nothing rather than throwing", () => {
    expect(parseIcs("<!doctype html><html><body>nope</body></html>", WINDOW_FROM, WINDOW_TO)).toEqual([]);
    expect(parseIcs(wrap("BEGIN:VEVENT\r\nUID:no-start\r\nSUMMARY:Broken\r\nEND:VEVENT"), WINDOW_FROM, WINDOW_TO)).toEqual([]);
  });
});

describe("expandRecurrence", () => {
  const hour = 3_600_000;
  test("COUNT stops the series", () => {
    const out = expandRecurrence(new Date("2026-09-01T09:00:00Z"), hour, "FREQ=DAILY;COUNT=3", [], WINDOW_FROM, WINDOW_TO);
    expect(out).toHaveLength(3);
  });

  test("INTERVAL skips", () => {
    const out = expandRecurrence(new Date("2026-09-01T09:00:00Z"), hour, "FREQ=DAILY;INTERVAL=3;COUNT=3", [], WINDOW_FROM, WINDOW_TO);
    expect(out.map((d) => d.toISOString().slice(8, 10))).toEqual(["01", "04", "07"]);
  });

  test("an unsupported rule degrades to the first occurrence, never to invented dates", () => {
    const out = expandRecurrence(new Date("2026-09-01T09:00:00Z"), hour, "FREQ=SECONDLY;COUNT=99", [], WINDOW_FROM, WINDOW_TO);
    expect(out).toHaveLength(1);
  });

  test("a monthly series lands on the same day each month", () => {
    const out = expandRecurrence(new Date("2026-09-15T09:00:00Z"), hour, "FREQ=MONTHLY;COUNT=3", [], WINDOW_FROM, WINDOW_TO);
    expect(out.map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-09-15", "2026-10-15", "2026-11-15"]);
  });
});

describe("buildIcs", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");

  test("a timed and an all-day event, in a calendar a reader will accept", () => {
    const body = buildIcs(
      "Northside Renovations — schedule",
      [
        { uid: "block-1", title: "Dan — Kitchen reno", startsAt: new Date("2026-09-23T13:00:00Z"), endsAt: new Date("2026-09-23T21:00:00Z"), allDay: false },
        { uid: "milestone-1", title: "Rough-in complete", startsAt: new Date("2026-09-28T00:00:00Z"), endsAt: new Date("2026-09-29T00:00:00Z"), allDay: true },
      ],
      now,
    );
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(body).toContain("DTSTART:20260923T130000Z");
    expect(body).toContain("DTSTART;VALUE=DATE:20260928");
    expect(body).toContain("UID:block-1@quoteai.ca");
    expect((body.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    // CRLF everywhere, per RFC 5545 — some desktop clients are strict about it.
    expect(body.split("\n").every((l) => l === "" || l.endsWith("\r"))).toBe(true);
  });

  test("commas and semicolons in a title are escaped, and long lines are folded", () => {
    const body = buildIcs("Test", [
      {
        uid: "x",
        title: "Smith, John; kitchen, bath and the very long description that will certainly exceed the seventy-five octet limit imposed by the specification",
        startsAt: new Date("2026-09-23T13:00:00Z"),
        endsAt: new Date("2026-09-23T14:00:00Z"),
        allDay: false,
      },
    ], now);
    expect(body).toContain("Smith\\, John\\; kitchen\\, bath");
    for (const line of body.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });

  test("what we write, we can read back", () => {
    const body = buildIcs("Round trip", [
      { uid: "rt-1", title: "Site visit", location: "44 Bloor St W", startsAt: new Date("2026-09-23T13:00:00Z"), endsAt: new Date("2026-09-23T14:30:00Z"), allDay: false },
    ], now);
    const parsed = parseIcs(body, WINDOW_FROM, WINDOW_TO);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ title: "Site visit", location: "44 Bloor St W", allDay: false });
    expect(parsed[0]!.startsAt.toISOString()).toBe("2026-09-23T13:00:00.000Z");
    expect(parsed[0]!.endsAt.toISOString()).toBe("2026-09-23T14:30:00.000Z");
  });
});
