// The made-up company's logo, drawn once per language: out/assets/logo-<lang>.png. Then make-pdf.ts puts it on the real PDF.
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out", "assets");
mkdirSync(OUT, { recursive: true });
const font = pathToFileURL(resolve(HERE, "../node_modules/@expo-google-fonts/geist/700Bold/Geist_700Bold.ttf")).href;
const NAMES = { en: ["MORIN", "RENOVATIONS"], fr: ["MORIN", "RÉNOVATIONS"] };
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const p = await b.newPage({ viewport: { width: 400, height: 330 }, deviceScaleFactor: 2 });
for (const [lang, [a, c]] of Object.entries(NAMES)) {
  await p.setContent(`<style>@font-face{font-family:L;src:url(${font})}body{margin:0;background:transparent;font-family:L;color:#17463b}</style>
  <div style="width:400px;height:330px;border-radius:56px;background:#17463b;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
  <svg width="170" height="136" viewBox="0 0 100 80"><path d="M10 40 50 8l40 32" fill="none" stroke="#f0b24a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 72V42l23 20 23-20v30" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <div style="font-size:58px;line-height:1;letter-spacing:.04em;margin-top:12px">${a}</div><div style="font-size:25px;letter-spacing:.14em;margin-top:8px;color:#f0b24a">${c}</div></div>`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(OUT, `logo-${lang}.png`), omitBackground: true });
}
await b.close();
