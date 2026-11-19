import { css, cx } from '@/styled-system/css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * `tight` for a two-way choice; `roomy` for a tab strip, whose more
   * numerous segments wrap on a narrow screen.
   */
  density?: 'tight' | 'roomy';
  /** Outer spacing only (margin, flex-shrink): properties this control doesn't set itself. */
  className?: string;
}

const containerClass = css({
  display: 'flex',
  alignSelf: 'flex-start',
  p: '0.5',
  bg: 'bg.muted',
  borderRadius: '13px',
});

const DENSITY_CLASS = {
  tight: css({ gap: '0.5' }),
  roomy: css({ gap: '1', flexWrap: 'wrap' }),
} as const;

// Shape shared by every segment. The state classes below must not repeat
// any of these properties: with atomic CSS, two classes setting the same
// property resolve by stylesheet order, not by their order in `cx`.
const segmentClass = css({
  px: '4',
  minH: '34px',
  fontSize: 'sm',
  cursor: 'pointer',
  border: 'none',
  borderRadius: '10px',
  transition: 'background-color 0.15s, color 0.15s',
});

// Exactly one of these two is applied, so they may set the same properties.
const SEGMENT_STATE_CLASS = {
  inactive: css({
    fontWeight: 'medium',
    bg: 'transparent',
    color: 'fg.subtle',
    _hover: { color: 'fg.default' },
  }),
  active: css({
    fontWeight: 'bold',
    bg: 'accent.solid',
    color: 'accent.fg',
    _hover: { color: 'accent.fg' },
  }),
} as const;

/**
 * A row of pill buttons where exactly one is active — the app's tab strip
 * and its two-way choices. One component so the two can't drift apart.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  density = 'tight',
  className,
}: Props<T>) {
  return (
    <div className={cx(containerClass, DENSITY_CLASS[density], className)}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cx(segmentClass, SEGMENT_STATE_CLASS[isActive ? 'active' : 'inactive'])}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
