import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_ACTIVE_TEMPLATES } from './db/defaults';
import { ID_PATTERN } from './db/model';
import { isBoolean, isNumberIn, isOneOf, isShortString, readPref, writePref } from './safe/prefs';

export type HanziFont = 'sans' | 'serif' | 'kai';

export interface StudyPrefs {
  activeTemplates: string[];
  newPerDay: number;
  voiceUri: string;
  speechRate: number;
  autoPlay: boolean;
  toneColors: boolean;
  hanziFont: HanziFont;
  showSimplified: boolean;
}

const isIdList = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.length >= 1 &&
  v.length <= 50 &&
  v.every((x) => typeof x === 'string' && ID_PATTERN.test(x));

const FONTS = ['sans', 'serif', 'kai'] as const;

function load(): StudyPrefs {
  return {
    activeTemplates: readPref('study.activeTemplates', DEFAULT_ACTIVE_TEMPLATES, isIdList),
    newPerDay: readPref('study.newPerDay', 20, isNumberIn(0, 500)),
    voiceUri: readPref('study.voiceUri', '', isShortString(300)),
    speechRate: readPref('study.speechRate', 0.9, isNumberIn(0.5, 1.5)),
    autoPlay: readPref('study.autoPlay', false, isBoolean),
    toneColors: readPref('study.toneColors', true, isBoolean),
    hanziFont: readPref('study.hanziFont', 'sans', isOneOf(FONTS)),
    showSimplified: readPref('study.showSimplified', true, isBoolean),
  };
}

let current = load();
const listeners = new Set<(p: StudyPrefs) => void>();

function applyDocumentPrefs(p: StudyPrefs): void {
  document.documentElement.dataset.hanziFont = p.hanziFont;
  document.documentElement.dataset.toneColors = p.toneColors ? 'on' : 'off';
}

export function getStudyPrefs(): StudyPrefs {
  return current;
}

export function updateStudyPrefs(patch: Partial<StudyPrefs>): void {
  current = { ...current, ...patch };
  for (const [key, value] of Object.entries(patch)) writePref(`study.${key}`, value);
  applyDocumentPrefs(current);
  for (const l of listeners) l(current);
}

export function initStudyPrefs(): void {
  applyDocumentPrefs(current);
}

export function useStudyPrefs(): StudyPrefs {
  const [prefs, setPrefs] = useState(current);
  useEffect(() => {
    listeners.add(setPrefs);
    return () => {
      listeners.delete(setPrefs);
    };
  }, []);
  return prefs;
}
