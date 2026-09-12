import { getTaxProfile, normalizeProvince } from "@workspace/db";

/**
 * Sales-tax rate to store on a freshly generated quote. The AI is told not to
 * guess a rate, so it usually returns 0/undefined; in that case the
 * company's province decides (ON → 13, QC → 14.975, AB → 5…). A positive
 * rate explicitly produced by the AI (user said "add 5% GST") wins.
 * Replaces the old Italian `?? 22` fallback.
 */
export function resolveQuoteTaxRate(aiRate: number | null | undefined, province: string | null | undefined): number {
  if (typeof aiRate === "number" && Number.isFinite(aiRate) && aiRate > 0) return aiRate;
  const code = normalizeProvince(province);
  if (!code) return 0;
  return getTaxProfile(code).totalRate;
}
