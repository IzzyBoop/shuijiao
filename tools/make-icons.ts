// Renders the app icons (public/icons/*.png) with headless Chromium.
//   node tools/make-icons.ts
// In the 墨 Ink look: a bone-coloured serif 餃 on black, with a short underline in Ink's
// orange signal colour. Needs a CJK serif on the machine (macOS has Songti TC). Output PNGs
// are committed.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BG = '#000000'; // Ink paper
const FG = '#cdc4ba'; // Ink bone
const SUN = '#ce5e32'; // Ink signal

const sizes: { file: string; size: number; maskable: boolean }[] = [
  { file: 'favicon-32.png', size: 32, maskable: false },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-512.png', size: 512, maskable: true },
];

await mkdir('public/icons', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

for (const { file, size, maskable } of sizes) {
  // Maskable icons fill the square and keep everything inside the central 80% safe zone.
  const radius = maskable ? 0 : Math.round(size * 0.1);
  const glyph = Math.round(size * (maskable ? 0.5 : 0.64));
  const line = Math.max(2, Math.round(size * 0.035));
  const lineWidth = Math.round(glyph * 0.42);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${BG};display:grid;place-items:center">
      <div style="display:grid;justify-items:center;gap:${Math.round(glyph * 0.14)}px;transform:translateY(${Math.round(size * -0.01)}px)">
        <span style="font-family:'Songti TC','Noto Serif TC','Noto Serif CJK TC',serif;font-weight:700;font-size:${glyph}px;line-height:1;color:${FG}">餃</span>
        <span style="width:${lineWidth}px;height:${line}px;background:${SUN}"></span>
      </div>
    </div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: true });
  console.log(`public/icons/${file}`);
}
await browser.close();
