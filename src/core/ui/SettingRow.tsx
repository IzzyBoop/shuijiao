import type { ComponentChildren } from 'preact';

/**
 * One setting: label (and optional hint) on the left, control on the right.
 * Wraps onto two lines on narrow screens. `id` must match the control's id.
 */
export function SettingRow({
  id,
  label,
  hint,
  wide = false,
  compact = false,
  children,
}: {
  id: string;
  label: string;
  hint?: ComponentChildren;
  /** Give the control more room (sliders, long selects). */
  wide?: boolean;
  /** Small control (switch, short number) that always stays beside its label. */
  compact?: boolean;
  children: ComponentChildren;
}) {
  return (
    <div class="setting-row">
      <div class="setting-text">
        <label class="setting-label" for={id}>
          {label}
        </label>
        {hint !== undefined && <div class="small muted">{hint}</div>}
      </div>
      <div class={`setting-control${wide ? ' wide' : ''}${compact ? ' compact' : ''}`}>{children}</div>
    </div>
  );
}
