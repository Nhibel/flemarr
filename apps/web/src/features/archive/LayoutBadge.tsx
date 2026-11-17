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
        bg: isDirect ? 'chip.success.bg' : 'chip.info.bg',
        color: isDirect ? 'chip.success.fg' : 'chip.info.fg',
      })}
    >
      {isDirect ? 'direct' : 'zip'}
    </span>
  );
}
