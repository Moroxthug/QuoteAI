import { describe, expect, it } from "vitest";
import { startsNewVersion } from "./versions.js";

describe("startsNewVersion", () => {
  it("not for a draft that was never sent", () => expect(startsNewVersion({ sentAt: null, status: "draft", revisionOpen: false })).toBe(false));
  it("for a sent quote the client has", () => expect(startsNewVersion({ sentAt: new Date(), status: "unlocked", revisionOpen: false })).toBe(true));
  it("not again while the new version is still being edited", () => expect(startsNewVersion({ sentAt: new Date(), status: "unlocked", revisionOpen: true })).toBe(false));
  it("not once accepted", () => expect(startsNewVersion({ sentAt: new Date(), status: "accepted", revisionOpen: false })).toBe(false));
});
