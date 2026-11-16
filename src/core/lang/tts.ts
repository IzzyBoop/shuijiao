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

/** Mainland Mandarin voices first, then other Chinese voices (e.g. zh-TW), best-sounding first. */
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
  const score = (v: SpeechSynthesisVoice) =>
    (isMandarinVoice(v) ? 0 : 10) + (/premium|enhanced|natural|neural/i.test(v.name) ? 0 : 1);
  return voices.filter(isAnyChineseVoice).sort((a, b) => score(a) - score(b));
}

export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  preferredUri: string,
): SpeechSynthesisVoice | undefined {
  return voices.find((v) => v.voiceURI === preferredUri) ?? voices.find(isMandarinVoice) ?? voices[0];
}

export interface SpeakOptions {
  voiceUri: string;
  rate: number;
}

/** Speaks the text; resolves when finished. Any speech already playing is stopped. */
export async function speak(text: string, opts: SpeakOptions): Promise<void> {
  if (!ttsSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const voice = pickVoice(await listChineseVoices(), opts.voiceUri);
  const u = new SpeechSynthesisUtterance(text.slice(0, 500));
  u.lang = voice?.lang ?? 'zh-CN';
  if (voice) u.voice = voice;
  u.rate = Math.min(Math.max(opts.rate, 0.5), 1.5);
  await new Promise<void>((resolve) => {
    u.onend = () => {
      resolve();
    };
    u.onerror = () => {
      resolve();
    };
    synth.speak(u);
  });
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
