import { css } from '@/styled-system/css';
import { CheckIcon, WarningIcon, PlusIcon } from './icons.js';

/**
 * A status tag: pictogram, count, label.
 *
 * Three roles, and all three differ in more than hue — each has its own
 * fill, its own text color and its own shape — so they stay
 * readable for an eye that confuses hues. `gray` is the neutral "nothing
 * here yet" role (unmatched files, missing games), which is why it carries
 * a plus rather than a warning: it is a gap to fill, not a problem.
 *
 * The radius is a literal 8px rather than `full`: the pill shape was
 * indistinguishable from the interactive filter chips in GameFilters, and
 * a rem radius would also be rescaled by the live font-size control
 * (src/lib/use-font-scale.ts).
 *
 * No border. The comps draw these as a fill and nothing else; the
 * 1px outline this used to have was left over from before the shell
 * dropped borders everywhere else.
 *
 * The fill comes from `chip.*`, not `status.*`: six themes make a tag a
 * tinted wash with the status colour as text, while Cyberpunk makes it a
 * solid fill with dark text. Both shapes live in those tokens, so this
 * component does not branch on the theme. See the `chip` block in
 * panda.config.ts.
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
      ? { bg: 'chip.success.bg', color: 'chip.success.fg' }
      : color === 'amber'
        ? { bg: 'chip.warning.bg', color: 'chip.warning.fg' }
        : { bg: 'bg.muted', color: 'fg.muted' },
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
          border: 'none',
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
