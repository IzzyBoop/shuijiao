import { useEffect, useRef, useState } from 'preact/hooks';
import type { Card } from '../../core/db/model';
import { loadStrokes, strokeChars, StrokesUnavailable } from '../../core/lang/strokes';
import { STROKE_SPEEDS, updateStudyPrefs, useStudyPrefs, type StrokeSpeed } from '../../core/study-prefs';

// The animation library (MIT) loads on first use, so nobody pays for it until they look.
const loadWriter = () => import('hanzi-writer');
type Writer = InstanceType<Awaited<ReturnType<typeof loadWriter>>['default']>;

const SPEED: Record<StrokeSpeed, { label: string; speed: number; delay: number }> = {
  slow: { label: 'Slow', speed: 0.5, delay: 500 },
  normal: { label: 'Normal', speed: 1, delay: 250 },
  fast: { label: 'Fast', speed: 2.2, delay: 100 },
};
const SIZE = 220;

const reducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Colours from the current theme: strokes in the text colour, the radical in the accent
 *  (Ink's orange in 墨 Ink), and strokes still to come as a faint outline. */
function themeColours() {
  const css = getComputedStyle(document.documentElement);
  const value = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const ink = document.documentElement.dataset.style === 'ink';
  return {
    strokeColor: value('--text', '#333'),
    radicalColor: ink ? value('--sun', '#ce5e32') : value('--accent', '#0969da'),
    outlineColor: value('--surface-2', '#ddd'),
  };
}

/** Changes whenever the theme or style changes, so the drawing can be redone in new colours. */
function useThemeKey(): string {
  const read = () =>
    `${document.documentElement.dataset.theme ?? ''}|${document.documentElement.dataset.style ?? ''}`;
  const [key, setKey] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setKey(read());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-style'],
    });
    return () => {
      observer.disconnect();
    };
  }, []);
  return key;
}

/**
 * "筆順 Stroke order" under the answer: how each character of the card is written,
 * animated stroke by stroke (mainland standard). Folded up until opened; the student's
 * choice is remembered. Keys pressed inside it don't reach the study session.
 */
export function StrokeOrder({ card }: { card: Card }) {
  const prefs = useStudyPrefs();
  const [open, setOpen] = useState(prefs.strokesOpen);
  const chars = strokeChars(card.traditional);
  if (!prefs.showStrokes || chars.length === 0) return null;
  return (
    <details
      class="strokes"
      open={open}
      onToggle={(e) => {
        const now = e.currentTarget.open;
        setOpen(now);
        if (now !== prefs.strokesOpen) updateStudyPrefs({ strokesOpen: now });
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
      }}
    >
      <summary>
        <span lang="zh-Hant" class="hanzi-trad">
          筆順
        </span>{' '}
        Stroke order
      </summary>
      {open && <StrokePanel card={card} speed={prefs.strokeSpeed} />}
    </details>
  );
}

