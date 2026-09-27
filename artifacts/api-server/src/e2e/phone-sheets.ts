// Phase 100 — phone contact sheets (docs/MOBILE-AND-APP-PLAN.md §A.4).
//
// A full-page 375 px screenshot is a 6,000 px ribbon nobody reads. This cuts
// each one into phone-sized frames (812 px, what a phone shows at once) and
// lays the first few side by side, so "what does a contractor see on the
// first three screens" is one glance. Given a baseline folder it stacks the
// before (top) over the after (bottom). Every Track A phase attaches its
// sheets to the build log.
//
//   pnpm --filter @workspace/api-server qa:visual -- --lang=en --widths=375 --axe=false --sr=false --out=p100 --routes=quotes
//   pnpm --filter @workspace/api-server qa:phone-sheets -- --from=p100
//   pnpm --filter @workspace/api-server qa:phone-sheets -- --from=p100 --baseline=visual-mobile-audit --routes=dashboard-quotes --frames=4
//   pnpm --filter @workspace/api-server qa:phone-sheets -- --from=p113 --lang=en,fr --format=jpg --scale=0.7   # Phase 113: the review page
//
// With two languages each sheet stacks EN over FR (same route, same frames),
// and index.html lists every route tallest first — the one page the owner
// flicks through on a phone. --format=jpg --scale=0.7 keeps it light enough to
// publish.
//
// Reads  .qa/<from>/<lang>/<width>/*.png   (qa:visual's layout)
// Writes .qa/phone-sheets/<from>/<route>.png + index.html (open it on a phone).

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import sharp, { type OverlayOptions } from "sharp";

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1]!, m[2] ?? "true");
}
const QA = resolve(import.meta.dirname, "../../.qa");
const FROM = args.get("from") ?? "visual";
const LANGS = (args.get("lang") ?? "en").split(",").filter(Boolean);
const LANG = LANGS[0]!;
const FORMAT = args.get("format") === "jpg" ? "jpg" : "png";
const SCALE = Number(args.get("scale") ?? 1);
const WIDTH = Number(args.get("width") ?? 375);
const FRAME_H = Number(args.get("frame") ?? 812);
const FRAMES = Number(args.get("frames") ?? 3);
const BASELINE = args.get("baseline");
const FILTER = (args.get("routes") ?? "").split(",").filter(Boolean);
const OUT = resolve(QA, "phone-sheets", args.get("out") ?? FROM);

const GAP = 24;
const LABEL_H = 34;
const PAD = 20;

const dirOf = (run: string) => resolve(QA, run, LANG, String(WIDTH));
const dirOfLang = (run: string, lang: string) => resolve(QA, run, lang, String(WIDTH));
const src = dirOf(FROM);
for (const lang of LANGS) {
  if (!existsSync(dirOfLang(FROM, lang))) {
    console.error(`[phone-sheets] no screenshots at ${dirOfLang(FROM, lang)} — run qa:visual with --lang=${lang} --widths=${WIDTH} --out=${FROM} first`);
    process.exit(1);
  }
}
if (BASELINE && LANGS.length > 1) {
  console.error("[phone-sheets] --baseline compares one language: pass a single --lang");
  process.exit(1);
}
const base = BASELINE ? dirOf(BASELINE) : null;
if (base && !existsSync(base)) {
  console.error(`[phone-sheets] no baseline at ${base}`);
  process.exit(1);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const text = (w: number, h: number, s: string, size = 15, weight = 700, color = "#101031") =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="0" y="${Math.round(h * 0.7)}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(s)}</text></svg>`);

/** Cuts one screenshot into up to `FRAMES` phone frames; returns them with the page's height in screens. */
async function frames(file: string) {
  const img = sharp(file);
  const { width = WIDTH, height = 0 } = await img.metadata();
  const n = Math.min(FRAMES, Math.ceil(height / FRAME_H));
  const out: Buffer[] = [];
  for (let i = 0; i < n; i++) {
    const top = i * FRAME_H;
    const h = Math.min(FRAME_H, height - top);
    const cut = await sharp(file).extract({ left: 0, top, width, height: h }).toBuffer();
    // Pad a short last frame to full height so the row lines up; a hairline frames each screen.
    out.push(await sharp({ create: { width: width + 2, height: FRAME_H + 2, channels: 3, background: "#dfe1e6" } })
      .composite([{ input: await sharp({ create: { width, height: FRAME_H, channels: 3, background: "#f4f5f7" } }).composite([{ input: cut, top: 0, left: 0 }]).png().toBuffer(), top: 1, left: 1 }])
      .png().toBuffer());
  }
  return { frames: out, screens: height / FRAME_H, width: width + 2 };
}

type Row = { label: string; frames: Buffer[]; screens: number; width: number };

async function sheet(name: string, rows: Row[]) {
  const colW = rows[0]!.width;
  const w = PAD * 2 + FRAMES * colW + (FRAMES - 1) * GAP;
  const rowH = LABEL_H + FRAME_H + 2;
  const h = PAD * 2 + rows.length * rowH + (rows.length - 1) * GAP;
  const layers: OverlayOptions[] = [];
  rows.forEach((row, r) => {
    const y = PAD + r * (rowH + GAP);
    layers.push({ input: text(w - PAD * 2, LABEL_H, `${row.label} — ${row.screens.toFixed(1)} screens`), top: y, left: PAD });
    row.frames.forEach((f, i) => layers.push({ input: f, top: y + LABEL_H, left: PAD + i * (colW + GAP) }));
    for (let i = row.frames.length; i < FRAMES; i++) {
      layers.push({ input: text(colW, 40, "(end of page)", 13, 600, "#6d6f76"), top: y + LABEL_H + 12, left: PAD + i * (colW + GAP) });
    }
  });
  const file = resolve(OUT, `${name}.${FORMAT}`);
  let img = sharp(await sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } }).composite(layers).png().toBuffer());
  if (SCALE !== 1) img = img.resize({ width: Math.round(w * SCALE) });
  await (FORMAT === "jpg" ? img.jpeg({ quality: 72, mozjpeg: true }) : img.png({ compressionLevel: 9 })).toFile(file);
  return file;
}

