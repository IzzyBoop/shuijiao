import { useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { LIMITS, newId, type StudentLink } from '../../core/db/model';
import { cleanText } from '../../core/safe/text';
import { normaliseUserUrl } from '../../core/safe/url';
import { ExternalLink } from '../../core/ui/ExternalLink';
import { Icon } from '../../core/ui/Icon';
import { errorMessage, useAsync } from '../../core/ui/useAsync';

interface Draft {
  title: string;
  url: string;
  note: string;
}

const EMPTY: Draft = { title: '', url: '', note: '' };

/** Links each student saves for themselves. Stored only on their device and included in backups. */
export function MyLinks() {
  const links = useAsync(() => store.listLinks(), []);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<StudentLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof Draft) => (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    setDraft((d) => ({ ...d, [field]: value }));
  };

  const reset = () => {
    setDraft(EMPTY);
    setEditing(null);
    setError(null);
  };

  const save = async () => {
    const parsed = normaliseUserUrl(draft.url);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const now = Date.now();
    const title = cleanText(draft.title, LIMITS.linkTitle) || new URL(parsed.url).hostname;
    try {
      await store.saveLink({
        id: editing?.id ?? newId(),
        title,
        url: parsed.url,
        note: cleanText(draft.note, LIMITS.linkNote),
        createdAt: editing?.createdAt ?? now,
        updatedAt: now,
        deleted: 0,
      });
      reset();
      links.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const edit = (link: StudentLink) => {
    setEditing(link);
    setDraft({ title: link.title, url: link.url, note: link.note });
    setError(null);
  };

  const remove = async (link: StudentLink) => {
    if (!window.confirm(`Remove “${link.title}” from your links?`)) return;
    await store.deleteLink(link.id);
    if (editing?.id === link.id) reset();
    links.reload();
  };

  const list = links.data ?? [];

  return (
    <section class="panel stack" aria-labelledby="my-links-heading">
      <div>
        <h2 id="my-links-heading">My links</h2>
        <p class="muted small">
          Your own useful sites. Only you can see these: they're saved in this browser and included in your
          backups.
        </p>
      </div>

      {list.length === 0 ? (
        <p class="muted small">{links.loading ? 'Loading…' : 'You haven’t added any links yet.'}</p>
      ) : (
        <ul class="list">
          {list.map((link) => (
            <li key={link.id}>
              <div class="grow">
                <ExternalLink url={link.url}>{link.title}</ExternalLink>
                <div class="muted small truncate">{new URL(link.url).hostname}</div>
                {link.note && <div class="small">{link.note}</div>}
              </div>
              <button
                type="button"
                class="icon-only"
                aria-label={`Edit ${link.title}`}
                onClick={() => {
                  edit(link);
                }}
              >
                <Icon name="edit" />
              </button>
              <button
                type="button"
                class="icon-only ghost danger"
                aria-label={`Remove ${link.title}`}
                onClick={() => void remove(link)}
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        class="link-form"
        aria-label={editing ? 'Edit link' : 'Add a link'}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h3>{editing ? 'Edit link' : 'Add a link'}</h3>
        {error && (
          <div class="notice error" role="alert">
            {error}
          </div>
        )}
        <div class="grid">
          <label class="field">
            <span class="field-label">Web address</span>
            <input
              type="text"
              inputMode="url"
              autocomplete="off"
              spellcheck={false}
              placeholder="https://…"
              maxLength={2048}
              value={draft.url}
              onInput={set('url')}
            />
          </label>
          <label class="field">
            <span class="field-label">
              Title <span class="badge">optional</span>
            </span>
            <input
              type="text"
              placeholder="e.g. Grammar videos"
              maxLength={LIMITS.linkTitle}
              value={draft.title}
              onInput={set('title')}
            />
          </label>
        </div>
        <label class="field mt">
          <span class="field-label">
            Note <span class="badge">optional</span>
          </span>
          <input
            type="text"
            placeholder="What it's good for"
            maxLength={LIMITS.linkNote}
            value={draft.note}
            onInput={set('note')}
          />
        </label>
        <div class="row mt">
          <button type="submit" class="primary" disabled={!draft.url.trim()}>
            <Icon name={editing ? 'check' : 'plus'} /> {editing ? 'Save changes' : 'Add link'}
          </button>
          {editing && (
            <button type="button" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
