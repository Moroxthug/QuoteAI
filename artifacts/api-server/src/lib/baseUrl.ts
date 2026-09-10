/**
 * Returns the public base URL for this app.
 *
 * Priority:
 *  1. QUOTEAI_BASE_URL env var (explicit override, e.g. https://quoteai.ca)
 *  2. VERCEL_PROJECT_PRODUCTION_URL (Vercel production URL)
 *  3. VERCEL_URL (Vercel preview URL)
 *  4. http://localhost:5000 (local dev)
 */
export function getBaseUrl(): string {
  if (process.env.QUOTEAI_BASE_URL) return process.env.QUOTEAI_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5000";
}
