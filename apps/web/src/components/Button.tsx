import type { ButtonHTMLAttributes } from 'react';
import { cx } from '@/styled-system/css';
import { button } from '@/styled-system/recipes';
import type { ButtonVariantProps } from '@/styled-system/recipes';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {}

export function Button({ variant, size, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(button({ variant, size }), className)} {...rest} />;
}
