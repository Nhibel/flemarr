import { css } from '@/styled-system/css';
import { CheckIcon, WarningIcon, PlusIcon } from './icons.js';

/**
 * A tinted status tag: pictogram, count, label.
 *
 * Three roles, and all three differ in more than hue — each has its own
 * tinted wash, its own text color and its own shape — so they stay
 * readable for an eye that confuses hues. `gray` is the neutral "nothing
 * here yet" role (unmatched files, missing games), which is why it carries
 * a plus rather than a warning: it is a gap to fill, not a problem.
 *
 * The radius is a literal 8px rather than `full`: the pill shape was
 * indistinguishable from the interactive filter chips in GameFilters, and
 * a rem radius would also be rescaled by the live font-size control
 * (src/lib/use-font-scale.ts).
 */
export function Chip({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: 'green' | 'amber' | 'gray';
}) {
  const colorStyle = css.raw(
    color === 'green'
      ? {
          bg: 'status.success.subtle',
          borderColor: 'status.success.subtleBorder',
          color: 'status.success.text',
        }
      : color === 'amber'
        ? {
            bg: 'status.warning.subtle',
            borderColor: 'status.warning.subtleBorder',
            color: 'status.warning.text',
          }
        : { bg: 'bg.muted', borderColor: 'bd.default', color: 'fg.muted' },
  );

  const Icon = color === 'green' ? CheckIcon : color === 'amber' ? WarningIcon : PlusIcon;

  return (
    <span
      className={css(
        {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '1.5',
          px: '2.5',
          py: '1',
          borderRadius: '8px',
          fontSize: 'xs',
          fontWeight: 'semibold',
          whiteSpace: 'nowrap',
          border: '1px solid',
        },
        colorStyle,
      )}
    >
      <Icon />
      {/* The count in mono, the label in the body face: the number is the
          data, the word is just its unit. */}
      <span className={css({ fontFamily: 'mono' })}>{count}</span>
      {label}
    </span>
  );
}
