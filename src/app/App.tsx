import { useEffect, useState } from 'preact/hooks';
import { FOOTER_NAV, MAIN_NAV, ROUTES } from '../core/registry';
import { href, matchRoute, usePath } from '../core/router';
import { Icon } from '../core/ui/Icon';
import { ThemeToggle } from './ThemeToggle';

function isActive(navPath: string, current: string): boolean {
  if (navPath === '/')
    return current === '/' || current.startsWith('/review') || current.startsWith('/browse');
  return current === navPath || current.startsWith(navPath + '/');
}

export function App({ updateAvailable }: { updateAvailable: (() => void) | null }) {
  const path = usePath();
  const match = matchRoute(path, ROUTES);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    document.title = match ? `${match.route.title} · 水餃 Shuǐjiǎo` : 'Not found · 水餃 Shuǐjiǎo';
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <div class="app">
      <a
        class="sr-only"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <header class="topbar">
        <div class="topbar-inner">
          <a class="brand" href={href('/')}>
            <span class="brand-mark" lang="zh-Hant" aria-hidden="true">
              餃
            </span>
            <span class="brand-name">
              <span lang="zh-Hant">水餃</span> <span class="brand-sub">Shuǐjiǎo</span>
            </span>
          </a>
          <nav class="nav" aria-label="Main">
            {MAIN_NAV.map((item) => (
              <a
                key={item.path}
                href={href(item.path)}
                aria-label={item.label}
                aria-current={isActive(item.path, path) ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                <span class="nav-label" aria-hidden="true">
                  {item.label}
                </span>
              </a>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {match ? (
          <match.route.component params={match.params} />
        ) : (
          <div class="panel">
            <h1>Page not found</h1>
            <p>
              <a href={href('/')}>Back to studying</a>
            </p>
          </div>
        )}
      </main>

      <footer class="footer">
        <div class="footer-inner">
          <span>Your cards are stored only on this device.</span>
          <span class="row">
            {FOOTER_NAV.map((item) => (
              <a key={item.path} href={href(item.path)}>
                {item.label}
              </a>
            ))}
          </span>
        </div>
      </footer>

      {updateAvailable && !dismissed && (
        <div class="update-banner" role="status">
          <span>A new version of the portal is ready.</span>
          <span class="row">
            <button
              type="button"
              class="ghost"
              onClick={() => {
                setDismissed(true);
              }}
            >
              Later
            </button>
            <button type="button" class="primary" onClick={updateAvailable}>
              Reload
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
