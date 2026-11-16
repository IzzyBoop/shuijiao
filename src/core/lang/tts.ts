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

function sortChinese(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter(isAnyChineseVoice).sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

/** Chinese voices, best first, without waiting (empty until the browser has loaded its voices). */
function chineseVoicesNow(): SpeechSynthesisVoice[] {
  return ttsSupported() ? sortChinese(window.speechSynthesis.getVoices()) : [];
}

/** Chinese voices, best first. Waits briefly for browsers that load voices asynchronously. */
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
  return sortChinese(voices);
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
  /** Receives a line for each speech event; used by the Audio check in Settings. */
  onEvent?: (message: string) => void;
}

// A strong reference to the utterance being spoken: Chrome can garbage-collect it
// mid-sentence, which silently drops its "end" event and wedges the queue.
let current: SpeechSynthesisUtterance | null = null;

const pause = (ms: number) =>
  new Promise<void>((r) => {
    window.setTimeout(r, ms);
  });

/** If speech hasn't started by then, the voice is treated as broken. */
const START_TIMEOUT_MS = 4000;

/**
 * Mandarin speech runs at roughly 4–5 syllables a second. A browser that reports
 * "end" sooner than ~100 ms per character (at normal speed) cannot have produced
 * audio; Firefox on macOS does this with its legacy speech backend.
 */
const MIN_MS_PER_HANZI = 100;
const HANZI = /\p{Script=Han}/gu;

export function minPlausibleMs(text: string, rate: number): number {
  return ((text.match(HANZI)?.length ?? 0) * MIN_MS_PER_HANZI) / rate;
}

type Outcome = 'ended' | 'silent' | 'failed' | 'interrupted';

/** What happened, for the caller to show the student. */
export type SpeakResult = 'played' | 'silent' | 'failed' | 'unsupported';

function speakOnce(
  text: string,
  voice: SpeechSynthesisVoice | undefined,
  rate: number,
  log: (m: string) => void,
): Promise<Outcome> {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? 'zh-CN';
  if (voice) u.voice = voice;
  u.rate = rate;
  current = u;
  const t0 = performance.now();
  const at = () => `${Math.round(performance.now() - t0)} ms`;
  log(`speak: ${voice ? `${voice.name} (${voice.lang})` : 'browser default zh-CN voice'}, rate ${rate}`);

  return new Promise<Outcome>((resolve) => {
    let started = false;
    const finish = (outcome: Outcome) => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
      u.onstart = u.onend = u.onerror = null;
      if (current === u) current = null;
      resolve(outcome);
    };
    const startTimer = window.setTimeout(() => {
      if (started) return;
      log(`no "start" event after ${at()}`);
      synth.cancel();
      finish('failed');
    }, START_TIMEOUT_MS);
    // Generous upper bound: ~0.5 s per character at the chosen speed, plus start-up time.
    const endTimer = window.setTimeout(
      () => {
        log(`no "end" event after ${at()}; stopping`);
        synth.cancel();
        finish('ended');
      },
      START_TIMEOUT_MS + (text.length * 500) / rate,
    );
    u.onstart = () => {
      started = true;
      log(`start (${at()})`);
    };
    u.onend = () => {
      const elapsed = performance.now() - t0;
      log(`end (${at()})`);
      if (elapsed < minPlausibleMs(text, rate)) {
        log('finished too quickly to have made any sound');
        finish('silent');
      } else {
        finish('ended');
      }
    };
    u.onerror = (e) => {
      log(`error "${e.error}" (${at()})`);
      finish(e.error === 'interrupted' || e.error === 'canceled' ? 'interrupted' : 'failed');
    };
    synth.speak(u);
  });
}

/**
 * Speaks the text; resolves when finished. Speech already playing is stopped.
 * If the chosen voice errors or never starts (some voices only work in some
 * browsers), it retries once with the browser's default Chinese voice.
 * A "silent" result (the browser claims success instantly) is not retried, since
 * the default voice goes through the same broken engine.
 * Safety timeouts mean a misbehaving voice can never leave buttons stuck.
 */
export async function speak(text: string, opts: SpeakOptions): Promise<SpeakResult> {
  if (!ttsSupported()) return 'unsupported';
  if (!text.trim()) return 'played';
  const log = opts.onEvent ?? (() => undefined);
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) {
    synth.cancel();
    // Chrome can drop an utterance queued in the same tick as cancel().
    await pause(60);
  }
  if (synth.paused) synth.resume();

  // Use already-loaded voices when possible so speech starts in the same tick as the
  // click; Firefox can ignore speech that starts long after the user's tap.
  let voices = chineseVoicesNow();
  if (voices.length === 0) voices = await listChineseVoices();
  const voice = pickVoice(voices, opts.voiceUri);
  const rate = Math.min(Math.max(opts.rate, 0.5), 1.5);
  const clipped = text.slice(0, 500);

  let outcome = await speakOnce(clipped, voice, rate, log);
  if (outcome === 'failed' && voice) {
    log('retrying with the browser default voice');
    outcome = await speakOnce(clipped, undefined, rate, log);
  }
  if (outcome === 'silent') return 'silent';
  if (outcome === 'failed') return 'failed';
  return 'played';
}

/** Firefox on macOS speaks through Apple's deprecated NSSpeechSynthesizer and is often silent. */
export function isFirefoxOnMac(): boolean {
  const ua = navigator.userAgent;
  return ua.includes('Firefox/') && ua.includes('Mac OS X');
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return;
  current = null;
  window.speechSynthesis.cancel();
}
