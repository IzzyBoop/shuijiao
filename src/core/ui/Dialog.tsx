import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';

/**
 * A modal dialog built on the browser's <dialog> element: it traps focus, closes
 * on Escape, and is announced properly by screen readers. Put `autofocus` on the
 * safest button so it is the default.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
  wide = false,
}: {
  open: boolean;
  title: string;
  /** Called however the dialog is dismissed (Escape, or the parent closing it). */
  onClose: () => void;
  children: ComponentChildren;
  /** Buttons along the bottom; omit when the content has its own (e.g. a form). */
  actions?: ComponentChildren;
  /** Room for forms with several fields side by side. */
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} class={`dialog${wide ? ' wide' : ''}`} aria-labelledby={titleId} onClose={onClose}>
      <h2 id={titleId}>{title}</h2>
      <div class="stack">{children}</div>
      {actions !== undefined && <div class="dialog-actions">{actions}</div>}
    </dialog>
  );
}
