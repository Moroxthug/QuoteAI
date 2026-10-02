import { describe, expect, it } from "vitest";
import { quoteState } from "./overview.js";

const now = new Date("2026-10-01T12:00:00Z");
const base = { declinedAt: null, acceptedAt: null, status: "draft", sentAt: null, validDays: 30 };

describe("quoteState", () => {
  it("a declined quote is declined whatever else is true", () => {
    expect(quoteState({ ...base, declinedAt: new Date("2026-09-14"), sentAt: new Date("2026-08-01") }, now)).toBe("declined");
  });
  it("an accepted quote is accepted", () => {
    expect(quoteState({ ...base, status: "accepted" }, now)).toBe("accepted");
    expect(quoteState({ ...base, acceptedAt: new Date("2026-09-01") }, now)).toBe("accepted");
  });
  it("a sent quote past its days is expired, inside them it is sent", () => {
    expect(quoteState({ ...base, sentAt: new Date("2026-08-01") }, now)).toBe("expired");
    expect(quoteState({ ...base, sentAt: new Date("2026-09-20") }, now)).toBe("sent");
  });
  it("one never sent is a draft", () => {
    expect(quoteState(base, now)).toBe("draft");
  });
});
