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

  // No surface, border or radius of its own any more: this renders inside
  // the action dock in App.tsx, which is the surface. Two nested cards read
  // as a box in a box, and the old bordered chip was also why the empty and
  // non-empty states had different heights.
  if (selected.size === 0) {
    return <p className={css({ fontSize: 'sm', color: 'fg.subtle' })}>Aucun jeu sélectionné.</p>;
  }

  return (
    <p className={css({ display: 'flex', alignItems: 'baseline', gap: '2', fontSize: 'sm' })}>
      <span className={css({ fontWeight: 'bold', color: 'fg.heading' })}>
        {selected.size} jeu{selected.size !== 1 ? 'x' : ''} sélectionné
        {selected.size !== 1 ? 's' : ''}
      </span>
      {/* The total is technical data, hence the mono face — and it is the
          number that decides whether a download is worth starting, so it
          gets its own voice rather than blending into the sentence. */}
      <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'fg.subtle' })}>
        · {formatSize(totalBytes)} au total
      </span>
    </p>
  );
}
