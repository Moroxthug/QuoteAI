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
const LANG = args.get("lang") ?? "en";
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
const src = dirOf(FROM);
if (!existsSync(src)) {
  console.error(`[phone-sheets] no screenshots at ${src} — run qa:visual with --widths=${WIDTH} --out=${FROM} first`);
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
  const file = resolve(OUT, `${name}.png`);
  await sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } }).composite(layers).png({ compressionLevel: 9 }).toFile(file);
  return file;
}

mkdirSync(OUT, { recursive: true });
const pngs = readdirSync(src).filter((f) => f.endsWith(".png") && (FILTER.length === 0 || FILTER.some((x) => f.includes(x)))).sort();
const made: Array<{ name: string; screens: number; before?: number }> = [];
for (const f of pngs) {
  const name = basename(f, ".png");
  const after = await frames(resolve(src, f));
  const rows: Row[] = [];
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

// One page to flick through on a phone: every sheet, widest first, with its height.
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phone sheets — ${esc(FROM)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:16px;color:#101031}h1{font-size:20px}figure{margin:0 0 28px}figcaption{font-weight:700;margin-bottom:6px}img{max-width:100%;border:1px solid #dfe1e6;border-radius:8px}</style>
<h1>Phone sheets — ${esc(FROM)} (${LANG}, ${WIDTH} px, first ${FRAMES} screens)</h1>
${made.map((m) => `<figure><figcaption>${esc(m.name)} — ${m.screens.toFixed(1)} screens${m.before !== undefined ? ` (was ${m.before.toFixed(1)})` : ""}</figcaption><img src="${encodeURIComponent(m.name)}.png" loading="lazy" alt=""></figure>`).join("\n")}
`;
writeFileSync(resolve(OUT, "index.html"), html);
console.log(`\n[phone-sheets] ${made.length} sheet(s) → ${OUT}`);
