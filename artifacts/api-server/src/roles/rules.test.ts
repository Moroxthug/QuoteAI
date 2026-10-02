import { describe, expect, it } from "vitest";
import { cleanOverrides, defaultJobRole, defaultSensitive, effectiveSensitive, isJobRole, roleHomesIncluded } from "./rules.js";

describe("job role rules", () => {
  it("a role starts with its own switches", () => {
    expect(defaultSensitive("estimator")).toEqual({ payRates: false, margins: true, approveTime: false, sendInvoices: false });
    expect(defaultSensitive("bookkeeper")).toEqual({ payRates: true, margins: true, approveTime: true, sendInvoices: true });
    expect(defaultSensitive("safety")).toEqual({ payRates: false, margins: false, approveTime: false, sendInvoices: false });
  });
  it("a person's exceptions go on top, and the owner always has all four", () => {
    expect(effectiveSensitive("estimator", { margins: false, sendInvoices: true })).toEqual({ payRates: false, margins: false, approveTime: false, sendInvoices: true });
    expect(effectiveSensitive("estimator", { payRates: false }, true)).toEqual({ payRates: true, margins: true, approveTime: true, sendInvoices: true });
    expect(effectiveSensitive("owner", { margins: false })).toEqual({ payRates: true, margins: true, approveTime: true, sendInvoices: true });
  });
  it("only what differs from the role's start is kept", () => {
    expect(cleanOverrides("estimator", { payRates: false, margins: true, approveTime: true, sendInvoices: false })).toEqual({ approveTime: true });
    expect(cleanOverrides("estimator", {})).toEqual({});
  });
  it("a person with no job role gets the closest one to their access", () => {
    expect(defaultJobRole("owner")).toBe("owner");
    expect(defaultJobRole("office")).toBe("officeManager");
    expect(defaultJobRole("admin")).toBe("officeManager");
    expect(defaultJobRole("foreman")).toBe("foreman");
    expect(defaultJobRole("accountant")).toBe("bookkeeper");
    expect(defaultJobRole("viewer")).toBe("safety");
  });
  it("knows its roles and which plans include role homes", () => {
    expect(isJobRole("dispatcher")).toBe(true);
    expect(isJobRole("janitor")).toBe(false);
    expect(roleHomesIncluded("monthly_business")).toBe(true);
    expect(roleHomesIncluded("monthly_pro")).toBe(false);
  });
});
