// Cuts a recording into the finished film: `node compose.mjs quotes en vertical` (or horizontal). Writes out/final/<id>-<lang>-<format>.mp4, .vtt and .jpg (poster).
// Chrome draws every output frame (the ground, the phone at an angle, whip cuts, colour wipes, cards lifted out of the screen, captions that build word by word, the PDF and the
// closing card) and ffmpeg only encodes them. `--still=<seconds>` writes one frame to out/final/still.png, to check the look quickly. No sound yet: the videos read with captions alone.
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

// The phone runs off the picture and the camera moves over it, so the screen stays large enough to read. Horizontal shots swap sides.
const FORMATS = {
  vertical: { w: 1080, h: 1920, phoneW: 760, top: 300, stageTop: 270, sides: [{ cx: 540, cap: "left:80px;right:80px;top:64px;height:210px;text-align:center;justify-content:center;font-size:66px" }], liftW: 980, sheetW: 900 },
  horizontal: { w: 1920, h: 1080, phoneW: 520, top: 0, stageTop: 0, sides: [{ cx: 480, cap: "left:980px;right:110px;top:290px;height:500px;text-align:left;justify-content:flex-start;font-size:84px" }, { cx: 1440, cap: "left:110px;right:980px;top:290px;height:500px;text-align:left;justify-content:flex-start;font-size:84px" }], liftW: 800, sheetW: 760 },
};

const args = process.argv.slice(2);
const still = args.find((a) => a.startsWith("--still="))?.slice(8);
const [id, lang = "en", format = "vertical"] = args.filter((a) => !a.startsWith("--"));
const loop = args.includes("--loop"); // the homepage loop: the lifted shots only, no words, no PDF, no closing card
const f = FORMATS[format];
if (loop) f.sides = [{ cx: f.w / 2, cap: "" }]; // no words beside it, so the phone sits in the middle
const src = join(HERE, "out", `${id}-${lang}`);
const finals = join(HERE, "out", "final");
mkdirSync(finals, { recursive: true });
const tl = JSON.parse(readFileSync(join(src, "timeline.json"), "utf8"));
const color = tokens.color.light;
const VIOLET = color.acc;

// One running order: the filmed shots, then the `after` scenes.
// Sides alternate, but shots that share a caption stay together, and the PDF always sits on the first side.
let cursor = 0, side = 0, caption = null;
const scenes = [...tl.shots.map((s) => (s.type ? s : { ...s, type: "app", secs: (s.to - s.from) / tl.fps / (s.speed ?? 1) })), ...tl.after];
const order = (loop ? scenes.filter((s) => s.type === "app" && s.lift != null).map((s, i) => ({ ...s, caption: undefined, bg: "light", cut: i ? "left" : undefined })) : scenes).map((s, i) => {
  const at = cursor;
  cursor += s.secs;
  if (s.type === "pdf") side = 0;
  else if (i > 0 && s.caption !== caption) side = (side + 1) % f.sides.length;
  caption = s.caption;
  return { ...s, at, side };
});
const total = cursor;

// The same caption on two shots in a row stays up, unless the ground changes under it and it has to change colour.
const cues = [];
for (const s of order) {
  if (!s.caption) continue;
  const last = cues.at(-1);
  const white = s.bg === "violet";
  if (last?.text === s.caption && last.white === white) last.to = s.at + s.secs;
  else cues.push({ text: s.caption, from: s.at, to: s.at + s.secs, side: s.side, white });
}

