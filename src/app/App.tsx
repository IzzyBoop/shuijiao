import { useEffect } from 'preact/hooks';
import { FOOTER_NAV, MAIN_NAV, ROUTES } from '../core/registry';
import { href, matchRoute, usePath } from '../core/router';
import { Icon } from '../core/ui/Icon';
import { ThemeToggle } from './ThemeToggle';
import { VersionEgg } from './VersionEgg';
import { ChromeNotice } from './ChromeNotice';
import { UpdateBanner } from './UpdateBanner';
import { ErrorBoundary } from '../core/ui/ErrorBoundary';

function isActive(navPath: string, current: string): boolean {
  if (navPath === '/')
    return current === '/' || current.startsWith('/review') || current.startsWith('/browse');
  return current === navPath || current.startsWith(navPath + '/');
}

export function App() {
  const path = usePath();
  const match = matchRoute(path, ROUTES);

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
          <a class="brand" href={href('/')} aria-label="水餃 (shuǐjiǎo), home">
            <span class="brand-mark" aria-hidden="true">
              🥟
            </span>
            <span class="brand-name" aria-hidden="true">
              <span lang="zh-Hant" class="hanzi-trad">
                水餃
              </span>{' '}
              (shuǐjiǎo)
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
        <ChromeNotice />
        {match ? (
          // A crash on one page leaves the menu working; going to another page tries again.
          <ErrorBoundary resetKey={path}>
            <match.route.component params={match.params} />
          </ErrorBoundary>
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
          <span>Your cards are stored only in this browser.</span>
          <VersionEgg version={__APP_VERSION__} />
          <span class="row">
            {FOOTER_NAV.map((item) => (
              <a key={item.path} href={href(item.path)}>
                {item.label}
              </a>
            ))}
          </span>
        </div>
      </footer>

      <UpdateBanner />
    </div>
  );
}
