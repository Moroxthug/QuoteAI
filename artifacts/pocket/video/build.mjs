// Renders a recording: `node build.mjs quotes en vertical` (or horizontal). Writes out/final/<id>-<lang>-<format>.mp4, .vtt and .jpg (poster).
// Chrome draws the background, the phone frame and each caption with the app's fonts and tokens; ffmpeg lays them over the recorded frames.
// There is no sound yet: the videos are made to read with captions alone.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ffmpeg from "ffmpeg-static";
import { chromium } from "playwright-core";
import { tokens } from "../../../docs/pocket-design/handoff/tokens/tokens.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FONTS = resolve(HERE, "../node_modules/@expo-google-fonts");
const FPS = 30;
const SCREEN = 1080 / 2337; // width over height of the recorded phone screen

const FORMATS = {
  vertical: { w: 1080, h: 1920, phoneH: 1600, phoneX: null, phoneY: 56, caption: "left:70px;right:70px;top:1690px;height:190px;text-align:center;font-size:54px" },
  horizontal: { w: 1920, h: 1080, phoneH: 1000, phoneX: 250, phoneY: 40, caption: "left:860px;right:120px;top:300px;height:480px;text-align:left;font-size:72px" },
};

const [id, lang = "en", format = "vertical"] = process.argv.slice(2);
const f = FORMATS[format];
const src = join(HERE, "out", `${id}-${lang}`);
const work = join(src, format);
const finals = join(HERE, "out", "final");
mkdirSync(work, { recursive: true });
mkdirSync(finals, { recursive: true });

const timeline = JSON.parse(readFileSync(join(src, "timeline.json"), "utf8"));
const t0 = timeline.frames[0].at;
const total = timeline.end - t0;
const cues = timeline.beats.map((b, i) => ({ text: b.caption, from: Math.max(0, b.at - t0), to: (timeline.beats[i + 1]?.at ?? timeline.end) - t0 }));

const phoneW = Math.round((f.phoneH * SCREEN) / 2) * 2;
const phoneX = f.phoneX ?? Math.round((f.w - phoneW) / 2);
const color = tokens.color.light;
const font = (family, file) => pathToFileURL(join(FONTS, family, file)).href;
const page0 = `<style>
@font-face{font-family:Cap;src:url(${font("geist", "600SemiBold/Geist_600SemiBold.ttf")})}
@font-face{font-family:Cap;src:url(${font("manrope", "600SemiBold/Manrope_600SemiBold.ttf")});unicode-range:U+30-39}
html,body{margin:0;background:transparent;width:${f.w}px;height:${f.h}px;overflow:hidden}
.c span{text-wrap:balance}
.c{position:absolute;${f.caption};display:flex;align-items:center;justify-content:${format === "vertical" ? "center" : "flex-start"};font-family:Cap;color:${color.ink};line-height:1.2;letter-spacing:-.01em}
</style>`;

// The ground, with a rounded window for the screen. Drawn as a path so the window is truly see-through.
const r = Math.round(phoneW * 0.085);
const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f.w}" height="${f.h}" style="position:absolute;inset:0">
<defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ece6f8"/><stop offset="1" stop-color="#f3f5f8"/></linearGradient>
<mask id="m"><rect width="100%" height="100%" fill="#fff"/><rect x="${phoneX}" y="${f.phoneY}" width="${phoneW}" height="${f.phoneH}" rx="${r}" fill="#000"/></mask></defs>
<rect width="100%" height="100%" fill="url(#g)" mask="url(#m)"/>
<rect x="${phoneX - 7}" y="${f.phoneY - 7}" width="${phoneW + 14}" height="${f.phoneH + 14}" rx="${r + 7}" fill="none" stroke="${color.ink}" stroke-width="14"/></svg>`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: f.w, height: f.h } });
const shot = async (html, name) => {
  const file = join(work, name);
  writeFileSync(join(work, "layer.html"), `<!doctype html><meta charset="utf-8">${page0}${html}`);
  await page.goto(pathToFileURL(join(work, "layer.html")).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: true });
  return file;
};
const frame = await shot(frameSvg, "frame.png");
const caps = [];
for (const [i, c] of cues.entries()) caps.push(await shot(`<div class="c"><span>${c.text}</span></div>`, `cap${i}.png`));
await browser.close();

// Each recorded frame stays up until the next one: Chrome only sends a frame when the screen changes.
const list = timeline.frames.map((fr, i) => `file 'frames/${fr.file}'\nduration ${(((timeline.frames[i + 1]?.at ?? timeline.end) - fr.at) || 0.001).toFixed(4)}`).join("\n");
writeFileSync(join(src, "frames.txt"), `${list}\nfile 'frames/${timeline.frames.at(-1).file}'\n`);

const name = `${id}-${lang}-${format}`;
const mp4 = join(finals, `${name}.mp4`);
const filter = [
  `color=c=white:s=${f.w}x${f.h}:r=${FPS}:d=${total.toFixed(3)}[base]`,
  `[0:v]fps=${FPS},scale=${phoneW}:${f.phoneH}:flags=lanczos[s]`,
  `[base][s]overlay=${phoneX}:${f.phoneY}:shortest=1[a]`,
  `[a][1:v]overlay=0:0[l0]`,
  ...cues.map((c, i) => `[l${i}][${i + 2}:v]overlay=0:0:enable='between(t,${c.from.toFixed(3)},${c.to.toFixed(3)})'[l${i + 1}]`),
].join(";");
const run = (args) => {
  const p = spawnSync(ffmpeg, args, { encoding: "utf8", maxBuffer: 1 << 26 });
  if (p.status !== 0) throw new Error(p.stderr.slice(-1500));
};
run(["-y", "-f", "concat", "-safe", "0", "-i", join(src, "frames.txt"), "-i", frame, ...caps.flatMap((c) => ["-i", c]), "-filter_complex", filter, "-map", `[l${cues.length}]`, "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
run(["-y", "-ss", (cues.at(-1).from + 2).toFixed(2), "-i", mp4, "-frames:v", "1", "-q:v", "3", join(finals, `${name}.jpg`)]);

const stamp = (s) => new Date(s * 1000).toISOString().slice(11, 23);
writeFileSync(join(finals, `${name}.vtt`), `WEBVTT\n\n${cues.map((c) => `${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}`).join("\n\n")}\n`);
console.log(`${mp4} (${total.toFixed(1)} s)`);
