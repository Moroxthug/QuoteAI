import { db, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage.js";

// Phase 80: the company logo as a data URI for pdfmake, shared by the quote,
// invoice and contract PDFs (it used to live in quotes/pdf.ts only, so
// invoices and contracts went out without the logo).

const objectStorage = new ObjectStorageService();

/**
 * Load a logo image from object storage and encode it as a base64 data URI.
 * Best-effort: null when there is no logo, it cannot be fetched, or it is a
 * format pdfmake cannot embed (only PNG and JPEG are).
 *
 * Supported URL formats:
 *   - `/api/storage/public-objects/<subPath>`  (logo uploads — public objects)
 *   - `/objects/<subPath>`                     (private objects, legacy)
 *   - `data:image/(png|jpeg);base64,…`          (already inline — e2e fixtures)
 */
export async function fetchLogoDataUri(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    if (logoUrl.startsWith("data:")) {
      const m = /^data:image\/(?:png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(logoUrl);
      return m ? checked(Buffer.from(m[1]!, "base64")) : null;
    }
    let response: Response | null = null;
    if (logoUrl.startsWith("/api/storage/public-objects/")) {
      const subPath = logoUrl.replace(/^\/api\/storage\/public-objects\//, "");
      const file = await objectStorage.searchPublicObject(subPath).catch(() => null);
      if (!file) return null;
      response = await objectStorage.downloadObject(file, { isPublic: true, cacheTtlSec: 3600 }).catch(() => null);
    } else if (logoUrl.startsWith("/objects/")) {
      const subPath = logoUrl.replace(/^\/objects\//, "");
      response = await objectStorage.downloadPrivateObject(subPath).catch(() => null);
    }
    if (!response || !response.ok) return null;
    return checked(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Sniff the bytes: pdfkit only decodes PNG and JPEG, and a mislabelled WebP/SVG would fail the whole document. */
function checked(buf: Buffer): string | null {
  const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (!isPng && !isJpeg) return null;
  return `data:${isPng ? "image/png" : "image/jpeg"};base64,${buf.toString("base64")}`;
}

/** The logo of the company (business profile) that owns the document, or null. */
export async function companyLogoDataUri(userId: string): Promise<string | null> {
  const [profile] = await db.select({ logoUrl: businessProfilesTable.logoUrl }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return fetchLogoDataUri(profile?.logoUrl ?? null);
}
