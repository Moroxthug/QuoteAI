import { describe, expect, it } from "vitest";
import { addMonths, buildCohortGrid, monthsBetween } from "./cohorts";

describe("month arithmetic", () => {
  it("adds across years", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", 0)).toBe("2026-01");
    expect(addMonths("2026-12", 12)).toBe("2027-12");
    expect(monthsBetween("2026-09", "2027-01")).toBe(4);
  });
});

describe("cohort grid", () => {
  const signups = [{ month: "2026-09", signups: 20 }, { month: "2026-08", signups: 10 }];

  it("shares of each month's signups, oldest cohort first", () => {
    const g = buildCohortGrid({
      signups,
      activeCells: [
        { cohort: "2026-08", offset: 0, users: 10 }, { cohort: "2026-08", offset: 1, users: 5 }, { cohort: "2026-08", offset: 2, users: 4 },
        { cohort: "2026-09", offset: 0, users: 18 }, { cohort: "2026-09", offset: 1, users: 9 },
      ],
      payingCells: [{ cohort: "2026-08", offset: 1, users: 2 }, { cohort: "2026-09", offset: 1, users: 3 }],
      currentMonth: "2026-10",
      payingCoverageFrom: "2026-09",
      maxOffset: 3,
    });
    expect(g.map((r) => r.month)).toEqual(["2026-08", "2026-09"]);
    expect(g[0].active).toEqual([100, 50, 40, null]);
    expect(g[1].active).toEqual([90, 45, null, null]);
  });

  it("paying is null before billing history starts, except the current month", () => {
    const g = buildCohortGrid({
      signups,
      activeCells: [],
      payingCells: [{ cohort: "2026-08", offset: 1, users: 2 }, { cohort: "2026-08", offset: 2, users: 1 }],
      currentMonth: "2026-10",
      payingCoverageFrom: "2026-09",
      maxOffset: 2,
    });
    // Aug cohort: Aug (before coverage) null, Sep covered 20%, Oct (current) 10%
    expect(g[0].paying).toEqual([null, 20, 10]);
    // Sep cohort: Sep covered 0%, Oct current 0%, Nov not reached
    expect(g[1].paying).toEqual([0, 0, null]);
  });

  it("with no billing history at all only the current month shows a paying share", () => {
    const g = buildCohortGrid({ signups: [{ month: "2026-10", signups: 4 }], activeCells: [], payingCells: [{ cohort: "2026-10", offset: 0, users: 1 }], currentMonth: "2026-10", payingCoverageFrom: null, maxOffset: 1 });
    expect(g[0].paying).toEqual([25, null]);
  });

  it("an empty cohort has no percentages instead of dividing by zero", () => {
    const g = buildCohortGrid({ signups: [{ month: "2026-09", signups: 0 }], activeCells: [], payingCells: [], currentMonth: "2026-10", payingCoverageFrom: "2026-09", maxOffset: 1 });
    expect(g[0].active).toEqual([null, null]);
    expect(g[0].paying).toEqual([null, null]);
  });
});
