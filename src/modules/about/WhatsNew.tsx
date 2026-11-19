import releases from 'virtual:changelog';

/**
 * Release notes from CHANGELOG.md, newest first, rendered as plain text. Every release
 * is listed; the newest is open, and the older ones are folded up until opened.
 */
export function WhatsNew() {
  if (releases.length === 0) return null;
  return (
    <section class="panel stack" aria-labelledby="whats-new">
      <h2 id="whats-new">What's new</h2>
      <div class="releases">
        {releases.map((release, i) => (
          <details key={release.version} class="release" open={i === 0}>
            <summary>
              <span class="release-version">Version {release.version}</span>
              {release.date && (
                <span class="small muted">
                  <time dateTime={release.date}>{release.date}</time>
                </span>
              )}
              {release.version === __APP_VERSION__ && <span class="badge ok">You're on this version</span>}
            </summary>
            <div class="release-body">
              {release.intro && <p>{release.intro}</p>}
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
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
