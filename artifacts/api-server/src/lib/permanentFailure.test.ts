import { describe, expect, it } from "vitest";
import { PermanentFailure } from "./automation.js";

describe("PermanentFailure", () => {
  it("is an Error the runner can tell apart, keeping the message the app and the ops filter read", () => {
    const err = new PermanentFailure("QuickBooks not connected or token refresh failed");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PermanentFailure);
    expect(err.name).toBe("PermanentFailure");
    expect(err.message).toContain("not connected or token refresh failed");
  });
});
