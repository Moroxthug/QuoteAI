// Phase 118: the app's launcher icons and launch screens, drawn from the brand
// mark the website already ships (quote-ai/public/icon-512.png) so there is
// one source. Writes the Android resources in place; run after changing the
// mark: `pnpm --filter @workspace/mobile icons`.
//
// - ic_launcher_foreground (108 dp adaptive layer): the mark at half the
//   canvas, well inside the 72 dp every launcher mask keeps, on white
//   (values/ic_launcher_background.xml).
// - ic_launcher / ic_launcher_round (48 dp, Android 7 and older launchers).
// - splash (the launch screen before Android 12; 12+ draws the icon itself on
//   windowSplashScreenBackground, values/styles.xml).
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const res = path.join(root, "android/app/src/main/res");
const mark = readFileSync(path.resolve(root, "../quote-ai/public/icon-512.png")).toString("base64");
const WHITE = "#ffffff";

function png(width: number, height: number, body: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
  return new Resvg(svg, { fitTo: { mode: "original" } }).render().asPng();
}

function markAt(cx: number, cy: number, size: number): string {
  return `<image x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" xlink:href="data:image/png;base64,${mark}"/>`;
}

const DENSITIES: Record<string, number> = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = path.join(res, `mipmap-${name}`);
  const fg = Math.round(108 * scale);
  writeFileSync(path.join(dir, "ic_launcher_foreground.png"), png(fg, fg, markAt(fg / 2, fg / 2, fg * 0.5)));
  const legacy = Math.round(48 * scale);
  const r = legacy * 0.12;
  writeFileSync(path.join(dir, "ic_launcher.png"), png(legacy, legacy, `<rect width="${legacy}" height="${legacy}" rx="${r}" fill="${WHITE}"/>${markAt(legacy / 2, legacy / 2, legacy * 0.78)}`));
  writeFileSync(path.join(dir, "ic_launcher_round.png"), png(legacy, legacy, `<circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}" fill="${WHITE}"/>${markAt(legacy / 2, legacy / 2, legacy * 0.7)}`));
}

// Launch screens: every splash.png Capacitor generated, redrawn at its own size.
for (const dir of readdirSync(res).filter((d) => d.startsWith("drawable"))) {
  const file = path.join(res, dir, "splash.png");
  let buf: Buffer;
  try {
    buf = readFileSync(file);
  } catch {
    continue;
  }
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const size = Math.round(Math.min(w, h) * 0.28);
  writeFileSync(file, png(w, h, `<rect width="${w}" height="${h}" fill="${WHITE}"/>${markAt(w / 2, h / 2, size)}`));
}

// The store listing's icon (Play: 512×512, no transparency) for Phase 124/126.
writeFileSync(path.join(root, "assets/store-icon-512.png"), png(512, 512, `<rect width="512" height="512" fill="${WHITE}"/>${markAt(256, 256, 400)}`));
console.log("Icons and launch screens written.");
