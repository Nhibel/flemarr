import { css } from '@/styled-system/css';
import type { Game } from '@shared/dat.js';

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

interface Props {
  games: Game[];
  selected: Set<string>;
}

export function SelectionSummary({ games, selected }: Props) {
  const selectedGames = games.filter((g) => selected.has(g.id));
  const totalBytes = selectedGames.reduce(
    (sum, g) => sum + g.roms.reduce((s, r) => s + r.size, 0),
    0,
  );

  if (selected.size === 0) {
    return (
      <p className={css({ fontSize: 'sm', color: 'fg.faint', py: '2' })}>No games selected.</p>
    );
  }

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '4',
        px: '4',
        py: '2',
        bg: 'blue.50',
        border: '1px solid',
        borderColor: 'blue.200',
        borderRadius: 'md',
        fontSize: 'sm',
        _dark: { bg: 'blue.900', borderColor: 'blue.800' },
      })}
    >
      <span
        className={css({ fontWeight: 'semibold', color: 'blue.700', _dark: { color: 'blue.300' } })}
      >
        {selected.size} game{selected.size !== 1 ? 's' : ''} selected
      </span>
      <span className={css({ color: 'blue.500', _dark: { color: 'blue.400' } })}>·</span>
      <span className={css({ color: 'blue.600', _dark: { color: 'blue.400' } })}>
        {formatSize(totalBytes)} total
      </span>
    </div>
  );
}
