// Runs before first paint (an external file, because the CSP forbids inline scripts).
// 1. Applies the saved theme (and site style) so the page never flashes the wrong look.
// 2. Refuses to show the app inside a frame (GitHub Pages cannot send frame-ancestors).
(function () {
  'use strict';
  var root = document.documentElement;

  if (window.top !== window.self) {
    root.setAttribute('data-framed', '');
    return;
  }

  var ID = /^[a-z][a-z0-9-]{0,39}$/;
  function read(key, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      return v && ID.test(v) ? v : fallback;
    } catch {
      return fallback;
    }
  }

  var mode = read('portal.theme.mode', 'system');
  var ink = read('portal.theme.style', 'classic') === 'ink';
  var light = read('portal.theme.light', 'default-light');
  var dark = read('portal.theme.dark', 'catppuccin-macchiato');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var useDark = mode === 'dark' || (mode !== 'light' && prefersDark);
  if (ink) root.setAttribute('data-style', 'ink');
  root.setAttribute('data-theme', ink ? (useDark ? 'ink' : 'ink-paper') : useDark ? dark : light);
  root.style.colorScheme = useDark ? 'dark' : 'light';
})();
