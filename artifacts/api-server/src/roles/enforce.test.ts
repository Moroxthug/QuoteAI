import { describe, expect, it } from "vitest";
import { scrub } from "./enforce.js";

describe("scrub", () => {
  const body = { workers: [{ name: "Luis", hourlyRateCents: 4200, rateCentsSnapshot: 4200, hours: 8 }], job: { total: 100, marginCents: 30, marginPercent: 30, costs: 70 }, sensitive: { payRates: true, margins: false } };
  it("removes pay fields when pay rates are off, keeping the rest", () => {
    const out = scrub(body, { payRates: false, margins: true });
    expect(out.workers[0]).toEqual({ name: "Luis", hours: 8 });
    expect(out.job.marginCents).toBe(30);
  });
  it("removes margin fields when margins are off", () => {
    const out = scrub(body, { payRates: true, margins: false });
    expect(out.job).toEqual({ total: 100, costs: 70 });
    expect(out.workers[0]!.hourlyRateCents).toBe(4200);
  });
  it("never touches the switches themselves or a date", () => {
    const d = new Date();
    const out = scrub({ sensitive: { payRates: true, margins: false }, at: d }, { payRates: false, margins: false });
    expect(out.sensitive).toEqual({ payRates: true, margins: false });
    expect(out.at).toBe(d);
  });
});
