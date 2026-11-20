import { useEffect, useState } from 'preact/hooks';
import {
  applyTheme,
  loadThemeState,
  watchSystemTheme,
  type ThemeMode,
  type ThemeState,
} from '../core/theme/themes';
import { cleanUpNotoDownload } from '../core/theme/noto-cleanup';
import { Icon, type IconName } from '../core/ui/Icon';

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const ICON: Record<ThemeMode, IconName> = { light: 'sun', dark: 'moon', system: 'monitor' };
const LABEL: Record<ThemeMode, string> = { light: 'Light mode', dark: 'Dark mode', system: 'Match system' };

type Listener = (s: ThemeState) => void;
const listeners = new Set<Listener>();
let state = loadThemeState();

export function getThemeState(): ThemeState {
  return state;
}

export function setThemeState(next: ThemeState): void {
  state = next;
  applyTheme(state);
  for (const l of listeners) l(state);
}

export function useThemeState(): ThemeState {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

export function initTheme(): void {
  applyTheme(state);
  void cleanUpNotoDownload();
  watchSystemTheme(() => state);
}

/** Header button cycling light → dark → system. */
export function ThemeToggle() {
  const s = useThemeState();
  const next = NEXT[s.mode];
  return (
    <button
      type="button"
      class="icon-only ghost"
      onClick={() => {
        setThemeState({ ...s, mode: next });
      }}
      aria-label={`${LABEL[s.mode]}. Switch to ${LABEL[next].toLowerCase()}`}
      title={LABEL[s.mode]}
    >
      <Icon name={ICON[s.mode]} />
    </button>
  );
}
