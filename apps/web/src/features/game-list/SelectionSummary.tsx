import { css } from '@/styled-system/css';
import type { Game } from '@shared/dat.js';
import { formatSize } from '@/lib/format.js';

interface Props {
  games: Game[];
  selected: Set<string>;
  /**
   * Where the files will land. Stated here because it is the thing most
   * worth knowing before pressing download, and in the comps' dock it sits
   * right next to the size — "3,4 Go vers mon navigateur" is a different
   * decision than the same size onto a NAS.
   */
  target?: 'server' | 'browser';
}

export function SelectionSummary({ games, selected, target }: Props) {
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
    return (
      <p className={css({ fontSize: 'sm', color: 'fg.onInverseMuted' })}>Aucun jeu sélectionné.</p>
    );
  }

  return (
    <p className={css({ display: 'flex', alignItems: 'baseline', gap: '2', fontSize: 'sm' })}>
      <span className={css({ fontWeight: 'bold', color: 'fg.onInverse' })}>
        {selected.size} jeu{selected.size !== 1 ? 'x' : ''} sélectionné
        {selected.size !== 1 ? 's' : ''}
      </span>
      {/* The total is technical data, hence the mono face — and it is the
          number that decides whether a download is worth starting, so it
          gets its own voice rather than blending into the sentence. */}
      <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'fg.onInverseMuted' })}>
        · {formatSize(totalBytes)} au total
        {target === 'browser' ? ' · vers mon navigateur' : ''}
      </span>
    </p>
  );
}
