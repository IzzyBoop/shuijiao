import { useState } from 'preact/hooks';
import type { PortalModule } from '../../core/modules';
import { href } from '../../core/router';
import { store } from '../../core/db/store';
import {
  isFirefoxOnMac,
  isNoveltyVoice,
  listChineseVoices,
  pickVoice,
  speak,
  ttsSupported,
} from '../../core/lang/tts';
import { speechProblem } from '../../core/ui/chinese';
import { updateStudyPrefs, useStudyPrefs, type HanziFont } from '../../core/study-prefs';
import { THEME_FAMILIES, THEME_MODES, type ThemeMode } from '../../core/theme/themes';
import { setThemeState, useThemeState } from '../../app/ThemeToggle';
import { SettingRow } from '../../core/ui/SettingRow';
import { errorMessage, useAsync } from '../../core/ui/useAsync';
import { AudioCheck } from './AudioCheck';
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
    <section class="panel">
      <h2>Appearance</h2>
      <SettingRow id="set-mode" label="Mode">
        <div class="segmented" role="group" aria-label="Colour mode" id="set-mode">
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
      </SettingRow>
      <SettingRow id="set-theme" label="Theme">
        <select
          id="set-theme"
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
      </SettingRow>
      {family && family.dark.length > 1 && (
        <SettingRow id="set-dark" label="Dark variant">
          <select
            id="set-dark"
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
        </SettingRow>
      )}
      <SettingRow id="set-font" label="Character style" hint="Uses fonts installed on your device.">
        <select
          id="set-font"
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
      </SettingRow>
      <SettingRow id="set-tones" label="Colour pinyin by tone" compact>
        <input
          id="set-tones"
          type="checkbox"
          class="switch"
          checked={prefs.toneColors}
          onChange={(e) => {
            updateStudyPrefs({ toneColors: e.currentTarget.checked });
          }}
        />
      </SettingRow>
      <SettingRow
        id="set-simp"
        label="Show simplified in lists"
        hint="Next to the traditional characters."
        compact
      >
        <input
          id="set-simp"
          type="checkbox"
          class="switch"
          checked={prefs.showSimplified}
          onChange={(e) => {
            updateStudyPrefs({ showSimplified: e.currentTarget.checked });
          }}
        />
      </SettingRow>
    </section>
  );
}

function StudyPanel() {
  const prefs = useStudyPrefs();
  return (
    <section class="panel">
      <h2>Study</h2>
      <SettingRow id="set-new" label="New cards per day" compact>
        <input
          id="set-new"
          type="number"
          class="narrow"
          min={0}
          max={500}
          value={prefs.newPerDay}
          onChange={(e) => {
            const n = Math.round(Number(e.currentTarget.value));
            if (Number.isFinite(n) && n >= 0 && n <= 500) updateStudyPrefs({ newPerDay: n });
          }}
        />
      </SettingRow>
      <SettingRow id="set-autoplay" label="Auto-play audio" hint="When the answer is shown." compact>
        <input
          id="set-autoplay"
          type="checkbox"
          class="switch"
          checked={prefs.autoPlay}
          onChange={(e) => {
            updateStudyPrefs({ autoPlay: e.currentTarget.checked });
          }}
        />
      </SettingRow>
      <p class="mt">
        <a href={href('/templates')}>Choose which card types you study →</a>
      </p>
    </section>
  );
}

function VoicePanel() {
  const prefs = useStudyPrefs();
  const voices = useAsync(listChineseVoices, []);
  const [testing, setTesting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
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
  const hasMainland = list.some((v) => /^(zh[-_]cn|cmn)/i.test(v.lang) && !isNoveltyVoice(v));
  const good = list.filter((v) => !isNoveltyVoice(v));
  const novelty = list.filter(isNoveltyVoice);

  const test = async () => {
    setTesting(true);
    setProblem(
      speechProblem(
        await speak('你好，欢迎学习中文。', { voiceUri: prefs.voiceUri, rate: prefs.speechRate }),
      ),
    );
    setTesting(false);
  };

  const option = (v: SpeechSynthesisVoice) => (
    <option key={v.voiceURI} value={v.voiceURI}>
      {v.name} ({v.lang})
    </option>
  );

  return (
    <section class="panel">
      <h2>Pronunciation</h2>
      {isFirefoxOnMac() && (
        <div class="notice warn">
          <div>
            <strong>Firefox on Mac often can't play Chinese audio.</strong>
            <p class="small">
              It uses an older Apple speech system that only sees some voices and is often silent or makes a
              clicking sound. Everything else works in Firefox; for pronunciation, use Chrome, Edge or Safari.
            </p>
          </div>
        </div>
      )}
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
          No standard Mainland voice was found; some words may be pronounced with Taiwan or Hong Kong
          readings. On a Mac or iPhone, add “Tingting” under Accessibility → Spoken Content → Voices.
        </div>
      )}
      {list.length > 0 && (
        <SettingRow
          id="set-voice"
          label="Voice"
          wide
          hint={
            selected && isNoveltyVoice(selected)
              ? 'Novelty voices can click or stop working in browsers.'
              : 'Premium voices sound much better.'
          }
        >
          <select
            id="set-voice"
            aria-label="Voice"
            value={selected?.voiceURI ?? ''}
            onChange={(e) => {
              updateStudyPrefs({ voiceUri: e.currentTarget.value.slice(0, 300) });
            }}
          >
            <optgroup label="Recommended">{good.map(option)}</optgroup>
            {novelty.length > 0 && (
              <optgroup label="Novelty voices (not recommended)">{novelty.map(option)}</optgroup>
            )}
          </select>
        </SettingRow>
      )}
      <SettingRow id="set-rate" label={`Speed: ${prefs.speechRate.toFixed(2)}×`} wide>
        <input
          id="set-rate"
          type="range"
          min={0.5}
          max={1.5}
          step={0.05}
          value={prefs.speechRate}
          onInput={(e) => {
            updateStudyPrefs({ speechRate: Number(e.currentTarget.value) });
          }}
        />
      </SettingRow>
      <div class="mt">
        <button type="button" disabled={testing} onClick={() => void test()}>
          {testing ? 'Playing…' : 'Test voice'}
        </button>
        {problem && (
          <p class="small warn-text mt" role="status">
            {problem}
          </p>
        )}
      </div>
      <AudioCheck />
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
        <div class="stack mt">
          <p class="small">
            This deletes every card, deck and review on this device. Download a backup first. Type{' '}
            <strong>ERASE</strong> to confirm.
          </p>
          <div class="row">
            <input
              type="text"
              class="grow"
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
      <div class="settings-grid">
        <AppearancePanel />
        <VoicePanel />
        <StudyPanel />
        <BackupPanel />
        <StoragePanel />
      </div>
    </>
  );
}

export const settingsModule: PortalModule = {
  id: 'settings',
  nav: [{ label: 'Settings', path: '/settings', icon: 'settings', order: 50 }],
  routes: [{ path: '/settings', title: 'Settings', component: SettingsPage }],
};
