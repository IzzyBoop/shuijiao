import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { toneOf } from '../lang/tones';
import { speak, ttsSupported } from '../lang/tts';
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

export function AudioButton({ text, label = 'Play pronunciation' }: { text: string; label?: string }) {
  const [playing, setPlaying] = useState(false);
  if (!ttsSupported()) {
    return <span class="muted small">Audio isn't supported in this browser.</span>;
  }
  const play = async () => {
    setPlaying(true);
    const prefs = getStudyPrefs();
    await speak(text, { voiceUri: prefs.voiceUri, rate: prefs.speechRate });
    setPlaying(false);
  };
  return (
    <button type="button" onClick={() => void play()} aria-label={label} disabled={playing || !text}>
      <Icon name="sound" />
      <span>{playing ? 'Playing…' : 'Play'}</span>
    </button>
  );
}
