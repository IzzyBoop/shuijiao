import { readRawPref, writeRawPref } from '../safe/prefs';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeFamily {
  id: string;
  label: string;
  light: string;
  /** Dark variants; the first is the default. */
  dark: readonly { id: string; label: string }[];
}

export const THEME_FAMILIES: readonly ThemeFamily[] = [
  {
    id: 'catppuccin',
    label: 'Catppuccin',
    light: 'catppuccin-latte',
    dark: [
      { id: 'catppuccin-macchiato', label: 'Macchiato' },
      { id: 'catppuccin-frappe', label: 'Frappé' },
      { id: 'catppuccin-mocha', label: 'Mocha' },
    ],
  },
  {
    id: 'rose-pine',
    label: 'Rosé Pine',
    light: 'rose-pine-dawn',
    dark: [
      { id: 'rose-pine-moon', label: 'Moon' },
      { id: 'rose-pine', label: 'Main' },
    ],
  },
  { id: 'nord', label: 'Nord', light: 'nord-light', dark: [{ id: 'nord', label: 'Nord' }] },
  {
    id: 'gruvbox',
    label: 'Gruvbox',
    light: 'gruvbox-light',
    dark: [{ id: 'gruvbox-dark', label: 'Dark' }],
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    light: 'tokyo-night-day',
    dark: [
      { id: 'tokyo-night', label: 'Night' },
      { id: 'tokyo-night-storm', label: 'Storm' },
    ],
  },
  {
    id: 'kanagawa',
    label: 'Kanagawa',
    light: 'kanagawa-lotus',
    dark: [
      { id: 'kanagawa-wave', label: 'Wave' },
      { id: 'kanagawa-dragon', label: 'Dragon' },
    ],
  },
  {
    id: 'everforest',
    label: 'Everforest',
    light: 'everforest-light',
    dark: [{ id: 'everforest-dark', label: 'Dark' }],
  },
  { id: 'dracula', label: 'Dracula', light: 'alucard', dark: [{ id: 'dracula', label: 'Dracula' }] },
  {
    id: 'solarized',
    label: 'Solarized',
    light: 'solarized-light',
    dark: [{ id: 'solarized-dark', label: 'Dark' }],
  },
  { id: 'default', label: 'Plain', light: 'default-light', dark: [{ id: 'default-dark', label: 'Dark' }] },
];

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

export interface ThemeState {
  familyId: string;
  darkId: string;
  mode: ThemeMode;
}

function familyFor(themeId: string): ThemeFamily | undefined {
  return THEME_FAMILIES.find((f) => f.light === themeId || f.dark.some((d) => d.id === themeId));
}

export function loadThemeState(): ThemeState {
  const rawMode = readRawPref('theme.mode');
  const mode: ThemeMode = rawMode === 'light' || rawMode === 'dark' ? rawMode : 'system';
  const dark = readRawPref('theme.dark') ?? 'catppuccin-macchiato';
  const family = familyFor(dark) ?? THEME_FAMILIES[0];
  const darkId = family?.dark.some((d) => d.id === dark) ? dark : (family?.dark[0]?.id ?? 'default-dark');
  return { familyId: family?.id ?? 'default', darkId, mode };
}

const darkQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveTheme(state: ThemeState): { id: string; isDark: boolean } {
  const family = THEME_FAMILIES.find((f) => f.id === state.familyId) ?? THEME_FAMILIES[0];
  const isDark = state.mode === 'dark' || (state.mode === 'system' && darkQuery()?.matches === true);
  if (!family) return { id: isDark ? 'default-dark' : 'default-light', isDark };
  const darkId = family.dark.some((d) => d.id === state.darkId) ? state.darkId : (family.dark[0]?.id ?? '');
  return { id: isDark ? darkId : family.light, isDark };
}

export function applyTheme(state: ThemeState): void {
  const family = THEME_FAMILIES.find((f) => f.id === state.familyId);
  if (!family) return;
  writeRawPref('theme.mode', state.mode);
  writeRawPref('theme.light', family.light);
  writeRawPref('theme.dark', state.darkId);
  const { id, isDark } = resolveTheme(state);
  const root = document.documentElement;
  root.setAttribute('data-theme', id);
  root.style.colorScheme = isDark ? 'dark' : 'light';
}

/** Re-applies the theme when the OS switches between light and dark. */
export function watchSystemTheme(getState: () => ThemeState): () => void {
  const q = darkQuery();
  if (!q) return () => undefined;
  const onChange = () => {
    if (getState().mode === 'system') applyTheme(getState());
  };
  q.addEventListener('change', onChange);
  return () => {
    q.removeEventListener('change', onChange);
  };
}
