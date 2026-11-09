/**
 * The real type of an uploaded image, read from its first bytes. The type a
 * client declares is never trusted: a file labelled image/png can be HTML or
 * SVG with a script in it. Only raster formats are accepted, never SVG.
 */
export type RasterMime = "image/png" | "image/jpeg" | "image/webp";

export const RASTER_EXT: Record<RasterMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function sniffRasterImage(buf: Buffer | Uint8Array): RasterMime | null {
  const b = buf;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return "image/png";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Headers for any stored file we serve back from our own origin. The sandbox
 * CSP means that even a file uploaded before the type checks existed (an SVG
 * logo, say) cannot run script when opened directly; images still display.
 */
export const STORED_FILE_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
};
