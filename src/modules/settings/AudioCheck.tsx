import { useState } from 'preact/hooks';
import { isNoveltyVoice, listChineseVoices, pickVoice, speak } from '../../core/lang/tts';
import { getStudyPrefs } from '../../core/study-prefs';

function browserName(): string {
  const ua = navigator.userAgent;
  const m =
    /Firefox\/(\d+)/.exec(ua) ??
    /Edg\/(\d+)/.exec(ua) ??
    /Chrome\/(\d+)/.exec(ua) ??
    /Version\/(\d+).*Safari/.exec(ua);
  const name = ua.includes('Firefox/')
    ? 'Firefox'
    : ua.includes('Edg/')
      ? 'Edge'
      : ua.includes('Chrome/')
        ? 'Chrome'
        : ua.includes('Safari/')
          ? 'Safari'
          : 'Unknown browser';
  return m?.[1] ? `${name} ${m[1]}` : name;
}

/**
 * Plays a test phrase and lists what the browser reports: its Chinese voices, the
 * voice used, and every speech event. Everything stays on the device; the report
 * can be copied to share when asking for help.
 */
export function AudioCheck() {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setRunning(true);
    setCopied(false);
    const out: string[] = [];
    const add = (line: string) => {
      out.push(line);
      setLines([...out]);
    };
    const prefs = getStudyPrefs();
    const voices = await listChineseVoices();
    add(`Browser: ${browserName()}`);
    add(`All voices reported: ${window.speechSynthesis.getVoices().length}`);
    add(`Chinese voices: ${voices.length}`);
    for (const v of voices.slice(0, 12)) {
      add(
        `  • ${v.name} (${v.lang})${v.localService ? '' : ' [online]'}${isNoveltyVoice(v) ? ' [novelty]' : ''}`,
      );
    }
    if (voices.length > 12) add(`  … and ${voices.length - 12} more`);
    const chosen = pickVoice(voices, prefs.voiceUri);
    add(`Chosen voice: ${chosen ? chosen.name : 'none (browser default)'}`);
    const result = await speak('你好，欢迎学习中文。', {
      voiceUri: prefs.voiceUri,
      rate: prefs.speechRate,
      onEvent: add,
    });
    add(
      result === 'played'
        ? 'Result: played normally.'
        : result === 'silent'
          ? 'Result: the browser reported success but produced no sound (a browser/OS speech bug).'
          : 'Result: speech failed.',
    );
    setRunning(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <details class="mt">
      <summary>Audio not working? Run an audio check</summary>
      <div class="stack mt">
        <p class="small muted">
          Plays a short phrase and shows what your browser reports. If the chosen voice fails, the portal
          automatically retries with your browser's default Chinese voice.
        </p>
        <div class="row">
          <button type="button" disabled={running} onClick={() => void run()}>
            {running ? 'Checking…' : 'Run audio check'}
          </button>
          {lines.length > 0 && !running && (
            <button type="button" class="ghost" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy report'}
            </button>
          )}
        </div>
        {lines.length > 0 && (
          <ol class="log" aria-live="polite">
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
