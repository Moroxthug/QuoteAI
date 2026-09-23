import { describe, expect, test } from "vitest";
import { collapseShiftEvents, type ShiftEvent } from "./changes.js";

const ME = "w-me";
const OTHER = "w-other";
const at = (m: number) => new Date(Date.UTC(2026, 8, 22, 8, m));
const ev = (e: Partial<ShiftEvent> & Pick<ShiftEvent, "action">): ShiftEvent => ({ blockId: "b1", at: at(0), fromWorker: null, toWorker: null, startsAt: "2026-09-24T12:00:00.000Z", endsAt: "2026-09-24T20:00:00.000Z", ...e });

describe("collapseShiftEvents — what one block's trail means to one worker", () => {
  test("created on them is added; created on someone else is nothing", () => {
    expect(collapseShiftEvents([ev({ action: "created", fromWorker: ME, toWorker: ME })], ME)?.kind).toBe("shift_added");
    expect(collapseShiftEvents([ev({ action: "created", fromWorker: OTHER, toWorker: OTHER })], ME)).toBeNull();
  });

  test("created then deleted is nothing at all", () => {
    expect(collapseShiftEvents([ev({ action: "created", fromWorker: ME, toWorker: ME, at: at(1) }), ev({ action: "deleted", fromWorker: ME, toWorker: ME, at: at(2) })], ME)).toBeNull();
  });

  test("an existing shift moved in time is changed; deleted is removed", () => {
    expect(collapseShiftEvents([ev({ action: "moved", fromWorker: ME, toWorker: ME })], ME)?.kind).toBe("shift_changed");
    expect(collapseShiftEvents([ev({ action: "updated", fromWorker: ME, toWorker: ME })], ME)?.kind).toBe("shift_changed");
    expect(collapseShiftEvents([ev({ action: "deleted", fromWorker: ME, toWorker: ME })], ME)?.kind).toBe("shift_removed");
  });

  test("handed to someone else is removed, with where it was; handed to them is added", () => {
    const gone = collapseShiftEvents([ev({ action: "moved", fromWorker: ME, toWorker: OTHER, startsAt: "2026-09-25T12:00:00.000Z", endsAt: "2026-09-25T16:00:00.000Z" })], ME);
    expect(gone).toMatchObject({ kind: "shift_removed", startsAt: "2026-09-25T12:00:00.000Z" });
    expect(collapseShiftEvents([ev({ action: "moved", fromWorker: OTHER, toWorker: ME })], ME)?.kind).toBe("shift_added");
  });

  test("away and back again is a change, not a removal; order is by time, not by arrival", () => {
    const events = [ev({ action: "moved", fromWorker: OTHER, toWorker: ME, at: at(5) }), ev({ action: "moved", fromWorker: ME, toWorker: OTHER, at: at(1) })];
    expect(collapseShiftEvents(events, ME)?.kind).toBe("shift_changed");
    expect(collapseShiftEvents(events, ME)?.at).toEqual(at(5));
  });

  test("no events, no verdict", () => {
    expect(collapseShiftEvents([], ME)).toBeNull();
  });
});
