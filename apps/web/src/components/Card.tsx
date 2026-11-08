import type { HTMLAttributes } from 'react';
import { cx } from '@/styled-system/css';
import { card } from '@/styled-system/recipes';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...rest }: CardProps) {
  return <div className={cx(card(), className)} {...rest} />;
}
