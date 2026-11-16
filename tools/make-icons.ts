// Renders the app icons (public/icons/*.png) with headless Chromium.
//   node tools/make-icons.ts
// Needs a CJK font on the machine (macOS has PingFang). Output PNGs are committed.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BG = '#c6a0f6'; // Catppuccin Macchiato mauve
const FG = '#181926';

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
  // Maskable icons keep the glyph inside the central 80% safe zone and fill the square.
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const glyph = Math.round(size * (maskable ? 0.5 : 0.66));
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${BG};display:grid;place-items:center">
      <span style="font-family:'PingFang TC','Noto Sans TC',sans-serif;font-weight:600;font-size:${glyph}px;line-height:1;color:${FG}">餃</span>
    </div></body></html>`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: true });
  console.log(`public/icons/${file}`);
}
await browser.close();
