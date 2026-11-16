import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNoveltyVoice, listChineseVoices, pickVoice } from '../../src/core/lang/tts';

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
