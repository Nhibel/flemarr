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
      <p className={css({ fontSize: 'sm', color: 'fg.faint', py: '2' })}>Aucun jeu sélectionné.</p>
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
        bg: 'accent.subtle',
        border: '1px solid',
        borderColor: 'accent.subtleBorder',
        borderRadius: 'lg',
        fontSize: 'sm',
      })}
    >
      <span className={css({ fontWeight: 'semibold', color: 'accent.text' })}>
        {selected.size} jeu{selected.size !== 1 ? 'x' : ''} sélectionné
        {selected.size !== 1 ? 's' : ''}
      </span>
      <span className={css({ color: 'accent.text' })}>·</span>
      <span className={css({ color: 'accent.text' })}>{formatSize(totalBytes)} au total</span>
    </div>
  );
}
