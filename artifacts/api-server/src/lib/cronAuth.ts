import { timingSafeEqual } from "node:crypto";

// Vercel sends `Authorization: Bearer $CRON_SECRET`; we accept the same
// header from any caller so a tick can be triggered manually with curl.
export function cronAuthorized(req: { headers: { authorization?: string } }, res: { status: (n: number) => { json: (b: unknown) => void } }): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "CRON_SECRET not configured" });
    return false;
  }
  const header = req.headers.authorization ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(header);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
