import { describe, expect, it } from "vitest";
import { fillTemplate, savedTemplate } from "./savedTemplates.js";

describe("saved templates", () => {
  it("reads the saved text for an id and language, or null", () => {
    const ps = { templates: { f1_en: "  Hi {first}  ", f1_fr: "" } };
    expect(savedTemplate(ps, "f1", "en")).toBe("Hi {first}");
    expect(savedTemplate(ps, "f1", "fr")).toBeNull();
    expect(savedTemplate({}, "f1", "en")).toBeNull();
    expect(savedTemplate(null, "f1", "en")).toBeNull();
  });
  it("fills the slots and drops the ones with no value", () => {
    expect(fillTemplate("Hi {first}, your quote: {link} Thanks, {me}", { first: "Dana", link: "q.ca/1", me: "Marco" })).toBe("Hi Dana, your quote: q.ca/1 Thanks, Marco");
    expect(fillTemplate("Hi {first}, see {link}.", { first: "Dana" })).toBe("Hi Dana, see.");
  });
});
