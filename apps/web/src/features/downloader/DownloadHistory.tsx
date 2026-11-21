import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { fetchDownloadHistory } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { plural } from '@/lib/plural.js';
import { summarizeHistory } from './history-summary.js';
import type { GameHistory } from './history-summary.js';

interface Props {
  datId: string;
  /** Game names by id, for the rows; an unknown id shows as is. */
  gameNames: ReadonlyMap<string, string>;
  /** Checks these games in the selection, for a new resolve. */
  onSelectGames: (gameIds: string[]) => void;
}

const BROWSER_DESTINATION = '<browser>';

function destinationLabel(destination: string): string {
  return destination === BROWSER_DESTINATION ? 'navigateur' : destination;
}

/**
 * The DAT's downloads of the last 30 days, one line per game, in two named
 * groups: the failures, then the finished ones — each newest first. Past
 * jobs keep no sources, so a failure is not retried from here: the failed
 * games go back into the selection, for the Sources tab.
 */
export function DownloadHistory({ datId, gameNames, onSelectGames }: Props) {
  const { data: entries = [] } = useQuery({
    queryKey: queryKeys.downloadHistory(datId),
    queryFn: () => fetchDownloadHistory(datId),
  });
  const games = summarizeHistory(entries);
  if (games.length === 0) return null;

  const failed = games.filter((game) => game.status === 'failed');
  const done = games.filter((game) => game.status === 'done');
  const failedIds = failed.map((game) => game.gameId);
  const nameOf = (gameId: string) => gameNames.get(gameId) ?? gameId;

  return (
    <section className={css({ display: 'flex', flexDirection: 'column', gap: '4', mt: '6' })}>
      <h2 className={css({ fontSize: 'base', fontWeight: 'semibold', color: 'fg.heading' })}>
        Historique · 30 derniers jours
      </h2>
      {failed.length > 0 && (
        <HistoryGroup
          title={`En échec (${failed.length})`}
          games={failed}
          nameOf={nameOf}
          action={
            <Button size="sm" variant="secondary" onClick={() => onSelectGames(failedIds)}>
              Resélectionner {failed.length} {plural(failed.length, 'jeu', 'jeux')}
            </Button>
          }
        />
      )}
      {done.length > 0 && (
        <HistoryGroup title={`Terminés (${done.length})`} games={done} nameOf={nameOf} />
      )}
    </section>
  );
}

function HistoryGroup({
  title,
  games,
  nameOf,
  action,
}: {
  title: string;
  games: GameHistory[];
  nameOf: (gameId: string) => string;
  action?: ReactNode;
}) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
      <div className={css({ display: 'flex', alignItems: 'center', gap: '3', flexWrap: 'wrap' })}>
        <h3
          className={css({
            flex: '1',
            fontSize: 'sm',
            fontWeight: 'semibold',
            color: 'fg.default',
          })}
        >
          {title}
        </h3>
        {action}
      </div>
      <ul className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
        {games.map((game) => (
          <HistoryRow key={game.gameId} game={game} name={nameOf(game.gameId)} />
        ))}
      </ul>
    </div>
  );
}

function HistoryRow({ game, name }: { game: GameHistory; name: string }) {
  const isFailed = game.status === 'failed';
  return (
    <li className={css({ display: 'flex', flexDirection: 'column', py: '1.5', fontSize: 'sm' })}>
      <span className={css({ display: 'flex', gap: '2', alignItems: 'baseline' })}>
        <span
          className={css({
            fontWeight: 'semibold',
            color: isFailed ? 'status.danger.text' : 'status.success.text',
          })}
        >
          {isFailed ? 'Échec' : 'Terminé'}
        </span>
        <span className={css({ flex: '1', minW: '0', truncate: true, color: 'fg.default' })}>
          {name}
        </span>
        <span className={css({ fontSize: 'xs', color: 'fg.faint', flexShrink: 0 })}>
          {new Date(game.lastAt).toLocaleDateString()} · {destinationLabel(game.destination)}
        </span>
      </span>
      {isFailed && game.errorMessage !== null && (
        <span className={css({ fontSize: 'xs', color: 'fg.muted' })}>{game.errorMessage}</span>
      )}
    </li>
  );
}
