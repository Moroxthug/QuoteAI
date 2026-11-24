// Screenshots of the real signed-in screens for the feature pages
// (/estimating-software/ etc., SEO plan S4), in English and French, written to
// public/screens/<feature>-<lang>.jpg.
//
// The app runs on the dev server with src/dev/shots-mock.ts answering the API
// from invented sample data (src/dev/shots-data.ts; the invoice and contract
// are rendered by the API's own renderers via
// api-server/src/e2e/shots-fixtures.ts). Nothing touches a database.
//
//   1. start the dev server (launch config "quote-ai", port 5183)
//   2. pnpm --filter @workspace/quote-ai exec tsx scripts/capture-feature-shots.ts [http://localhost:5183]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:5183";
const OUT = resolve(import.meta.dirname, "../public/screens");
mkdirSync(OUT, { recursive: true });

type Shot = { feature: string; path: string; prepare?: (page: Page) => Promise<void> };
const SHOTS: Shot[] = [
  { feature: "estimating", path: "/dashboard/quotes/q_bath" },
  { feature: "invoicing", path: "/dashboard/invoices/inv_deck_2" },
  { feature: "crm", path: "/dashboard/leads" },
  {
    feature: "job-costing",
    path: "/dashboard/jobs/j_deck",
    prepare: async (page) => {
      await page.getByRole("button", { name: /^(Costs|Coûts)\b/ }).first().click();
    },
  },
  { feature: "contracts", path: "/dashboard/contracts/ct_deck" },
];

const executablePath = process.env.QA_CHROME_PATH;
const browser = await chromium.launch({ channel: executablePath ? undefined : "chrome", executablePath, headless: true });
try {
  for (const lang of ["en", "fr"] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce", locale: lang === "fr" ? "fr-CA" : "en-CA" });
    await context.addInitScript((l) => {
      localStorage.setItem("qa-shots", "1");
      localStorage.setItem("quoteai-lang", l);
    }, lang);
    const page = await context.newPage();
    for (const shot of SHOTS) {
      await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      if (shot.prepare) await shot.prepare(page);
      await page.waitForTimeout(1200);
      const unmatched = await page.evaluate(() => (window as unknown as { __shotsUnmatched?: string[] }).__shotsUnmatched ?? []);
      if (unmatched.length) console.warn(`  ${shot.feature}/${lang}: no sample data for ${[...new Set(unmatched)].join(", ")}`);
      const file = resolve(OUT, `${shot.feature}-${lang}.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: 82 });
      console.log("wrote", file);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
