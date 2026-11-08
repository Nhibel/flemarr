import { css } from '@/styled-system/css';
import type { ArchiveLayout } from '@/lib/api.js';

export function LayoutBadge({ layout }: { layout: ArchiveLayout }) {
  const isDirect = layout === 'direct';
  return (
    <span
      className={css({
        px: '1.5',
        py: '0.5',
        fontSize: 'xs',
        borderRadius: 'md',
        bg: isDirect ? 'green.50' : 'blue.50',
        color: isDirect ? 'green.700' : 'blue.700',
        border: '1px solid',
        borderColor: isDirect ? 'green.200' : 'blue.200',
        _dark: isDirect
          ? { bg: 'green.950', borderColor: 'green.800', color: 'green.300' }
          : { bg: 'blue.950', borderColor: 'blue.800', color: 'blue.300' },
      })}
    >
      {isDirect ? 'direct' : 'zip'}
    </span>
  );
}
