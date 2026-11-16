import { useState } from 'preact/hooks';
import type { PortalModule } from '../../core/modules';
import { href } from '../../core/router';
import { store } from '../../core/db/store';
import { listChineseVoices, pickVoice, speak, ttsSupported } from '../../core/lang/tts';
import { updateStudyPrefs, useStudyPrefs, type HanziFont } from '../../core/study-prefs';
import { THEME_FAMILIES, THEME_MODES, type ThemeMode } from '../../core/theme/themes';
import { setThemeState, useThemeState } from '../../app/ThemeToggle';
import { errorMessage, useAsync } from '../../core/ui/useAsync';
import { BackupPanel } from './BackupPanel';
import { requestPersistentStorage } from '../../core/db/persist';

const MODE_LABEL: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };
const FONT_LABEL: Record<HanziFont, string> = {
  sans: 'Sans',
  serif: 'Serif (Song)',
  kai: 'Handwriting (Kai)',
};

function AppearancePanel() {
  const theme = useThemeState();
  const prefs = useStudyPrefs();
  const family = THEME_FAMILIES.find((f) => f.id === theme.familyId);
  return (
    <section class="panel stack">
      <h2>Appearance</h2>
      <div>
        <div class="field-label">Mode</div>
        <div class="segmented" role="group" aria-label="Colour mode">
          {THEME_MODES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={theme.mode === m}
              onClick={() => {
                setThemeState({ ...theme, mode: m });
              }}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      <label class="field">
        <span class="field-label">Theme</span>
        <select
          aria-label="Theme"
          value={theme.familyId}
          onChange={(e) => {
            const f = THEME_FAMILIES.find((x) => x.id === e.currentTarget.value);
            if (f) setThemeState({ ...theme, familyId: f.id, darkId: f.dark[0]?.id ?? '' });
          }}
        >
          {THEME_FAMILIES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      {family && family.dark.length > 1 && (
        <label class="field">
          <span class="field-label">Dark variant</span>
          <select
            aria-label="Dark variant"
            value={theme.darkId}
            onChange={(e) => {
              setThemeState({ ...theme, darkId: e.currentTarget.value });
            }}
          >
            {family.dark.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label class="field">
        <span class="field-label">Character style</span>
        <select
          aria-label="Character style"
          value={prefs.hanziFont}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (v === 'sans' || v === 'serif' || v === 'kai') updateStudyPrefs({ hanziFont: v });
          }}
        >
          {(Object.keys(FONT_LABEL) as HanziFont[]).map((f) => (
            <option key={f} value={f}>
              {FONT_LABEL[f]}
            </option>
          ))}
        </select>
        <span class="small muted">Uses fonts installed on your device.</span>
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={prefs.toneColors}
          onChange={(e) => {
            updateStudyPrefs({ toneColors: e.currentTarget.checked });
          }}
        />
        Colour pinyin by tone
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={prefs.showSimplified}
          onChange={(e) => {
            updateStudyPrefs({ showSimplified: e.currentTarget.checked });
          }}
        />
        Show simplified characters next to traditional in lists
      </label>
    </section>
  );
}

function StudyPanel() {
  const prefs = useStudyPrefs();
  return (
    <section class="panel stack">
      <h2>Study</h2>
      <label class="field">
        <span class="field-label">New cards per day</span>
        <input
          type="number"
          min={0}
          max={500}
          value={prefs.newPerDay}
          onChange={(e) => {
            const n = Math.round(Number(e.currentTarget.value));
            if (Number.isFinite(n) && n >= 0 && n <= 500) updateStudyPrefs({ newPerDay: n });
          }}
        />
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={prefs.autoPlay}
          onChange={(e) => {
            updateStudyPrefs({ autoPlay: e.currentTarget.checked });
          }}
        />
        Play audio automatically when the answer is shown
      </label>
      <p>
        <a href={href('/templates')}>Choose which card types you study →</a>
      </p>
    </section>
  );
}

function VoicePanel() {
  const prefs = useStudyPrefs();
  const voices = useAsync(listChineseVoices, []);
  if (!ttsSupported()) {
    return (
      <section class="panel">
        <h2>Pronunciation</h2>
        <div class="notice warn">This browser doesn't support speech, so the play buttons won't work.</div>
      </section>
    );
  }
  const list = voices.data ?? [];
  const selected = pickVoice(list, prefs.voiceUri);
  const hasMainland = list.some((v) => /^(zh[-_]cn|cmn)/i.test(v.lang));
  return (
    <section class="panel stack">
      <h2>Pronunciation</h2>
      {!voices.loading && list.length === 0 && (
        <div class="notice warn">
          <div>
            <strong>No Chinese voice is installed on this device.</strong>
            <p class="small">
              Add one in your system settings, then reload: on iPhone/iPad and Mac, Settings → Accessibility →
              Spoken Content → Voices → Chinese (China mainland). On Windows, Settings → Time &amp; language →
              Speech → Add voices → Chinese (Simplified, China). On Android, Settings → Text-to-speech →
              install Chinese (Mandarin) voice data.
            </p>
          </div>
        </div>
      )}
      {list.length > 0 && !hasMainland && (
        <div class="notice warn">
          Only non-Mainland Chinese voices were found; some words may be pronounced with Taiwan or Hong Kong
          readings.
        </div>
      )}
      {list.length > 0 && (
        <label class="field">
          <span class="field-label">Voice</span>
          <select
            aria-label="Voice"
            value={selected?.voiceURI ?? ''}
            onChange={(e) => {
              updateStudyPrefs({ voiceUri: e.currentTarget.value.slice(0, 300) });
            }}
          >
            {list.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </label>
      )}
      <label class="field">
        <span class="field-label">Speed: {prefs.speechRate.toFixed(2)}×</span>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.05}
          value={prefs.speechRate}
          onInput={(e) => {
            updateStudyPrefs({ speechRate: Number(e.currentTarget.value) });
          }}
        />
      </label>
      <div>
        <button
          type="button"
          onClick={() =>
            void speak('你好，欢迎学习中文。', { voiceUri: prefs.voiceUri, rate: prefs.speechRate })
          }
        >
          Test voice
        </button>
      </div>
    </section>
  );
}

function StoragePanel() {
  const info = useAsync(async () => {
    const s = navigator.storage as StorageManager | undefined;
    const [persisted, estimate, cards] = await Promise.all([
      s?.persisted ? s.persisted() : Promise.resolve(false),
      s?.estimate ? s.estimate() : Promise.resolve({} as StorageEstimate),
      store.countCards(),
    ]);
    return { persisted, used: estimate.usage ?? 0, cards };
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const askPersist = async () => {
    const granted = await requestPersistentStorage();
    setMessage(
      granted
        ? 'Storage is now protected from automatic clean-up.'
        : 'The browser declined. Installing the portal to your home screen usually allows it.',
    );
    info.reload();
  };

  const erase = async () => {
    try {
      await store.eraseAll();
      setConfirmText('');
      setMessage('All study data on this device was erased.');
      info.reload();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <section class="panel stack">
      <h2>Storage on this device</h2>
      {info.data && (
        <p class="muted">
          {info.data.cards} cards · {(info.data.used / 1e6).toFixed(1)} MB used ·{' '}
          {info.data.persisted
            ? 'protected from automatic clean-up'
            : 'may be cleared by the browser if space runs low'}
        </p>
      )}
      {message && (
        <div class="notice" role="status">
          {message}
        </div>
      )}
      {info.data && !info.data.persisted && (
        <div>
          <button type="button" onClick={() => void askPersist()}>
            Protect my data from clean-up
          </button>
        </div>
      )}
      <details>
        <summary>Erase all study data</summary>
        <div class="stack">
          <p class="small">
            This deletes every card, deck and review on this device. Download a backup first. Type{' '}
            <strong>ERASE</strong> to confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onInput={(e) => {
              setConfirmText(e.currentTarget.value);
            }}
            aria-label="Type ERASE to confirm"
            autocomplete="off"
          />
          <button
            type="button"
            class="danger"
            disabled={confirmText !== 'ERASE'}
            onClick={() => void erase()}
          >
            Erase everything
          </button>
        </div>
      </details>
    </section>
  );
}

function SettingsPage() {
  return (
    <>
      <div class="page-head">
        <h1>Settings</h1>
      </div>
      <div class="grid">
        <div>
          <AppearancePanel />
          <StudyPanel />
        </div>
        <div>
          <VoicePanel />
          <BackupPanel />
          <StoragePanel />
        </div>
      </div>
    </>
  );
}

export const settingsModule: PortalModule = {
  id: 'settings',
  nav: [{ label: 'Settings', path: '/settings', icon: 'settings', order: 50 }],
  routes: [{ path: '/settings', title: 'Settings', component: SettingsPage }],
};