mkdirSync(OUT, { recursive: true });
const wanted = (f: string) => f.endsWith(".png") && (FILTER.length === 0 || FILTER.some((x) => f.includes(x)));
const pngs = [...new Set(LANGS.flatMap((l) => readdirSync(dirOfLang(FROM, l)).filter(wanted)))].sort();
const made: Array<{ name: string; screens: number; before?: number; byLang?: Record<string, number> }> = [];
for (const f of pngs) {
  const name = basename(f, ".png");
  const rows: Row[] = [];
  if (LANGS.length > 1) {
    // Phase 113: one sheet per route, a row per language.
    const byLang: Record<string, number> = {};
    for (const lang of LANGS) {
      const file = resolve(dirOfLang(FROM, lang), f);
      if (!existsSync(file)) continue;
      const fr = await frames(file);
      byLang[lang] = fr.screens;
      rows.push({ label: `${lang.toUpperCase()} · ${name}`, ...fr });
    }
    await sheet(name, rows);
    made.push({ name, screens: Math.max(...Object.values(byLang)), byLang });
    console.log(`${name.padEnd(64)} ${Object.entries(byLang).map(([l, n]) => `${l} ${n.toFixed(1)}`).join(" · ")} screens`);
    continue;
  }
  const after = await frames(resolve(src, f));
  let before: Awaited<ReturnType<typeof frames>> | null = null;
  if (base && existsSync(resolve(base, f))) {
    before = await frames(resolve(base, f));
    rows.push({ label: `before (${BASELINE})`, ...before });
  }
  rows.push({ label: before ? `after (${FROM})` : name, ...after });
  await sheet(name, rows);
  made.push({ name, screens: after.screens, before: before?.screens });
  console.log(`${name.padEnd(64)} ${after.screens.toFixed(1)} screens${before ? ` (was ${before.screens.toFixed(1)})` : ""}`);
}

// One page to flick through on a phone: every sheet, tallest first (Phase 113; it was alphabetical), with its height.
made.sort((a, b) => b.screens - a.screens);
const heights = (m: (typeof made)[number]) =>
  m.byLang ? Object.entries(m.byLang).map(([l, n]) => `${l.toUpperCase()} ${n.toFixed(1)}`).join(" · ") : `${m.screens.toFixed(1)}${m.before !== undefined ? ` (was ${m.before.toFixed(1)})` : ""}`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phone sheets — ${esc(FROM)}</title>
<style>:root{color-scheme:light}body{font:15px/1.5 system-ui,sans-serif;margin:16px;color:#101031;background:#fff}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#4a4c55}figure{margin:0 0 28px}figcaption{font-weight:700;margin-bottom:6px}figcaption span{font-weight:400;color:#4a4c55}img{max-width:100%;height:auto;border:1px solid #dfe1e6;border-radius:8px}</style>
<h1>Phone sheets — ${esc(FROM)}</h1>
<p>${made.length} pages at ${WIDTH} px (${LANGS.map((l) => l.toUpperCase()).join(" over ")}), the first ${FRAMES} phone screens of each, tallest page first. Heights are in phone screens of ${FRAME_H} px.</p>
${made.map((m) => `<figure id="${esc(m.name)}"><figcaption>${esc(m.name)} <span>— ${heights(m)} screens</span></figcaption><img src="${encodeURIComponent(m.name)}.${FORMAT}" loading="lazy" alt="${esc(m.name)}, first phone screens"></figure>`).join("\n")}
</html>
`;
writeFileSync(resolve(OUT, "index.html"), html);
console.log(`\n[phone-sheets] ${made.length} sheet(s) → ${OUT}`);
