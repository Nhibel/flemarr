import { css } from '@/styled-system/css';

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
      ? {
          bg: 'status.success.subtle',
          borderColor: 'status.success.subtleBorder',
          color: 'status.success.text',
        }
      : color === 'amber'
        ? {
            bg: 'status.warning.subtle',
            borderColor: 'status.warning.subtleBorder',
            color: 'status.warning.text',
          }
        : { bg: 'bg.surface', borderColor: 'bd.default', color: 'fg.muted' },
  );

  return (
    <span
      className={css(
        {
          px: '3',
          py: '1',
          borderRadius: 'full',
          fontSize: 'xs',
          fontWeight: 'medium',
          border: '1px solid',
        },
        colorStyle,
      )}
    >
      {count} {label}
    </span>
  );
}
