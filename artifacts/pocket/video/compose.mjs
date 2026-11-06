// Renders a recording: `node compose.mjs quotes en vertical` (or horizontal). Writes out/final/<id>-<lang>-<format>.mp4, .vtt and .jpg (poster).
// Chrome draws every output frame (the ground, the phone, the camera moves, tap rings, captions, the PDF and the closing card) and ffmpeg only encodes them.
// `--still=<seconds>` writes one frame to out/final/still.png instead, to check the look quickly. There is no sound yet: the videos read with captions alone.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ffmpeg from "ffmpeg-static";
import { chromium } from "playwright-core";
import { tokens } from "../../../docs/pocket-design/handoff/tokens/tokens.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FONTS = resolve(HERE, "../node_modules/@expo-google-fonts");
const LOGO = readFileSync(resolve(HERE, "../../../docs/pocket-design/handoff/icons/logo.svg"), "utf8").replace(/<metadata>[\s\S]*?<\/metadata>/, "").replace(/width="104" height="26"/, 'width="100%"');
const RATIO = 2532 / 1170;

// The phone runs off the bottom of the picture and the camera moves over it, so the screen stays large enough to read.
const FORMATS = {
  vertical: { w: 1080, h: 1920, phoneW: 790, cx: 540, top: 330, cap: "left:80px;right:80px;top:70px;height:220px;text-align:center;justify-content:center;font-size:66px", sheetW: 900 },
  horizontal: { w: 1920, h: 1080, phoneW: 500, cx: 500, top: 40, cap: "left:940px;right:110px;top:290px;height:500px;text-align:left;justify-content:flex-start;font-size:84px", sheetW: 760 },
};

const args = process.argv.slice(2);
const still = args.find((a) => a.startsWith("--still="))?.slice(8);
const [id, lang = "en", format = "vertical"] = args.filter((a) => !a.startsWith("--"));
const f = FORMATS[format];
const src = join(HERE, "out", `${id}-${lang}`);
const finals = join(HERE, "out", "final");
mkdirSync(finals, { recursive: true });
const tl = JSON.parse(readFileSync(join(src, "timeline.json"), "utf8"));
const color = tokens.color.light;

// Time in seconds: the app part, then each `after` scene, in order.
const appSecs = tl.frames / tl.fps;
let cursor = appSecs;
const scenes = tl.after.map((s) => { const at = cursor; cursor += s.secs; return { ...s, at }; });
const total = cursor;
const cues = [...tl.beats.map((b, i) => ({ text: b.caption, from: b.frame / tl.fps, to: (tl.beats[i + 1]?.frame ?? tl.frames) / tl.fps })), ...scenes.filter((s) => s.caption).map((s) => ({ text: s.caption, from: s.at, to: s.at + s.secs }))];

