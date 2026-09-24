// The default link-preview card: public/opengraph.jpg, 1200×630.
//
// Every page without its own card (the homepage, /pilot, /pricing, the legal
// pages…) points og:image and twitter:image at it (components/seo-head.tsx),
// so it is what Reddit, Facebook, LinkedIn, WhatsApp and iMessage show when
// someone pastes a quoteai.ca link. Until 2026-09-24 it was still the Italian
// prevAI screenshot from the original import.
//
// Rendered by Chrome from HTML (the site's Figtree font, the real logo, the
// mockup palette) rather than resvg like the blog/sector cards: resvg can't
// load woff2. It is not part of the build — run it when the branding changes
// and commit the JPG:
//
//   pnpm --filter @workspace/quote-ai generate-home-og
//
// Previews are cached by the platforms per URL: after changing it, re-scrape
// with Facebook's Sharing Debugger / LinkedIn Post Inspector; Reddit keeps its
// copy for a while, so share a URL it hasn't seen (e.g. /pilot) to check.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const out = join(__dirname, "../public/opengraph.jpg");

const font = readFileSync(require.resolve("@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2")).toString("base64");
const logo = readFileSync(join(__dirname, "../public/quoteai-logo.png")).toString("base64");

// A believable quote whose numbers add up: 20,000 + 13 % HST.
const lines: Array<[string, string]> = [
  ["Demolition and disposal", "2,400.00"],
  ["Plumbing and electrical rough-in", "6,800.00"],
  ["Cabinets and quartz countertops", "9,500.00"],
  ["Finishing and cleanup", "1,300.00"],
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Figtree; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 300 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 1200px; height: 630px; font-family: Figtree, system-ui, sans-serif; color: #101031; background: #f4f5f7; overflow: hidden; position: relative; }
.bar { position: absolute; left: 0; right: 0; bottom: 0; height: 8px; background: #101031; }
.left { position: absolute; left: 64px; top: 40px; bottom: 44px; width: 580px; display: flex; flex-direction: column; }
.logo { height: 132px; margin: -34px 0 -26px -36px; display: block; align-self: flex-start; }
h1 { margin-top: auto; font-size: 52px; line-height: 1.04; font-weight: 800; letter-spacing: -0.03em; }
h1 span { color: #6c2bd9; }
.sub { margin-top: 22px; font-size: 23px; line-height: 1.4; color: #393a3d; font-weight: 500; }
.chips { margin-top: auto; display: flex; gap: 10px; align-items: center; }
.chip { font-size: 17px; font-weight: 700; padding: 8px 14px; border-radius: 999px; background: #fff; border: 1px solid #dfe1e6; color: #101031; }
.url { margin-left: 8px; font-size: 20px; font-weight: 700; color: #101031; }
.card { position: absolute; right: 64px; top: 70px; width: 470px; background: #fff; border: 1px solid #dfe1e6; border-radius: 18px; box-shadow: 0 24px 60px rgba(16,16,49,.12), 0 2px 6px rgba(16,16,49,.06); padding: 30px 30px 26px; }
.row { display: flex; justify-content: space-between; align-items: baseline; }
.q-no { font-size: 15px; font-weight: 700; color: #6d6f76; letter-spacing: .04em; text-transform: uppercase; }
.badge { font-size: 14px; font-weight: 700; color: #196010; background: #e9f6e6; padding: 4px 10px; border-radius: 999px; }
.title { font-size: 26px; font-weight: 800; margin-top: 10px; letter-spacing: -0.01em; }
.client { font-size: 17px; color: #6b6c72; margin-top: 4px; }
.lines { margin-top: 20px; border-top: 1px solid #eceef2; }
.line { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid #eceef2; font-size: 17px; color: #393a3d; }
.line b { font-weight: 600; color: #101031; font-variant-numeric: tabular-nums; }
.tot { display: flex; justify-content: space-between; font-size: 17px; color: #6b6c72; padding: 9px 0 0; }
.tot b { font-variant-numeric: tabular-nums; color: #393a3d; font-weight: 600; }
.grand { display: flex; justify-content: space-between; align-items: baseline; margin-top: 12px; padding-top: 14px; border-top: 2px solid #101031; }
.grand span { font-size: 18px; font-weight: 700; }
.grand b { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.send { margin-top: 20px; background: #101031; color: #fff; text-align: center; font-weight: 700; font-size: 18px; padding: 13px; border-radius: 10px; }
</style></head><body>
<div class="left">
  <img class="logo" src="data:image/png;base64,${logo}" alt="">
  <h1>Quotes in <span>30 seconds.</span><br>Built for Canadian trades.</h1>
  <p class="sub">Describe the job in your own words. Get a priced, tax‑ready quote to send, then contracts, jobs and invoices until you're paid.</p>
  <div class="chips"><span class="chip">GST / HST / QST</span><span class="chip">English &amp; français</span><span class="url">quoteai.ca</span></div>
</div>
<div class="card">
  <div class="row"><span class="q-no">Quote Q-2026-014</span><span class="badge">Ready to send</span></div>
  <div class="title">Kitchen renovation</div>
  <div class="client">Toronto, ON</div>
  <div class="lines">${lines.map(([l, a]) => `<div class="line"><span>${l}</span><b>$${a}</b></div>`).join("")}</div>
  <div class="tot"><span>Subtotal</span><b>$20,000.00</b></div>
  <div class="tot"><span>HST 13%</span><b>$2,600.00</b></div>
  <div class="grand"><span>Total</span><b>$22,600.00</b></div>
  <div class="send">Send to client</div>
</div>
<div class="bar"></div>
</body></html>`;

const executablePath = process.env.QA_CHROME_PATH;
const browser = await chromium.launch({ channel: executablePath ? undefined : "chrome", executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: "jpeg", quality: 90 });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
