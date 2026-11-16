/**
 * Pronunciation through the browser's built-in speech engine (Web Speech API).
 * No network requests and no API key; quality depends on the voices installed
 * on the student's device.
 */

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

const normLang = (lang: string) => lang.replace('_', '-').toLowerCase();

function isMandarinVoice(v: SpeechSynthesisVoice): boolean {
  const lang = normLang(v.lang);
  return lang.startsWith('zh-cn') || lang.startsWith('cmn') || lang === 'zh-hans' || lang.startsWith('zh-sg');
}

function isAnyChineseVoice(v: SpeechSynthesisVoice): boolean {
  const lang = normLang(v.lang);
  return lang.startsWith('zh') || lang.startsWith('cmn');
}

/**
 * Apple's novelty voices (shipped for every language). In browsers they can end with
 * a loud click and leave the speech engine stuck, so they are never picked by default.
 */
const NOVELTY_VOICE = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/;

export function isNoveltyVoice(v: SpeechSynthesisVoice): boolean {
  return NOVELTY_VOICE.test(v.name);
}

/** Lower is better: Mainland first, real voices before novelty ones, premium/neural first. */
function score(v: SpeechSynthesisVoice): number {
  return (
    (isNoveltyVoice(v) ? 100 : 0) +
    (isMandarinVoice(v) ? 0 : 10) +
    (/premium|enhanced|natural|neural/i.test(v.name) ? 0 : 2) +
    (v.localService ? 0 : 1)
  );
}

/** Chinese voices, best first. */
export async function listChineseVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return [];
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length === 0) {
    voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const timer = window.setTimeout(() => {
        resolve(synth.getVoices());
      }, 1500);
      synth.addEventListener(
        'voiceschanged',
        () => {
          window.clearTimeout(timer);
          resolve(synth.getVoices());
        },
        { once: true },
      );
    });
  }
  return voices.filter(isAnyChineseVoice).sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  preferredUri: string,
): SpeechSynthesisVoice | undefined {
  return voices.find((v) => v.voiceURI === preferredUri) ?? voices[0];
}

export interface SpeakOptions {
  voiceUri: string;
  rate: number;
}

// A strong reference to the utterance being spoken: Chrome can garbage-collect it
// mid-sentence, which silently drops its "end" event and wedges the queue.
let current: SpeechSynthesisUtterance | null = null;

const pause = (ms: number) =>
  new Promise<void>((r) => {
    window.setTimeout(r, ms);
  });

/**
 * Speaks the text; resolves when finished (or after a safety timeout, so a voice
 * that never reports "end" can't leave buttons stuck). Speech already playing is stopped.
 */
export async function speak(text: string, opts: SpeakOptions): Promise<void> {
  if (!ttsSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) {
    synth.cancel();
    // Chrome can drop an utterance queued in the same tick as cancel().
    await pause(60);
  }
  if (synth.paused) synth.resume();

  const voice = pickVoice(await listChineseVoices(), opts.voiceUri);
  const rate = Math.min(Math.max(opts.rate, 0.5), 1.5);
  const u = new SpeechSynthesisUtterance(text.slice(0, 500));
  u.lang = voice?.lang ?? 'zh-CN';
  if (voice) u.voice = voice;
  u.rate = rate;
  current = u;

  await new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      if (current === u) current = null;
      resolve();
    };
    // Generous upper bound: ~0.5 s per character at the chosen speed, plus start-up time.
    const timer = window.setTimeout(
      () => {
        if (current === u) synth.cancel();
        finish();
      },
      3000 + (u.text.length * 500) / rate,
    );
    u.onend = finish;
    u.onerror = finish;
    synth.speak(u);
  });
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return;
  current = null;
  window.speechSynthesis.cancel();
}
