import { css, cx } from '@/styled-system/css';

// Whole static classes per state: Panda extracts CSS at build time, so
// every value must be visible in the source.
const TRACK_STATE = {
  on: css({ bg: 'accent.solid' }),
  off: css({ bg: 'bg.inset' }),
} as const;

const THUMB_STATE = {
  on: css({ transform: 'translateX(14px)', bg: 'accent.fg' }),
  off: css({ transform: 'translateX(0)', bg: 'fg.faint' }),
} as const;

/**
 * An on/off switch with a visible label. A real button with
 * role="switch", so it is focusable, toggled by Space and Enter, and
 * announced as on or off.
 */
export function Switch({
  checked,
  onChange,
  label,
  ariaLabel,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown beside the switch. */
  label: string;
  /** When several switches share a visible label, what tells them apart. */
  ariaLabel?: string;
  /** Outer spacing only. */
  className?: string;
}) {
  const state = checked ? 'on' : 'off';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cx(
        css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2',
          fontSize: 'xs',
          color: checked ? 'fg.default' : 'fg.subtle',
          cursor: 'pointer',
          bg: 'transparent',
          border: 'none',
          p: '0',
        }),
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          css({
            display: 'inline-flex',
            alignItems: 'center',
            w: '32px',
            h: '18px',
            p: '2px',
            borderRadius: '9px',
            flexShrink: 0,
            transition: 'background-color 0.15s',
          }),
          TRACK_STATE[state],
        )}
      >
        <span
          className={cx(
            css({
              w: '14px',
              h: '14px',
              borderRadius: '7px',
              transition: 'transform 0.15s, background-color 0.15s',
            }),
            THUMB_STATE[state],
          )}
        />
      </span>
      {label}
    </button>
  );
}
