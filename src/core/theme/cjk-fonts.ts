/**
 * Chinese fonts for devices that don't have one for the chosen character style (phones
 * have no Chinese serif or handwriting font). The stylesheet for a style is added only
 * while it's in use: Serif (also always in 墨 Ink, whose logo and background characters
 * are serif) or Handwriting. Each font is listed after the device's own (app.css), so the
 * browser downloads a piece of it only for characters no installed font has, and only the
 * pieces for characters on screen. See vite.config.ts for how the pieces are made.
 */

function setSheet(id: string, href: string, on: boolean): void {
  const existing = document.getElementById(id);
  if (on && !existing) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.append(link);
  } else if (!on && existing) {
    existing.remove();
  }
}

/** Adds or removes the stylesheets to match the current character style and site style. */
export function syncCjkFonts(): void {
  const root = document.documentElement;
  const font = root.dataset.hanziFont;
  setSheet('cjk-serif', __CJK_FONT_SHEETS__.serif, font === 'serif' || root.dataset.style === 'ink');
  setSheet('cjk-kai', __CJK_FONT_SHEETS__.kai, font === 'kai');
}

/** Keeps the stylesheets in step whenever the character style or site style changes. */
export function watchCjkFonts(): void {
  syncCjkFonts();
  new MutationObserver(syncCjkFonts).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-hanzi-font', 'data-style'],
  });
}
