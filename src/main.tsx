import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './styles/app.css';
import { App } from './app/App';
import { initTheme } from './app/ThemeToggle';
import { initStudyPrefs } from './core/study-prefs';
import { registerServiceWorker } from './core/sw-register';

function Root() {
  const [update, setUpdate] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (import.meta.env.PROD) {
      void registerServiceWorker((apply) => {
        setUpdate(() => apply);
      });
    }
  }, []);
  return <App updateAvailable={update} />;
}

// theme-init.js marks the page when it is loaded inside a frame; never render there.
const framed = document.documentElement.hasAttribute('data-framed') || window.top !== window.self;
const mount = document.getElementById('app');

if (!framed && mount) {
  initTheme();
  initStudyPrefs();
  render(<Root />, mount);
}
