import type { ReactElement } from 'react';
import { css } from '@/styled-system/css';
import { CheckIcon, WarningIcon, PlusIcon } from './icons.js';
import type { Ownership } from '@/lib/missing-games.js';

/**
 * One game's ownership state, as a tinted tag.
 *
 * Separate from Chip, which reads "N label" for an aggregate (the scanner's
 * totals). This is the state of a single row, so it carries a word, not a
 * count — but it follows the same rules: tinted fill, no border, a literal
 * 8px radius, and a pictogram so the three states differ by shape as well
 * as by hue and by the lightness of their wash. A red/green pair is never
 * the only signal.
 *
 * `missing` is deliberately the quiet one: on a fresh collection almost
 * every row is missing, and a loud tag repeated 1500 times is noise. It
 * gets the neutral wash and a plus — a gap to fill, not a problem.
 */
const TAGS = {
  owned: {
    label: 'Sur ton disque',
    Icon: CheckIcon,
    style: css.raw({ bg: 'status.success.subtle', color: 'status.success.text' }),
  },
  wrongName: {
    label: 'Mal nommé',
    Icon: WarningIcon,
    style: css.raw({ bg: 'status.warning.subtle', color: 'status.warning.text' }),
  },
  missing: {
    label: 'Manquant',
    Icon: PlusIcon,
    style: css.raw({ bg: 'bg.muted', color: 'fg.subtle' }),
  },
} satisfies Record<Ownership, { label: string; Icon: () => ReactElement; style: object }>;

export function StatusTag({ state }: { state: Ownership }) {
  const { label, Icon, style } = TAGS[state];
  return (
    <span
      className={css(
        {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '1.5',
          flexShrink: 0,
          px: '2.5',
          py: '1',
          borderRadius: '8px',
          fontSize: 'xs',
          fontWeight: 'semibold',
          whiteSpace: 'nowrap',
          border: 'none',
        },
        style,
      )}
    >
      <Icon />
      {label}
    </span>
  );
}
