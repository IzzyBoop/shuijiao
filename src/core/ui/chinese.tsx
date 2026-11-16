import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { toneOf } from '../lang/tones';
import { speak, ttsSupported, type SpeakResult } from '../lang/tts';
import { getStudyPrefs } from '../study-prefs';
import { Icon } from './Icon';

export function Trad({ text, class: cls = '' }: { text: string; class?: string }) {
  return (
    <span lang="zh-Hant" class={`hanzi-trad ${cls}`}>
      {text}
    </span>
  );
}

export function Simp({ text, class: cls = '' }: { text: string; class?: string }) {
  return (
    <span lang="zh-Hans" class={`hanzi-simp ${cls}`}>
      {text}
    </span>
  );
}

// One pinyin syllable: optional initial, a vowel group containing the tone mark, optional final.
const SYLLABLE =
  /(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(?:ng|n(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])|r(?![aeiouü]))?/giu;

/** Pinyin with each syllable wrapped for tone colouring. Plain text nodes only. */
export function Pinyin({ text, class: cls = '' }: { text: string; class?: string }) {
  const parts: JSX.Element[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(SYLLABLE)) {
    const start = m.index;
    if (start > last) parts.push(<span key={`t${i}`}>{text.slice(last, start)}</span>);
    parts.push(
      <span key={`s${i}`} class={`tone${toneOf(m[0])}`}>
        {m[0]}
      </span>,
    );
    last = start + m[0].length;
    i++;
  }
  if (last < text.length) parts.push(<span key="end">{text.slice(last)}</span>);
  return <span class={`pinyin ${cls}`}>{parts}</span>;
}

/** Explains a speech problem in plain words, or null if audio played. */
export function speechProblem(result: SpeakResult): string | null {
  if (result === 'silent') {
    return "No sound: this browser can't play Chinese audio on this device. Try Chrome, Edge or Safari.";
  }
  if (result === 'failed') return 'Audio failed. Settings → Pronunciation has an audio check.';
  if (result === 'unsupported') return "Audio isn't supported in this browser.";
  return null;
}

export function AudioButton({ text, label = 'Play pronunciation' }: { text: string; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!ttsSupported()) {
    return <span class="muted small">Audio isn't supported in this browser.</span>;
  }
  const play = async () => {
    setPlaying(true);
    const prefs = getStudyPrefs();
    setProblem(speechProblem(await speak(text, { voiceUri: prefs.voiceUri, rate: prefs.speechRate })));
    setPlaying(false);
  };
  return (
    <span class="audio-button">
      <button type="button" onClick={() => void play()} aria-label={label} disabled={playing || !text}>
        <Icon name="sound" />
        <span>{playing ? 'Playing…' : 'Play'}</span>
      </button>
      {problem && (
        <span class="small warn-text" role="status">
          {problem}
        </span>
      )}
    </span>
  );
}
