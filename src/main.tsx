import { render } from 'preact';
import './styles/app.css';
import { App } from './app/App';
import { initTheme } from './app/ThemeToggle';
import { setAppStatus } from './core/app-status';
import { store } from './core/db/store';
import { initStudyPrefs } from './core/study-prefs';
import { registerServiceWorker } from './core/sw-register';
import { ErrorBoundary } from './core/ui/ErrorBoundary';

// theme-init.js marks the page when it is loaded inside a frame; never render there.
const framed = document.documentElement.hasAttribute('data-framed') || window.top !== window.self;
const mount = document.getElementById('app');

if (!framed && mount) {
  // Before rendering: if this version crashes on start, a fixed one can still arrive.
  if (import.meta.env.PROD) void registerServiceWorker();
  // A part of the page that loads later (e.g. auto-fill) is missing: this tab is running
  // an older version whose files were replaced. Reloading gets the current ones.
  window.addEventListener('vite:preloadError', () => {
    setAppStatus({ reload: 'files-missing' });
  });
  initTheme();
  initStudyPrefs();
  render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
    mount,
  );
  // Tidy up cards deleted long ago, once a day, when the page has settled.
  window.setTimeout(() => {
    void tidyUp();
  }, 5_000);
}

async function tidyUp() {
  try {
    const last = await store.getMeta('lastTidyAt');
    if (typeof last === 'number' && Date.now() - last < 86_400_000) return;
    await store.compactDeleted();
    await store.setMeta('lastTidyAt', Date.now());
  } catch {
    // Not important: it will try again next time.
  }
}
