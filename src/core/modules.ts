import type { ComponentType } from 'preact';
import type { IconName } from './ui/Icon';

export type RouteParams = Readonly<Record<string, string>>;

export interface RouteProps {
  params: RouteParams;
}

export interface RouteDef {
  /** Hash path pattern, e.g. "/cards/:id/edit". Params match [A-Za-z0-9_-]{1,64} only. */
  path: string;
  /** Shown in the browser tab. */
  title: string;
  component: ComponentType<RouteProps>;
}

export interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  /** Lower comes first. */
  order: number;
  /** Where the link appears. Defaults to the main navigation bar. */
  placement?: 'main' | 'footer';
}

/**
 * A feature of the portal. To add a feature: create src/modules/<name>/index.tsx
 * exporting a PortalModule, then add it to src/core/registry.ts.
 */
export interface PortalModule {
  id: string;
  nav: readonly NavItem[];
  routes: readonly RouteDef[];
}