function StrokePanel({ card, speed }: { card: Card; speed: StrokeSpeed }) {
  const trad = strokeChars(card.traditional);
  const simp = strokeChars(card.simplified);
  const differs = simp.length > 0 && simp.join('') !== trad.join('');
  const [script, setScript] = useState<'trad' | 'simp'>('trad');
  const chars = script === 'simp' && differs ? simp : trad;
  const [index, setIndex] = useState(0);
  const char = chars[Math.min(index, chars.length - 1)] ?? '';
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [count, setCount] = useState(0);
  /** Strokes shown in step mode; null while animating or showing the whole character. */
  const [step, setStep] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const themeKey = useThemeKey();
  const box = useRef<HTMLDivElement>(null);
  const writer = useRef<Writer | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || !char) return;
    let alive = true;
    setStatus('loading');
    setStep(null);
    void loadWriter().then(({ default: HanziWriter }) => {
      if (!alive) return;
      el.replaceChildren();
      const s = SPEED[speed];
      writer.current = HanziWriter.create(el, char, {
        width: SIZE,
        height: SIZE,
        padding: 8,
        showCharacter: false,
        showOutline: true,
        strokeAnimationSpeed: reducedMotion() ? 8 : s.speed,
        delayBetweenStrokes: reducedMotion() ? 0 : s.delay,
        ...themeColours(),
        charDataLoader: (c, onLoad, onError) => {
          loadStrokes(c).then(
            (data) => {
              if (alive) setCount(data.strokes.length);
              onLoad(data);
            },
            (err: unknown) => {
              onError(err instanceof Error ? err : String(err));
            },
          );
        },
        onLoadCharDataSuccess: () => {
          if (!alive) return;
          setStatus('ready');
          if (reducedMotion()) void writer.current?.showCharacter();
          else void writer.current?.animateCharacter();
        },
        onLoadCharDataError: (err) => {
          if (alive) setStatus(err instanceof StrokesUnavailable ? 'unavailable' : 'error');
        },
      });
    });
    return () => {
      alive = false;
      writer.current = null;
      el.replaceChildren(); // removes the drawing (the library's own teardown uses innerHTML)
    };
  }, [char, speed, themeKey, retry]);

  const replay = () => {
    setStep(null);
    void writer.current?.hideCharacter({ duration: 0 }).then(() => writer.current?.animateCharacter());
  };
  const nextStroke = () => {
    const w = writer.current;
    if (!w || count === 0) return;
    const at = step === null || step >= count ? 0 : step;
    const go = () => {
      setStep(at + 1);
      void w.animateStroke(at);
    };
    if (at === 0) void w.hideCharacter({ duration: 0 }).then(go);
    else go();
  };
  const showAll = () => {
    setStep(null);
    void writer.current?.showCharacter({ duration: 0 });
  };

  const button = (label: string, onClick: () => void) => (
    <button type="button" disabled={status !== 'ready'} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div class="strokes-panel">
      {(chars.length > 1 || differs) && (
        <div class="strokes-picker">
          {chars.length > 1 && (
            <div class="strokes-chars" role="group" aria-label="Character">
              {chars.map((c, i) => (
                <button
                  key={`${script}-${c}`}
                  type="button"
                  class="strokes-char hanzi-trad"
                  lang={script === 'simp' ? 'zh-Hans' : 'zh-Hant'}
                  aria-pressed={c === char}
                  onClick={() => {
                    setIndex(i);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {differs && (
            <div class="segmented" role="group" aria-label="Characters">
              {(['trad', 'simp'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  aria-pressed={script === sc}
                  onClick={() => {
                    setScript(sc);
                    setIndex(0);
                  }}
                >
                  {sc === 'trad' ? '繁 Traditional' : '简 Simplified'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div class="strokes-stage">
        <div
          ref={box}
          class="strokes-canvas"
          role="img"
          aria-label={`How to write ${char}${count ? `, ${count} strokes` : ''}`}
        />
        {status === 'unavailable' && (
          <p class="small muted strokes-message">Stroke order isn't available for {char}.</p>
        )}
        {status === 'error' && (
          <p class="small muted strokes-message">
            Couldn't load the stroke order. Check your connection.{' '}
            <button
              type="button"
              onClick={() => {
                setRetry((n) => n + 1);
              }}
            >
              Try again
            </button>
          </p>
        )}
      </div>

      <p class="small muted strokes-count" aria-live="polite">
        {status === 'ready' && (step === null ? `${count} strokes` : `Stroke ${step} of ${count}`)}
        {status === 'loading' && 'Loading…'}
      </p>

      <div class="row strokes-controls">
        {button('Replay', replay)}
        {button('Next stroke', nextStroke)}
        {button('Show all', showAll)}
      </div>
      <div class="segmented strokes-speed" role="group" aria-label="Speed">
        {STROKE_SPEEDS.map((sp) => (
          <button
            key={sp}
            type="button"
            aria-pressed={speed === sp}
            onClick={() => {
              updateStudyPrefs({ strokeSpeed: sp });
            }}
          >
            {SPEED[sp].label}
          </button>
        ))}
      </div>
    </div>
  );
}
