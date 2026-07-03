import { css } from '@/styled-system/css';
import type { ArchiveLayout } from '@/lib/api.js';

export function LayoutBadge({ layout }: { layout: ArchiveLayout }) {
  return (
    <span
      className={css({
        px: '1.5',
        py: '0.5',
        fontSize: 'xs',
        borderRadius: 'sm',
        bg: layout === 'direct' ? 'green.50' : 'blue.50',
        color: layout === 'direct' ? 'green.700' : 'blue.700',
        border: '1px solid',
        borderColor: layout === 'direct' ? 'green.200' : 'blue.200',
      })}
    >
      {layout === 'direct' ? 'direct' : 'zip'}
    </span>
  );
}
