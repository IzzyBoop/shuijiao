import type { ComponentChildren } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon';

/**
 * A small ⓘ button that shows an explanation. Opens on hover, keyboard focus, or
 * tap (for phones); closes on Escape, on leaving, or on a tap elsewhere. The text
 * is linked to the button so screen readers read it out.
 */
export function InfoTip({ label, children }: { label: string; children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  // Keep the bubble on screen: shift it sideways if it would spill over either edge.
  // (Set through the CSSOM, which the Content Security Policy allows.)
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!open || !el) return;
    el.style.translate = '0 0';
    const margin = 12;
    const rect = el.getBoundingClientRect();
    let shift = 0;
    if (rect.left < margin) shift = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) shift = window.innerWidth - margin - rect.right;
    el.style.translate = `${Math.round(shift)}px 0`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span
      class="infotip"
      ref={root}
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <button
        type="button"
        class="icon-only ghost infotip-button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => {
          setOpen(true);
        }}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
        onClick={() => {
          setPinned(!pinned);
          setOpen(!pinned);
        }}
      >
        <Icon name="info" />
      </button>
      {open && (
        <span id={id} role="tooltip" class="infotip-bubble" ref={bubble}>
          {children}
        </span>
      )}
    </span>
  );
}
