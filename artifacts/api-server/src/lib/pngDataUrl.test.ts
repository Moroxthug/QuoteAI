import { describe, test, expect } from "vitest";
import { isWellFormedPngDataUrl, TINY_PNG_DATA_URL } from "./pngDataUrl.js";

describe("isWellFormedPngDataUrl", () => {
  test("accepts a real PNG", () => {
    expect(isWellFormedPngDataUrl(TINY_PNG_DATA_URL)).toBe(true);
  });
  test("rejects the truncated header the old check let through", () => {
    // Phase 63: this exact value crashed finalizeContract inside pdfkit.
    expect(isWellFormedPngDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
  });
  test("rejects other types, empty, and non-PNG bytes behind a PNG prefix", () => {
    expect(isWellFormedPngDataUrl(null)).toBe(false);
    expect(isWellFormedPngDataUrl("")).toBe(false);
    expect(isWellFormedPngDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(false);
    const fakeBytes = Buffer.alloc(64, 0x41).toString("base64");
    expect(isWellFormedPngDataUrl(`data:image/png;base64,${fakeBytes}`)).toBe(false);
    // PNG magic but no IEND (a truncated upload).
    const truncated = Buffer.from(TINY_PNG_DATA_URL.slice("data:image/png;base64,".length), "base64").subarray(0, 40).toString("base64");
    expect(isWellFormedPngDataUrl(`data:image/png;base64,${truncated}`)).toBe(false);
  });
});
