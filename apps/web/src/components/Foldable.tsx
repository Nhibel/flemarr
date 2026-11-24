import type { ReactNode } from 'react';
import { css } from '@/styled-system/css';

/** A native `<details>` whose open state its parent holds. */
export function Foldable({
  id,
  summary,
  open,
  onOpenChange,
  children,
}: {
  id: string;
  summary: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
      className={css({ fontSize: 'sm' })}
    >
      <summary className={css({ cursor: 'pointer', color: 'fg.subtle', mb: '1' })}>
        {summary}
      </summary>
      {children}
    </details>
  );
}
