// Records one video from the production web build (never the dev server: its tools show on screen). First, in artifacts/pocket:
//   EXPO_PUBLIC_API_ORIGIN=http://localhost:8092 npx expo export -p web --output-dir video/out/web
// then `node record.mjs quotes en`. No API needed. Writes out/<id>-<lang>/frames/*.jpg and timeline.json.
// The app's clock is stepped one frame at a time and each frame is a real screenshot: Chrome's screencast only gives 390 px wide frames,
// whatever the device scale. So every frame is 1170 x 2532, and a slow machine can't drop any.
// A video is a list of shots, not one take: each shot's `prep` moves the app along with nothing recorded (taps, new pages, scrolling), then `run` is filmed.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { NOW, fixtures } from "./fixtures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 8092;
const ORIGIN = `http://localhost:${PORT}`;
const W = 390, H = 844, SCALE = 3, FPS = 60;
const CLEAR = 130; // the tab bar and the orb cover this much of the bottom of the screen
const WRITE_SECS = 3.6; // how long "the AI" takes, so the writing screen is seen

const [id, lang = "en"] = process.argv.slice(2);
const script = (await import(`./scripts/${id}.mjs`)).default;
const out = join(HERE, "out", `${id}-${lang}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "frames"), { recursive: true });

// The export is one page: any path that isn't a file gets index.html, and the router takes over.
const WEB = join(HERE, "out", "web");
if (!existsSync(join(WEB, "index.html"))) throw new Error("No web export: see the top of this file.");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".ttf": "font/ttf", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json" };
const server = createServer((req, res) => {
  const want = join(WEB, normalize(decodeURIComponent(new URL(req.url, ORIGIN).pathname)));
  const file = want.startsWith(WEB) && existsSync(want) && statSync(want).isFile() ? want : join(WEB, "index.html");
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}).listen(PORT);

// No hinting and no LCD colour fringes: letters sit where the font puts them, as on a phone.
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--font-render-hinting=none", "--disable-lcd-text", "--enable-font-subpixel-positioning", "--force-color-profile=srgb"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, locale: lang === "fr" ? "fr-CA" : "en-CA", timezoneId: "America/Toronto", colorScheme: "light" });
await ctx.addInitScript(() => localStorage.setItem("quoteai_session-token", "video-fixture"));
const page = await ctx.newPage();
await page.clock.install({ time: new Date(NOW) });

let count = 0;
const waiting = []; // answers held back until enough frames have passed
const missing = new Set();
await page.route("**/api/**", async (route) => {
  const req = route.request();
  const path = new URL(req.url()).pathname;
  const hit = fixtures(req.method(), path, lang);
  if (hit === undefined) missing.add(`${req.method()} ${path}`);
  if (req.method() === "POST" && path === "/api/quotes") await new Promise((res) => waiting.push({ at: count + WRITE_SECS * FPS, res }));
  return route.fulfill({ status: hit === undefined ? 404 : 200, contentType: "application/json", body: JSON.stringify(hit ?? { error: "no fixture" }) });
});

await page.goto(ORIGIN + script.start, { waitUntil: "load", timeout: 120_000 });
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(2500);
await page.clock.pauseAt(new Date(Date.parse(NOW) + 60_000));

const frame = async () => {
  await page.clock.runFor(1000 / FPS);
  if (!filming) return;
  await page.screenshot({ path: join(out, "frames", `${String(count).padStart(6, "0")}.jpg`), type: "jpeg", quality: 97, caret: "initial" });
  count++;
  for (const w of waiting.filter((x) => count >= x.at)) { waiting.splice(waiting.indexOf(w), 1); w.res(); }
};
const box = async (loc) => { await loc.waitFor({ timeout: 15_000 }); return loc.boundingBox(); };
const hold = async (secs) => { for (let i = 0, n = Math.round(secs * FPS); i < n; i++) await frame(); };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

let filming = false, shot = null;
const r = {
  lang,
  // Only what is on screen: the screens under this one stay mounted in the stack, with the same words.
  t: (en, fr) => page.getByText(lang === "fr" ? fr : en).locator("visible=true").first(),
  exact: (s) => page.getByText(s, { exact: true }).locator("visible=true").first(),
  field: () => page.locator("textarea").locator("visible=true").first(),
  hold,
  /** Scrolls the page while nothing is being filmed. */
  jump: async (dy) => { await page.mouse.move(W / 2, H / 2); await page.mouse.wheel(0, dy); await hold(0.4); },
  tap: async (loc) => { await reveal(loc); await loc.click(); await hold(0.15); },
  /** The part of the screen this shot lifts out: from the top of `a` to the bottom of `b`, across the card's width. */
  spot: async (a, b = a, pad = 14) => {
    const [p, q] = [await box(a), await box(b)];
    const y = p.y - pad, h = q.y + q.height + pad - y;
    shot.spot = { x: 16 / W, y: y / H, w: (W - 32) / W, h: h / H };
  },
  type: async (text) => {
    const box = page.locator("textarea").locator("visible=true").first();
    await box.evaluate((e) => { e.spellcheck = false; }); // the recording browser's red underlines aren't the app's
    await box.click();
    await hold(0.2);
    for (const ch of text) { await page.keyboard.insertText(ch); await frame(); }
  },
  /** Runs frames until this is on screen. */
  until: async (loc) => { for (let i = 0; i < 30 * FPS; i++) { await frame(); if (i % 6 === 0 && await loc.isVisible()) return; } throw new Error("never appeared"); },
};
async function reveal(loc) {
  await loc.waitFor({ timeout: 15_000 });
  for (let i = 0, b = await loc.boundingBox(); i < 6 && b.y + b.height > H - CLEAR; i++) {
    await r.jump(Math.min(340, b.y + b.height - (H - CLEAR) + 40));
    b = await loc.boundingBox();
  }
}

const shots = [];
try {
  for (const [i, s] of script.shots.entries()) {
    const { prep, run, caption, ...look } = s;
    shot = { ...look, caption: caption[lang], from: count };
    filming = false;
    await prep?.(r);
    filming = true;
    await run(r);
    filming = false;
    shots.push({ ...shot, to: count });
    console.log(`shot ${i + 1}/${script.shots.length} ok, ${count} frames`);
  }
} catch (e) {
  await page.screenshot({ path: join(out, "failed.png") });
  console.log("page said:", (await page.locator("body").innerText()).slice(0, 600).replace(/\n+/g, " | "));
  throw e;
} finally {
  if (missing.size) console.log("no fixture for:", [...missing].join(", "));
  writeFileSync(join(out, "timeline.json"), JSON.stringify({ id, lang, fps: FPS, frames: count, shots, after: (script.after ?? []).map((s) => ({ ...s, caption: s.caption?.[lang], line: s.line?.[lang] })) }, null, 1));
  await browser.close();
  server.close();
  server.closeAllConnections();
}
