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
        bg: isDirect ? 'status.success.subtle' : 'status.info.subtle',
        color: isDirect ? 'status.success.text' : 'status.info.text',
        border: '1px solid',
        borderColor: isDirect ? 'status.success.subtleBorder' : 'status.info.subtleBorder',
      })}
    >
      {isDirect ? 'direct' : 'zip'}
    </span>
  );
}
