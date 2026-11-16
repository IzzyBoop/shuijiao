import releases from 'virtual:changelog';

/** Release notes from CHANGELOG.md, newest first, rendered as plain text. */
export function WhatsNew({ limit = 5 }: { limit?: number }) {
  if (releases.length === 0) return null;
  return (
    <section class="panel stack" aria-labelledby="whats-new">
      <h2 id="whats-new">What's new</h2>
      {releases.slice(0, limit).map((release) => (
        <article key={release.version} class="release">
          <h3>
            Version {release.version}
            {release.version === __APP_VERSION__ && <span class="badge ok">You're on this version</span>}
          </h3>
          {release.date && (
            <p class="small muted">
              Released <time dateTime={release.date}>{release.date}</time>
            </p>
          )}
          {release.sections.map((section) => (
            <div key={section.title}>
              <h4>{section.title}</h4>
              <ul class="release-items">
                {section.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
