import { useEffect, useState } from 'preact/hooks';
import type { RouteDef, RouteParams } from './modules';

const PARAM_VALUE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_PATH = 256;

/** Reads the current route path from the URL hash ("#/cards/x" → "/cards/x"). */
export function currentPath(): string {
  const raw = window.location.hash.slice(1);
  if (raw.length === 0 || raw.length > MAX_PATH || !raw.startsWith('/')) return '/';
  return raw;
}

export interface RouteMatch {
  route: RouteDef;
  params: RouteParams;
}

/**
 * Matches a path against the registered routes. Only exact segment matches are
 * accepted, and parameters must be short slug-like strings, so nothing from the
 * URL can reach the page except a validated id.
 */
export function matchRoute(path: string, routes: readonly RouteDef[]): RouteMatch | null {
  const segments = path.split('/').filter(Boolean);
  for (const route of routes) {
    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < pattern.length; i++) {
      const p = pattern[i] ?? '';
      const s = segments[i] ?? '';
      if (p.startsWith(':')) {
        if (!PARAM_VALUE.test(s)) {
          ok = false;
          break;
        }
        params[p.slice(1)] = s;
      } else if (p !== s) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params: Object.freeze(params) };
  }
  return null;
}

export function navigate(path: string): void {
  if (!path.startsWith('/')) return;
  window.location.hash = '#' + path;
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
    };
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  return path;
}

export function href(path: string): string {
  return '#' + path;
}
