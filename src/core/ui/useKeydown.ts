import { useEffect, useRef } from 'preact/hooks';

/**
 * Listens for key presses on the whole page for as long as the component is shown.
 * The listener is attached once, when the page opens, and always calls the latest
 * handler, so there is never a moment where the screen has updated but a key press
 * is still handled by stale state (or not handled at all).
 */
export function useKeydown(handler: (e: KeyboardEvent) => void): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      latest.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}
