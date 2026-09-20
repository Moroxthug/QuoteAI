// Drawn signatures arrive as `data:image/png;base64,…` from the public
// signing page. pdfkit throws "Incomplete or corrupt PNG file" on anything
// short of a well-formed PNG, and that throw happens inside finalizeContract —
// after the signer row is already marked signed. So the sign route rejects
// bad images up front, and the PDF renderer falls back to the typed name
// rather than failing the whole contract (Phase 63 e2e finding).

const PNG_PREFIX = "data:image/png;base64,";
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** True when the data URL decodes to something pdfkit can actually open: PNG magic, an IHDR chunk, and a trailing IEND. */
export function isWellFormedPngDataUrl(value: string | null | undefined): boolean {
  if (!value || !value.startsWith(PNG_PREFIX)) return false;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(value.slice(PNG_PREFIX.length), "base64");
  } catch {
    return false;
  }
  // 8 magic + 25 IHDR (4 len + 4 type + 13 data + 4 crc) + 12 IEND
  if (bytes.length < 45) return false;
  if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) return false;
  if (bytes.toString("latin1", 12, 16) !== "IHDR") return false;
  if (bytes.toString("latin1", bytes.length - 8, bytes.length - 4) !== "IEND") return false;
  return true;
}

/** 1×1 transparent PNG — the smallest thing pdfkit will open. Used by tests as a valid drawn signature. */
export const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
