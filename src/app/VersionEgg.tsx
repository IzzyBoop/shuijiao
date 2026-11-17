import { useEffect, useRef, useState } from 'preact/hooks';

/** Matches the animation length in app.css, plus a little slack. */
const FLIGHT_MS = 3000;
/** Enough dumplings in the air at once. */
const MAX_FLYING = 6;

interface Dumpling {
  id: number;
  direction: 'left' | 'right';
}

/**
 * The version number in the footer. Clicking it sends a big dumpling up from the
 * bottom of the page; it spins around and flies away.
 */
export function VersionEgg({ version }: { version: string }) {
  const [flying, setFlying] = useState<Dumpling[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t);
    },
    [],
  );

  const launch = () => {
    if (flying.length >= MAX_FLYING) return;
    const id = nextId.current++;
    const direction = Math.random() < 0.5 ? 'left' : 'right';
    setFlying((all) => [...all, { id, direction }]);
    timers.current.push(
      window.setTimeout(() => {
        setFlying((all) => all.filter((d) => d.id !== id));
      }, FLIGHT_MS),
    );
  };

  return (
    <>
      <button type="button" class="version" onClick={launch}>
        v{version}
      </button>
      {flying.map((d) => (
        <span key={d.id} class={`dumpling-fly to-${d.direction}`} aria-hidden="true">
          🥟
        </span>
      ))}
    </>
  );
}
