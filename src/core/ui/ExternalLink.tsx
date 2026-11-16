import type { ComponentChildren } from 'preact';
import { safeHttpsUrl } from '../safe/url';
import { Icon } from './Icon';

/**
 * The only component allowed to open links in a new tab. The URL is re-checked
 * at render time; anything that isn't a plain https URL renders as inert text.
 */
export function ExternalLink({ url, children }: { url: string; children: ComponentChildren }) {
  const safe = safeHttpsUrl(url);
  if (!safe) return <span class="link-blocked">{children}</span>;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">
      {children}
      <Icon name="external" label="(opens in a new tab)" />
    </a>
  );
}
