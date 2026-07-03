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
      ? { bg: 'green.50', borderColor: 'green.200', color: 'green.700' }
      : color === 'amber'
        ? { bg: 'amber.50', borderColor: 'amber.200', color: 'amber.700' }
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
