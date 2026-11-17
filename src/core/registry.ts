import type { NavItem, PortalModule, RouteDef } from './modules';
import { flashcardsModule } from '../modules/flashcards';
import { courseModule } from '../modules/course';
import { resourcesModule } from '../modules/resources';
import { settingsModule } from '../modules/settings';
import { aboutModule } from '../modules/about';

/**
 * The list of enabled feature modules. The navigation bar and the router are
 * built from this list; add a module here to switch it on.
 */
export const MODULES: readonly PortalModule[] = [
  flashcardsModule,
  courseModule,
  resourcesModule,
  settingsModule,
  aboutModule,
];

export const ROUTES: readonly RouteDef[] = MODULES.flatMap((m) => m.routes);

const byOrder = (a: NavItem, b: NavItem) => a.order - b.order;
const allNav = MODULES.flatMap((m) => m.nav);
export const MAIN_NAV: readonly NavItem[] = allNav
  .filter((n) => (n.placement ?? 'main') === 'main')
  .sort(byOrder);
export const FOOTER_NAV: readonly NavItem[] = allNav.filter((n) => n.placement === 'footer').sort(byOrder);

if (import.meta.env.DEV) {
  const seen = new Set<string>();
  for (const r of ROUTES) {
    if (seen.has(r.path)) throw new Error(`Duplicate route: ${r.path}`);
    seen.add(r.path);
  }
}
