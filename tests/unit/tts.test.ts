import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNoveltyVoice, listChineseVoices, minPlausibleMs, pickVoice } from '../../src/core/lang/tts';

const voice = (name: string, lang: string, localService = true) =>
  ({ name, lang, localService, voiceURI: name, default: false }) as SpeechSynthesisVoice;

// The Chinese voices Chrome reports on a stock macOS install, in its own order.
const MAC_VOICES = [
  voice('Eddy (Chinese (China mainland))', 'zh-CN'),
  voice('Eddy (Chinese (Taiwan))', 'zh-TW'),
  voice('Flo (Chinese (China mainland))', 'zh-CN'),
  voice('Grandma (Chinese (China mainland))', 'zh-CN'),
  voice('Meijia', 'zh-TW'),
  voice('Rocko (Chinese (China mainland))', 'zh-CN'),
  voice('Tingting', 'zh-CN'),
  voice('Samantha', 'en-US'),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubVoices(voices: SpeechSynthesisVoice[]) {
  vi.stubGlobal('window', {
    speechSynthesis: { getVoices: () => voices },
    // Only its presence is checked (ttsSupported); it is never constructed here.
    SpeechSynthesisUtterance: vi.fn(),
  });
}

describe('voice selection', () => {
  it('flags Apple novelty voices', () => {
    expect(isNoveltyVoice(voice('Eddy (Chinese (China mainland))', 'zh-CN'))).toBe(true);
    expect(isNoveltyVoice(voice('Tingting', 'zh-CN'))).toBe(false);
  });

  it('defaults to Tingting rather than a novelty voice', async () => {
    stubVoices(MAC_VOICES);
    const list = await listChineseVoices();
    expect(list.map((v) => v.name)).not.toContain('Samantha');
    expect(pickVoice(list, '')?.name).toBe('Tingting');
    expect(list.findIndex((v) => v.name === 'Meijia')).toBeLessThan(
      list.findIndex((v) => v.name.startsWith('Eddy')),
    );
  });

  it('prefers premium Mainland voices, and honours an explicit choice', async () => {
    stubVoices([...MAC_VOICES, voice('Lilian (Premium)', 'zh-CN')]);
    const list = await listChineseVoices();
    expect(pickVoice(list, '')?.name).toBe('Lilian (Premium)');
    expect(pickVoice(list, 'Flo (Chinese (China mainland))')?.name).toBe('Flo (Chinese (China mainland))');
  });
});

describe('speak fallback', () => {
  interface FakeUtterance {
    text: string;
    lang: string;
    rate: number;
    voice: SpeechSynthesisVoice | null;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
  }

  /** A fake speech engine; `behave` decides what each utterance does. */
  function stubEngine(voices: SpeechSynthesisVoice[], behave: (u: FakeUtterance) => void) {
    const spoken: FakeUtterance[] = [];
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      speechSynthesis: {
        getVoices: () => voices,
        speaking: false,
        pending: false,
        paused: false,
        cancel: vi.fn(),
        resume: vi.fn(),
        speak: (u: FakeUtterance) => {
          spoken.push(u);
          behave(u);
        },
      },
      SpeechSynthesisUtterance: class {
        text: string;
        lang = '';
        rate = 1;
        voice: SpeechSynthesisVoice | null = null;
        onstart = null;
        onend = null;
        onerror = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance,
    );
    return spoken;
  }

  /** Behaves like real speech: starts at once, ends after 400 ms. */
  const speakNormally = (u: FakeUtterance) => {
    queueMicrotask(() => u.onstart?.());
    setTimeout(() => u.onend?.(), 400);
  };

  it('retries with the browser default voice when the chosen voice errors', async () => {
    const { speak } = await import('../../src/core/lang/tts');
    const spoken = stubEngine(MAC_VOICES, (u) => {
      if (u.voice) queueMicrotask(() => u.onerror?.({ error: 'synthesis-failed' }));
      else speakNormally(u);
    });
    const log: string[] = [];
    const result = await speak('你好', { voiceUri: '', rate: 1, onEvent: (m) => log.push(m) });
    expect(result).toBe('played');
    expect(spoken.map((u) => u.voice?.name ?? 'default')).toEqual(['Tingting', 'default']);
    expect(spoken[1]?.lang).toBe('zh-CN');
    expect(log.join('\n')).toMatch(/retrying with the browser default voice/);
  });

  it('retries when the chosen voice never starts', async () => {
    vi.useFakeTimers();
    try {
      const { speak } = await import('../../src/core/lang/tts');
      const spoken = stubEngine(MAC_VOICES, (u) => {
        if (!u.voice) speakNormally(u);
      });
      const done = speak('你好', { voiceUri: '', rate: 1 });
      await vi.advanceTimersByTimeAsync(5000);
      expect(await done).toBe('played');
      expect(spoken).toHaveLength(2);
      expect(spoken[1]?.voice).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry when speech is fine', async () => {
    const { speak } = await import('../../src/core/lang/tts');
    const spoken = stubEngine(MAC_VOICES, speakNormally);
    expect(await speak('你好', { voiceUri: '', rate: 1 })).toBe('played');
    expect(spoken).toHaveLength(1);
  });

  it('reports "silent" (and does not retry) when the browser claims to finish instantly', async () => {
    const { speak } = await import('../../src/core/lang/tts');
    // What Firefox on macOS does: start and end immediately, no audio.
    const spoken = stubEngine(MAC_VOICES, (u) => {
      queueMicrotask(() => {
        u.onstart?.();
        u.onend?.();
      });
    });
    expect(await speak('你好，欢迎学习中文。', { voiceUri: '', rate: 1.5 })).toBe('silent');
    expect(spoken).toHaveLength(1);
  });

  it('sets a plausible minimum duration from the number of characters', () => {
    expect(minPlausibleMs('你好，欢迎学习中文。', 1)).toBe(800);
    expect(minPlausibleMs('你好', 2)).toBe(100);
    expect(minPlausibleMs('hello', 1)).toBe(0);
  });
});