const font = (family, file) => pathToFileURL(join(FONTS, family, file)).href;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Cap;src:url(${font("geist", "600SemiBold/Geist_600SemiBold.ttf")})}
@font-face{font-family:Cap;src:url(${font("manrope", "600SemiBold/Manrope_600SemiBold.ttf")});unicode-range:U+30-39}
*{box-sizing:border-box}
html,body{margin:0;width:${f.w}px;height:${f.h}px;overflow:hidden;background:linear-gradient(0deg,#e6dff7 0,#efecf9 45%,#f3f5f8 100%);font-family:Cap;-webkit-font-smoothing:antialiased}
#phone{position:absolute;left:0;top:0;width:${f.phoneW}px;height:${Math.round(f.phoneW * RATIO)}px;transform-origin:0 0;will-change:transform;border-radius:${f.phoneW * 0.115}px;background:#101014;padding:${f.phoneW * 0.021}px;box-shadow:0 0 0 2px #3a3a42 inset,0 40px 90px -20px rgba(45,25,100,.42),0 12px 30px rgba(45,25,100,.18)}
#inner{position:relative;width:100%;height:100%;border-radius:${f.phoneW * 0.095}px;overflow:hidden;background:#fff}
#screen{display:block;width:100%;height:100%}
#ring{position:absolute;width:13%;aspect-ratio:1;border-radius:50%;background:rgba(106,47,191,.24);border:3px solid rgba(106,47,191,.85);transform:translate(-50%,-50%);opacity:0}
#fade{position:absolute;left:0;right:0;top:0;height:${format === "vertical" ? f.top + 30 : 0}px;background:linear-gradient(180deg,#f3f5f8 86%,rgba(243,245,248,0))}
.c{position:absolute;${f.cap};display:flex;align-items:center;color:${color.ink};line-height:1.14;letter-spacing:-.022em;opacity:0}
.c span{text-wrap:balance}
#box{position:absolute;overflow:hidden;${format === "vertical" ? `left:0;top:${f.top - 40}px;width:${f.w}px;height:${f.h - f.top + 40}px;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 44px)` : `left:0;top:0;width:900px;height:${f.h}px;-webkit-mask-image:linear-gradient(90deg,#000 90%,transparent 100%)`}}
#sheet{position:absolute;left:0;top:0;width:${f.sheetW}px;transform-origin:0 0;background:#fff;box-shadow:0 30px 80px -14px rgba(45,25,100,.38),0 4px 14px rgba(45,25,100,.14);opacity:0}
#sheet img{display:block;width:100%}
#end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${f.h * 0.03}px;background:#f3f5f8;opacity:0;color:${color.ink}}
#end .l{width:${format === "vertical" ? 560 : 620}px}
#end .t{font-size:${format === "vertical" ? 60 : 64}px;letter-spacing:-.02em}
#end .u{font-size:${format === "vertical" ? 38 : 40}px;color:${color.muted};letter-spacing:-.01em}
</style>
<div id="phone"><div id="inner"><img id="screen"><div id="ring"></div></div></div>
<div id="fade"></div>
<div id="box"><div id="sheet"><img src="${pathToFileURL(join(HERE, "out", "assets", `quote-${lang}-1.png`)).href}"></div></div>
${cues.map((c, i) => `<div class="c" id="c${i}"><span>${c.text}</span></div>`).join("")}
<div id="end"><div class="l">${LOGO}</div><div class="t">${scenes.find((s) => s.type === "end")?.line ?? ""}</div><div class="u">quoteai.ca</div></div>`;
writeFileSync(join(src, `${format}.html`), html);

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb", "--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: f.w, height: f.h } });
await page.goto(pathToFileURL(join(src, `${format}.html`)).href);
await page.evaluate(() => document.fonts.ready);

// All the motion, as a function of time, so any frame can be drawn on its own.
await page.evaluate(({ f, tl, cues, scenes, appSecs, base, ratio }) => {
  const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);
  const phoneH = f.phoneW * ratio;
  const viewTop = f.top, viewH = f.h - f.top;
  const MOVE = 0.9; // seconds a camera move takes
  const camera = (t) => {
    let z = tl.beats[0].zoom, y = tl.beats[0].focus;
    for (const b of tl.beats) {
      const k = smooth((t - b.frame / tl.fps) / MOVE);
      z = lerp(z, b.zoom, k); y = lerp(y, b.focus, k);
    }
    return { z, y };
  };
  window.draw = async (t) => {
    const n = Math.min(tl.frames - 1, Math.max(0, Math.round(t * tl.fps)));
    const img = $("screen");
    img.src = `${base}/${String(n).padStart(6, "0")}.jpg`;
    await img.decode();
    const { z, y } = camera(Math.min(t, appSecs));
    const pdf = scenes.find((s) => s.type === "pdf"), end = scenes.find((s) => s.type === "end");
    const away = pdf ? smooth((t - pdf.at) / 0.8) : 0;
    const h = phoneH * z;
    const minY = viewTop + viewH - h - 24, maxY = viewTop;
    const py = Math.min(maxY, Math.max(minY, viewTop + viewH / 2 - h * y));
    const px = f.cx - (f.phoneW * z) / 2;
    $("phone").style.transform = `translate(${px}px,${py + away * 260}px) scale(${z})`;
    $("phone").style.opacity = 1 - away;
    const tap = tl.taps.map((p) => ({ ...p, d: t - p.frame / tl.fps })).find((p) => p.d >= 0 && p.d < 0.5);
    const ring = $("ring");
    if (tap) { const k = tap.d / 0.5; ring.style.left = `${tap.x * 100}%`; ring.style.top = `${tap.y * 100}%`; ring.style.opacity = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55; ring.style.transform = `translate(-50%,-50%) scale(${0.72 + k * 0.6})`; } else ring.style.opacity = 0;
    cues.forEach((c, i) => {
      const k = smooth((t - c.from) / 0.32) * (1 - smooth((t - c.to + 0.16) / 0.16));
      const el = $(`c${i}`);
      el.style.opacity = k;
      el.style.transform = `translateY(${(1 - smooth((t - c.from) / 0.32)) * 22}px)`;
    });
    const sheet = $("sheet");
    if (pdf) {
      const p = t - pdf.at, sheetH = sheet.offsetHeight, box = $("box");
      const rise = smooth(p / 0.8);
      // Opens on the logo and the company's name, pulls back to the whole page, then closes in on the total.
      const out = smooth((p - 1.9) / 1.5), total = smooth((p - 4) / 1.5);
      const s = lerp(lerp(1.8, 1, out), 1.55, total);
      const fx = lerp(lerp(0.36, 0.5, out), 0.68, total), fy = lerp(lerp(0.05, 0.5, out), 0.7, total);
      const x = box.offsetWidth / 2 - f.sheetW * s * fx;
      const y = box.offsetHeight * lerp(0.2, 0.5, out) - sheetH * s * fy;
      sheet.style.opacity = rise;
      sheet.style.transform = `translate(${x}px,${y + (1 - rise) * 200}px) scale(${s})`;
    }
    $("end").style.opacity = end ? smooth((t - end.at) / 0.5) : 0;
    $("fade").style.opacity = 1;
  };
}, { f, tl: { ...tl }, cues, scenes, appSecs, base: pathToFileURL(join(src, "frames")).href, ratio: RATIO });

if (still) {
  await page.evaluate((t) => window.draw(t), Number(still));
  await page.screenshot({ path: join(finals, "still.png") });
  await browser.close();
  process.exit(0);
}

const name = `${id}-${lang}-${format}`;
const mp4 = join(finals, `${name}.mp4`);
const enc = spawn(ffmpeg, ["-y", "-f", "image2pipe", "-framerate", String(tl.fps), "-c:v", "mjpeg", "-i", "-", "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-profile:v", "high", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", mp4], { stdio: ["pipe", "ignore", "inherit"] });
const count = Math.round(total * tl.fps);
for (let i = 0; i < count; i++) {
  await page.evaluate((t) => window.draw(t), i / tl.fps);
  const shot = await page.screenshot({ type: "jpeg", quality: 100 });
  if (!enc.stdin.write(shot)) await new Promise((res) => enc.stdin.once("drain", res));
  if (i % 300 === 0) console.log(`${i}/${count}`);
}
enc.stdin.end();
await new Promise((res) => enc.on("close", res));
await browser.close();

spawnSync(ffmpeg, ["-y", "-v", "error", "-ss", (scenes[0]?.at + 2).toFixed(2), "-i", mp4, "-frames:v", "1", "-q:v", "2", join(finals, `${name}.jpg`)]);
const stamp = (s) => new Date(s * 1000).toISOString().slice(11, 23);
writeFileSync(join(finals, `${name}.vtt`), `WEBVTT\n\n${cues.map((c) => `${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}`).join("\n\n")}\n`);
console.log(`${mp4} (${total.toFixed(1)} s)`);