const font = (family, file) => pathToFileURL(join(FONTS, family, file)).href;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Cap;src:url(${font("geist", "600SemiBold/Geist_600SemiBold.ttf")})}
@font-face{font-family:Cap;src:url(${font("manrope", "600SemiBold/Manrope_600SemiBold.ttf")});unicode-range:U+30-39}
*{box-sizing:border-box}
html,body{margin:0;width:${f.w}px;height:${f.h}px;overflow:hidden;background:linear-gradient(0deg,#e6dff7 0,#efecf9 45%,#f3f5f8 100%);font-family:Cap;-webkit-font-smoothing:antialiased}
#violet{position:absolute;inset:0;background:${VIOLET};opacity:0}
#stage{position:absolute;left:0;top:${f.stageTop}px;width:${f.w}px;height:${f.h - f.stageTop}px;overflow:hidden;perspective:2600px;${f.stageTop ? "-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 36px);" : ""}}
#phone{position:absolute;left:0;top:0;width:${f.phoneW}px;height:${Math.round(f.phoneW * RATIO)}px;will-change:transform;border-radius:${f.phoneW * 0.115}px;background:#101014;padding:${f.phoneW * 0.021}px;box-shadow:0 0 0 2px #3a3a42 inset,0 50px 110px -24px rgba(30,15,80,.5),0 14px 34px rgba(30,15,80,.2)}
#inner{position:relative;width:100%;height:100%;border-radius:${f.phoneW * 0.095}px;overflow:hidden;background:#fff}
#screen{display:block;width:100%;height:100%}
#anchor{position:absolute}
#scrim{position:absolute;inset:0;background:${color.ink};opacity:0}
#lift{position:absolute;left:0;top:0;overflow:hidden;border-radius:30px;opacity:0;box-shadow:0 44px 90px -18px rgba(20,10,60,.5),0 10px 26px rgba(20,10,60,.2)}
#lift img{position:absolute;left:0;top:0;display:block;max-width:none}
.c{position:absolute;display:flex;align-items:center;line-height:1.14;letter-spacing:-.022em;opacity:0}
.c span.l{text-wrap:balance}
.m{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .04em .14em;margin:0 -.04em -.14em}
.w{display:inline-block}
#box{position:absolute;overflow:hidden;perspective:2400px;opacity:0;${format === "vertical" ? `left:0;top:${f.stageTop}px;width:${f.w}px;height:${f.h - f.stageTop}px;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 36px)` : `left:0;top:0;width:940px;height:${f.h}px;-webkit-mask-image:linear-gradient(90deg,#000 92%,transparent 100%)`}}
#sheet{position:absolute;left:0;top:0;width:${f.sheetW}px;transform-origin:0 0;background:#fff;box-shadow:0 34px 90px -14px rgba(30,15,80,.4),0 4px 14px rgba(30,15,80,.14)}
#sheet img{display:block;width:100%}
#end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${f.h * 0.03}px;background:#f3f5f8;opacity:0;color:${color.ink}}
#end .l{width:${format === "vertical" ? 560 : 620}px}
#end .t{font-size:${format === "vertical" ? 60 : 64}px;letter-spacing:-.02em}
#end .u{font-size:${format === "vertical" ? 38 : 40}px;color:${color.muted};letter-spacing:-.01em}
.p{position:absolute;inset:0;transform:translateX(-101%)}
</style>
<svg width="0" height="0" style="position:absolute"><filter id="whip" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur id="whipB" stdDeviation="0 0"/></filter></svg>
<div id="violet"></div>
<div id="stage"><div id="phone"><div id="inner"><img id="screen"><div id="scrim"></div><div id="anchor"></div></div></div><div id="lift"><img id="crop"></div></div>
<div id="box"><div id="sheet"><img src="${pathToFileURL(join(HERE, "out", "assets", `quote-${lang}-1.png`)).href}"></div></div>
${cues.map((c, i) => `<div class="c" id="c${i}" style="${f.sides[c.side].cap};color:${c.white ? "#fff" : color.ink}"><span class="l">${c.text.split(" ").map((w) => `<span class="m"><span class="w">${w}</span></span>`).join(" ")}</span></div>`).join("")}
<div id="end"><div class="l">${LOGO}</div><div class="t">${order.find((s) => s.type === "end")?.line ?? ""}</div><div class="u">quoteai.ca</div></div>
<div class="p" id="p1" style="background:${color.ink}"></div><div class="p" id="p2" style="background:${VIOLET}"></div>`;
writeFileSync(join(src, `${format}.html`), html);

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb", "--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: f.w, height: f.h } });
await page.goto(pathToFileURL(join(src, `${format}.html`)).href);
await page.evaluate(() => document.fonts.ready);

// All the motion, as a function of time, so any frame can be drawn on its own.
await page.evaluate(({ f, fps, order, cues, base, ratio, vertical }) => {
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const smooth = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
  const expoOut = (x) => { const t = clamp(x); return t >= 1 ? 1 : 1 - 2 ** (-10 * t); };
  const expoIn = (x) => { const t = clamp(x); return t <= 0 ? 0 : 2 ** (10 * t - 10); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);
  const HALF = 0.26; // each side of a cut, in seconds
  const phoneW = f.phoneW, phoneH = phoneW * ratio;
  const stageH = f.h - f.stageTop;
  const pair = (v, p) => (Array.isArray(v) ? lerp(v[0], v[1], p) : v ?? 0);
  const words = cues.map((_, i) => [...$(`c${i}`).querySelectorAll(".w")]);

  // How far a cut has thrown things: 0 at rest, 1 fully gone, with the direction and the speed for the blur.
  const thrown = (i, t) => {
    const s = order[i], next = order[i + 1];
    if (next && next.cut !== "wipe" && t > s.at + s.secs - HALF) { const k = (t - (s.at + s.secs - HALF)) / HALF; return { k: expoIn(k), dir: next.cut, sign: -1, blur: k }; }
    if (s.cut && s.cut !== "wipe" && t < s.at + HALF) { const k = (t - s.at) / HALF; return { k: 1 - expoOut(k), dir: s.cut, sign: 1, blur: 1 - k }; }
    return { k: 0, dir: null, sign: 0, blur: 0 };
  };

  window.draw = async (t) => {
    let i = order.findIndex((s) => t < s.at + s.secs);
    if (i < 0) i = order.length - 1;
    const s = order[i], local = t - s.at, p = clamp(local / s.secs);
    const app = s.type === "app";

    $("violet").style.opacity = s.bg === "violet" ? 1 : 0;
    $("stage").style.visibility = app ? "visible" : "hidden";
    $("box").style.opacity = s.type === "pdf" ? 1 : 0;
    $("end").style.opacity = s.type === "end" ? 1 : 0;

    const th = thrown(i, t);
    const span = th.dir === "up" ? f.h * 1.1 : f.w * 1.15;
    const dx = th.dir === "left" ? th.sign * th.k * span : 0;
    const dy = th.dir === "up" ? th.sign * th.k * span : 0;
    const amount = Math.sin(clamp(th.blur) * Math.PI / 1.4) * 46 * (th.dir ? 1 : 0);
    $("whipB").setAttribute("stdDeviation", th.dir === "up" ? `0 ${amount}` : `${amount} 0`);
    $("stage").style.filter = th.dir ? "url(#whip)" : "none";

    if (app) {
      const n = s.from + Math.min(s.to - s.from - 1, Math.round(local * fps * (s.speed ?? 1)));
      const url = `${base}/${String(n).padStart(6, "0")}.jpg`;
      const img = $("screen"), crop = $("crop");
      img.src = url;
      await img.decode();

      // A slow drift through the shot, and an arrival that settles the turn.
      const settle = 1 - expoOut(local / 0.7);
      const z = pair(s.z, p), ry = pair(s.ry, p) + settle * (s.ry[0] >= 0 ? 7 : -7), rx = s.rx ?? 0, rz = s.rz ?? 0;
      const cx = f.sides[s.side].cx, cy = stageH / 2 + (f.top - f.stageTop) / 2;
      const focus = s.focus ?? 0.5;
      const phone = $("phone");
      phone.style.transformOrigin = `50% ${focus * 100}%`;
      phone.style.transform = `translate3d(${cx - phoneW / 2 + dx}px,${cy - phoneH * focus + dy}px,0) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${z})`;

      const lift = $("lift"), a = s.lift == null ? 0 : expoOut((local - s.lift) / 0.6);
      $("scrim").style.opacity = a * 0.34;
      if (s.spot && s.lift != null) {
        const anchor = $("anchor");
        Object.assign(anchor.style, { left: `${s.spot.x * 100}%`, top: `${s.spot.y * 100}%`, width: `${s.spot.w * 100}%`, height: `${s.spot.h * 100}%` });
        const from = anchor.getBoundingClientRect(), stage = $("stage").getBoundingClientRect();
        crop.src = url;
        await crop.decode();
        const aspect = (s.spot.h * ratio) / s.spot.w;
        const w = lerp(from.width, f.liftW, a), h = w * aspect;
        const x = lerp(from.left + from.width / 2, cx, a) - w / 2 + dx;
        const y = lerp(from.top - stage.top + from.height / 2, cy, a) - h / 2 + dy;
        lift.style.opacity = a > 0.001 ? 1 : 0;
        lift.style.width = `${w}px`;
        lift.style.height = `${h}px`;
        lift.style.transform = `translate(${x}px,${y}px)`;
        const iw = w / s.spot.w;
        crop.style.width = `${iw}px`;
        crop.style.height = `${iw * ratio}px`;
        crop.style.left = `${-s.spot.x * iw}px`;
        crop.style.top = `${-s.spot.y * iw * ratio}px`;
      } else lift.style.opacity = 0;
    }

    // Captions build word by word from behind a mask.
    cues.forEach((c, n) => {
      const el = $(`c${n}`), on = t >= c.from && t < c.to;
      el.style.opacity = on ? 1 - smooth((t - c.to + 0.14) / 0.14) : 0;
      if (on) words[n].forEach((w, k) => { w.style.transform = `translateY(${(1 - expoOut((t - c.from - 0.08 - k * 0.05) / 0.55)) * 118}%)`; });
    });

    if (s.type === "pdf") {
      const sheet = $("sheet"), box = $("box"), sheetH = sheet.offsetHeight;
      // Opens on the logo and the company's name, pulls back to the whole page, then closes in on the total.
      const open = expoOut(local / 0.9), out = smooth((local - 1.8) / 1.1), sum = smooth((local - 3.5) / 1.1);
      const sc = lerp(lerp(1.8, 1, out), 1.55, sum);
      const fx = lerp(lerp(0.36, 0.5, out), 0.68, sum), fy = lerp(lerp(0.05, 0.5, out), 0.7, sum);
      const x = box.offsetWidth / 2 - f.sheetW * sc * fx;
      const y = box.offsetHeight * lerp(0.2, 0.5, out) - sheetH * sc * fy;
      sheet.style.transform = `translate(${x}px,${y + (1 - open) * 300}px) rotateX(${(1 - open) * 14}deg) scale(${sc})`;
    }

    if (s.type === "end") {
      const k = expoOut(local / 0.8);
      document.querySelector("#end .l").style.transform = `scale(${0.92 + k * 0.08})`;
    }

    // A wipe: ink, then violet just behind it, cross the picture; the scene changes while they cover it.
    const edges = order.filter((o) => o.cut === "wipe").map((o) => o.at);
    const near = edges.find((e) => Math.abs(t - e) < 0.42);
    [["p1", -0.05], ["p2", 0.05]].forEach(([id, lag]) => {
      const q = near == null ? -1 : (t - near + lag) / 0.3; // -1 before it covers, 0 covered, 1 gone
      const pos = q < 0 ? -1 + expoOut(1 + q) : expoIn(q) ;
      const shown = near != null && q > -1 && q < 1;
      const off = pos * 101;
      $(id).style.transform = !shown ? "translateX(-101%)" : vertical ? `translateY(${-off}%)` : `translateX(${off}%)`;
    });
  };
}, { f, fps: tl.fps, order, cues, base: pathToFileURL(join(src, "frames")).href, ratio: RATIO, vertical: format === "vertical" });

// `--sheet`: one picture of every shot, side by side, to check a whole video at a glance.
if (args.includes("--sheet")) {
  const pics = [];
  for (const s of order) {
    await page.evaluate((t) => window.draw(t), s.at + s.secs * 0.72);
    pics.push((await page.screenshot({ type: "jpeg", quality: 80 })).toString("base64"));
  }
  const grid = await browser.newPage({ viewport: { width: 2000, height: 800 } });
  await grid.setContent(`<body style="margin:0;display:flex;flex-wrap:wrap;gap:6px;background:#222">${pics.map((p) => `<img style="height:${format === "vertical" ? 780 : 380}px" src="data:image/jpeg;base64,${p}">`).join("")}`);
  await grid.screenshot({ path: join(finals, `sheet-${id}-${lang}-${format}.jpg`), type: "jpeg", quality: 85, fullPage: true });
  await browser.close();
  process.exit(0);
}

if (still) {
  await page.evaluate((t) => window.draw(t), Number(still));
  await page.screenshot({ path: join(finals, "still.png") });
  await browser.close();
  process.exit(0);
}

const name = loop ? `loop-${lang}-${format}` : `${id}-${lang}-${format}`;
const mp4 = join(finals, `${name}.mp4`);
const enc = spawn(ffmpeg, ["-y", "-f", "image2pipe", "-framerate", String(tl.fps), "-c:v", "mjpeg", "-i", "-", "-vf", `${loop ? "fps=30,scale=-2:720:" : "scale="}out_color_matrix=bt709:out_range=tv,format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", loop ? "24" : "15", "-profile:v", "high", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", mp4], { stdio: ["pipe", "ignore", "inherit"] });
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

const pdfAt = order.find((s) => s.type === "pdf")?.at ?? order.find((s) => s.lift != null)?.at ?? 0; // the poster: the PDF, else the first card lifted out
spawnSync(ffmpeg, ["-y", "-v", "error", "-ss", (pdfAt + 1.2).toFixed(2), "-i", mp4, "-frames:v", "1", "-q:v", "2", join(finals, `${name}.jpg`)]);
const stamp = (s) => new Date(s * 1000).toISOString().slice(11, 23);
writeFileSync(join(finals, `${name}.vtt`), `WEBVTT\n\n${cues.map((c) => `${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}`).join("\n\n")}\n`);
console.log(`${mp4} (${total.toFixed(1)} s)`);
