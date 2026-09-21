import { describe, test, expect } from "vitest";
import { findConflicts, reminderDue, reminderBody, localParts } from "./service.js";

const at = (iso: string) => new Date(iso);

describe("schedule conflicts", () => {
  test("same worker + overlapping intervals conflict; touching ends and other workers do not", () => {
    const a = { id: "a", collaboratorId: "w1", startsAt: at("2026-09-22T12:00:00Z"), endsAt: at("2026-09-22T20:00:00Z") };
    const b = { id: "b", collaboratorId: "w1", startsAt: at("2026-09-22T16:00:00Z"), endsAt: at("2026-09-22T22:00:00Z") };
    const c = { id: "c", collaboratorId: "w1", startsAt: at("2026-09-22T20:00:00Z"), endsAt: at("2026-09-22T23:00:00Z") }; // starts when a ends
    const d = { id: "d", collaboratorId: "w2", startsAt: at("2026-09-22T12:00:00Z"), endsAt: at("2026-09-22T20:00:00Z") }; // other worker
    const e = { id: "e", collaboratorId: null, startsAt: at("2026-09-22T12:00:00Z"), endsAt: at("2026-09-22T20:00:00Z") }; // unassigned
    const map = findConflicts([a, b, c, d, e]);
    expect(map.get("a")).toEqual(["b"]);
    expect(map.get("b")?.sort()).toEqual(["a", "c"]);
    expect(map.get("c")).toEqual(["b"]);
    expect(map.has("d")).toBe(false);
    expect(map.has("e")).toBe(false);
  });
});

describe("reminder window (company-local)", () => {
  // 2026-09-22 08:00 Toronto = 12:00Z; the block is the worker's Tuesday shift.
  const block = { startsAt: at("2026-09-22T12:00:00Z"), reminderSentAt: null };

  test("Monday 14:59 Toronto → not yet; 15:00 → 'tomorrow'", () => {
    expect(reminderDue(block, at("2026-09-21T18:59:00Z"), "ON")).toBeNull();
    expect(reminderDue(block, at("2026-09-21T19:00:00Z"), "ON")).toBe("tomorrow");
    // The 23:00Z evening cron is 19:00 in Toronto and 16:00 in Vancouver — both past 15:00.
    expect(reminderDue(block, at("2026-09-21T23:00:00Z"), "ON")).toBe("tomorrow");
    expect(reminderDue({ startsAt: at("2026-09-22T15:00:00Z"), reminderSentAt: null }, at("2026-09-21T23:00:00Z"), "BC")).toBe("tomorrow");
  });

  test("the morning of → 'today'; after the start, already sent, or two days out → nothing", () => {
    expect(reminderDue(block, at("2026-09-22T10:00:00Z"), "ON")).toBe("today");
    expect(reminderDue(block, at("2026-09-22T12:30:00Z"), "ON")).toBeNull();
    expect(reminderDue({ ...block, reminderSentAt: at("2026-09-21T19:05:00Z") }, at("2026-09-21T20:00:00Z"), "ON")).toBeNull();
    expect(reminderDue(block, at("2026-09-20T19:00:00Z"), "ON")).toBeNull();
  });

  test("local day/hour follow the province, not UTC", () => {
    // 01:30Z on the 22nd is still the evening of the 21st in Vancouver.
    expect(localParts(at("2026-09-22T01:30:00Z"), "BC")).toEqual({ day: "2026-09-21", hour: 18 });
    expect(localParts(at("2026-09-22T01:30:00Z"), "QC")).toEqual({ day: "2026-09-21", hour: 21 });
  });
});

describe("reminder body", () => {
  const block = { title: "", startsAt: at("2026-09-22T12:00:00Z"), endsAt: at("2026-09-22T20:00:00Z"), allDay: false, notes: "Gate code 4471." };
  test("EN: tomorrow, local times, job + address, notes", () => {
    expect(reminderBody({ kind: "tomorrow", block, jobName: "Basement finish", address: "45 Rue Laurier, Gatineau", province: "ON", lang: "en" })).toBe("Tomorrow 08:00-16:00: Basement finish, 45 Rue Laurier, Gatineau. Gate code 4471.");
  });
  test("FR: aujourd'hui, all day, no job → label falls back", () => {
    expect(reminderBody({ kind: "today", block: { ...block, allDay: true, notes: "" }, jobName: null, address: null, province: "QC", lang: "fr" })).toBe("Aujourd'hui toute la journée: Bloc.");
  });
  test("a block title wins over the job name", () => {
    expect(reminderBody({ kind: "today", block: { ...block, title: "Pick up materials", notes: "" }, jobName: "Basement finish", address: null, province: "ON", lang: "en" })).toBe("Today 08:00-16:00: Pick up materials.");
  });
});
