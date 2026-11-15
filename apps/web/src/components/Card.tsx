import type { HTMLAttributes } from 'react';
import { cx } from '@/styled-system/css';
import { card } from '@/styled-system/recipes';

// A plain alias, not an empty `interface … extends`: the two are
// equivalent, and the empty extends form is what @typescript-eslint's
// no-empty-object-type flags. Kept exported so callers can type their own
// wrappers around Card.
export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...rest }: CardProps) {
  return <div className={cx(card(), className)} {...rest} />;
}
