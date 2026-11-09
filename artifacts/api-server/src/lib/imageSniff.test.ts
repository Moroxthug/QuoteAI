import { describe, expect, it } from "vitest";
import { sniffRasterImage } from "./imageSniff.js";

describe("sniffRasterImage", () => {
  it("recognises PNG, JPEG and WebP by their bytes", () => {
    expect(sniffRasterImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffRasterImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffRasterImage(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))).toBe("image/webp");
  });

  it("refuses SVG, HTML and anything else, whatever the client said", () => {
    expect(sniffRasterImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffRasterImage(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffRasterImage(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(sniffRasterImage(Buffer.alloc(0))).toBeNull();
  });
});
