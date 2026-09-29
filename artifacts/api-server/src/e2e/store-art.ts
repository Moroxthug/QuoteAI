// Phase 123/126 — the Play Store icon (512 × 512) and feature graphic (1024 × 500, EN + FR),
// drawn as HTML in Chrome so they use the brand's own type (Figtree, as on the site) and mark
// (quote-ai/public/icon-512.png). The feature graphic shows the real Today screen from
// `store:shots` — run that first.
//
//   pnpm --filter @workspace/api-server store:art
//
// Writes artifacts/mobile/store/play/icon-512.png and feature-graphic-<lang>.png.

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const OUT = path.join(ROOT, "artifacts/mobile/store/play");
const require = createRequire(path.join(ROOT, "artifacts/quote-ai/package.json"));
const font = readFileSync(require.resolve("@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2")).toString("base64");
const fontExt = readFileSync(require.resolve("@fontsource-variable/figtree/files/figtree-latin-ext-wght-normal.woff2")).toString("base64");
const mark = readFileSync(path.join(ROOT, "artifacts/quote-ai/public/icon-512.png")).toString("base64");
const NAVY = "#101031";

const fontFace = `
  @font-face { font-family: Figtree; font-weight: 300 900; src: url(data:font/woff2;base64,${font}) format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215; }
  @font-face { font-family: Figtree; font-weight: 300 900; src: url(data:font/woff2;base64,${fontExt}) format("woff2"); }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: Figtree, sans-serif; -webkit-font-smoothing: antialiased; }`;

// Play draws its own rounded mask over a full square; the mark sits inside the safe circle on white, like the launcher icon.
const icon = `<!doctype html><html><head><style>${fontFace}
  body { width: 512px; height: 512px; background: #fff; display: grid; place-items: center; }
  img { width: 360px; height: 360px; }
</style></head><body><img src="data:image/png;base64,${mark}"></body></html>`;

const COPY = {
  en: { head: "Quotes in minutes.<br>Jobs on track.<br>Paid sooner.", sub: "For Canadian contractors. Built for the job site, works with no signal." },
  fr: { head: "Soumissions en minutes.<br>Chantiers suivis.<br>Payé plus vite.", sub: "Pour les entrepreneurs d'ici. Pensé pour le chantier, fonctionne sans réseau." },
};

function feature(lang: "en" | "fr"): string {
  const shot = readFileSync(path.join(OUT, lang, "01-today.png")).toString("base64");
  return `<!doctype html><html lang="${lang}"><head><style>${fontFace}
    body { width: 1024px; height: 500px; background: ${NAVY}; color: #fff; position: relative; overflow: hidden; }
    .copy { position: absolute; left: 64px; top: 58px; width: 600px; }
    .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 800; letter-spacing: -.01em; }
    .brand img { width: 46px; height: 46px; background: #fff; border-radius: 12px; padding: 5px; }
    h1 { margin-top: 38px; font-size: ${lang === "fr" ? 43 : 47}px; line-height: 1.12; font-weight: 800; letter-spacing: -.02em; }
    p { margin-top: 22px; font-size: 20px; line-height: 1.4; color: #c9cbe6; font-weight: 500; }
    .phone { position: absolute; right: 72px; top: 44px; width: 262px; padding: 10px; border-radius: 40px; background: #26264d; box-shadow: 0 30px 60px rgba(0,0,0,.35); }
    .phone img { display: block; width: 100%; border-radius: 30px; }
  </style></head><body>
    <div class="copy">
      <div class="brand"><img src="data:image/png;base64,${mark}" alt="">QuoteAI</div>
      <h1>${COPY[lang].head}</h1>
      <p>${COPY[lang].sub}</p>
    </div>
    <div class="phone"><img src="data:image/png;base64,${shot}" alt=""></div>
  </body></html>`;
}

const browser = await chromium.launch({ channel: process.env.QA_CHROME_PATH ? undefined : "chrome", executablePath: process.env.QA_CHROME_PATH, headless: true });
try {
  const render = async (html: string, width: number, height: number, file: string) => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, omitBackground: false });
    await page.close();
    console.log(`[store-art] ${path.relative(ROOT, file)}`);
  };
  await render(icon, 512, 512, path.join(OUT, "icon-512.png"));
  for (const lang of ["en", "fr"] as const) {
    if (!existsSync(path.join(OUT, lang, "01-today.png"))) throw new Error(`run store:shots first (no ${lang}/01-today.png)`);
    await render(feature(lang), 1024, 500, path.join(OUT, `feature-graphic-${lang}.png`));
  }
} finally {
  await browser.close();
}

// Play's formats: the icon a 32-bit PNG (with alpha); the feature graphic and every screenshot 24-bit (no alpha).
const sharp = (await import("sharp")).default;
const { readdirSync, writeFileSync } = await import("node:fs");
const fix = async (file: string, alpha: boolean) => {
  const img = sharp(readFileSync(file));
  writeFileSync(file, await (alpha ? img.ensureAlpha() : img.flatten({ background: "#ffffff" }).removeAlpha()).png({ compressionLevel: 9 }).toBuffer());
};
await fix(path.join(OUT, "icon-512.png"), true);
for (const lang of ["en", "fr"]) {
  await fix(path.join(OUT, `feature-graphic-${lang}.png`), false);
  for (const f of readdirSync(path.join(OUT, lang)).filter((f) => f.endsWith(".png"))) await fix(path.join(OUT, lang, f), false);
}
console.log("[store-art] formats: icon 32-bit, feature graphics and screenshots 24-bit");
