// Records one video from the production web build (never the dev server: its tools show on screen). First, in artifacts/pocket:
//   EXPO_PUBLIC_API_ORIGIN=http://localhost:8092 npx expo export -p web --output-dir video/out/web
// then `node record.mjs quotes en`. No API needed. Writes out/<id>-<lang>/frames/*.jpg and timeline.json (each frame's time, each beat's start and caption).
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
const W = 390, H = 844, SCALE = 1080 / 390;
const CLEAR = 130; // the tab bar and the orb cover this much of the bottom of the screen
const WRITE_MS = 3200; // how long "the AI" takes, so the writing screen is seen

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

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, locale: lang === "fr" ? "fr-CA" : "en-CA", timezoneId: "America/Toronto", colorScheme: "light", hasTouch: false });
await ctx.addInitScript(() => {
  localStorage.setItem("quoteai_session-token", "video-fixture");
  // The tap ring: drawn in the page so it is in the frames. Recording only; the app has no such thing.
  window.__tap = (x, y) => {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;left:${x - 26}px;top:${y - 26}px;width:52px;height:52px;border-radius:26px;background:rgba(106,47,191,.22);border:2px solid rgba(106,47,191,.75);pointer-events:none;z-index:2147483647;transition:transform .45s ease-out,opacity .45s ease-out`;
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = "scale(1.35)"; d.style.opacity = "0"; });
    setTimeout(() => d.remove(), 500);
  };
});
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(NOW));

const missing = new Set();
await page.route("**/api/**", async (route) => {
  const req = route.request();
  const path = new URL(req.url()).pathname;
  const hit = fixtures(req.method(), path, lang);
  if (hit === undefined) missing.add(`${req.method()} ${path}`);
  if (req.method() === "POST" && path === "/api/quotes") await new Promise((res) => setTimeout(res, WRITE_MS));
  return route.fulfill({ status: hit === undefined ? 404 : 200, contentType: "application/json", body: JSON.stringify(hit ?? { error: "no fixture" }) });
});

await page.goto(ORIGIN + script.start, { waitUntil: "load", timeout: 120_000 });
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(2500);

const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const file = `${String(frames.length).padStart(6, "0")}.jpg`;
  writeFileSync(join(out, "frames", file), Buffer.from(data, "base64"));
  frames.push({ file, at: metadata.timestamp });
  void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1080, maxHeight: 2340, everyNthFrame: 1 });

const r = {
  lang,
  // Only what is on screen: the screens under this one stay mounted in the stack, with the same words.
  t: (en, fr) => page.getByText(lang === "fr" ? fr : en).locator("visible=true").first(),
  exact: (s) => page.getByText(s, { exact: true }).locator("visible=true").first(),
  hold: (ms) => page.waitForTimeout(ms),
  tap: async (loc) => {
    await loc.waitFor({ timeout: 15_000 });
    // Scroll as a thumb would, and stop clear of the tab bar (a jump would look wrong in the video).
    let b = await loc.boundingBox();
    for (let i = 0; i < 6 && b.y + b.height > H - CLEAR; i++) {
      await r.scroll(Math.min(320, b.y + b.height - (H - CLEAR) + 40));
      await page.waitForTimeout(250);
      b = await loc.boundingBox();
    }
    await page.waitForTimeout(250);
    await page.evaluate(([x, y]) => window.__tap(x, y), [b.x + b.width / 2, b.y + b.height / 2]);
    await page.waitForTimeout(220);
    await loc.click();
  },
  type: async (text) => {
    const box = page.locator("textarea").locator("visible=true").first();
    await box.evaluate((e) => { e.spellcheck = false; }); // the recording browser's red underlines aren't the app's
    await box.click();
    await page.keyboard.type(text, { delay: 26 });
  },
  done: () => r.t("Open the quote", "Ouvrir la soumission").waitFor({ timeout: 20_000 }),
  scroll: async (dy) => { await page.mouse.move(W / 2, H / 2); for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, dy / 14); await page.waitForTimeout(30); } },
};

const beats = [];
const clock0 = Date.now() / 1000;
try {
  for (const [i, beat] of script.beats.entries()) {
    beats.push({ at: Date.now() / 1000, caption: beat.caption[lang] });
    await beat.run(r);
    console.log(`beat ${i + 1}/${script.beats.length} ok`);
  }
} catch (e) {
  await page.screenshot({ path: join(out, "failed.png") });
  console.log("page said:", (await page.locator("body").innerText()).slice(0, 600).replace(/\n+/g, " | "));
  throw e;
} finally {
  await cdp.send("Page.stopScreencast").catch(() => {});
  if (missing.size) console.log("no fixture for:", [...missing].join(", "));
  const end = Date.now() / 1000;
  writeFileSync(join(out, "timeline.json"), JSON.stringify({ id, lang, start: clock0, end, beats, frames }, null, 1));
  console.log(`${frames.length} frames, ${(end - clock0).toFixed(1)} s`);
  await browser.close();
  server.close();
  server.closeAllConnections();
}
