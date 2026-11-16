import * as v from 'valibot';
import type { PortalModule } from '../../core/modules';
import { ExternalLink } from '../../core/ui/ExternalLink';
import raw from '../../content/resources.json';
import { MyLinks } from './MyLinks';
import { ResourcesFileSchema } from './schema';

// Checked at build time by tools/check-resources.ts; checked again here so a bad
// entry can never render as a link.
const parsed = v.safeParse(ResourcesFileSchema, raw);
const categories = parsed.success ? parsed.output.categories : [];

function ResourcesPage() {
  return (
    <>
      <div class="page-head">
        <h1>Resources</h1>
      </div>
      <p class="muted">Course audio and useful sites. Links open in a new tab.</p>
      <h2 class="section-heading">Course resources</h2>
      {categories.map((cat) => (
        <section class="panel" key={cat.name}>
          <h2>{cat.name}</h2>
          {cat.description && <p class="muted">{cat.description}</p>}
          {cat.links.length === 0 ? (
            <p class="muted small">No links here yet.</p>
          ) : (
            <ul class="list">
              {cat.links.map((link) => (
                <li key={`${link.title}|${link.url}`}>
                  <div class="grow">
                    <ExternalLink url={link.url}>{link.title}</ExternalLink>
                    {link.description && <div class="muted small">{link.description}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <MyLinks />
    </>
  );
}

export const resourcesModule: PortalModule = {
  id: 'resources',
  nav: [{ label: 'Resources', path: '/resources', icon: 'link', order: 40 }],
  routes: [{ path: '/resources', title: 'Resources', component: ResourcesPage }],
};
