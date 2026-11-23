import { useMemo, useState } from 'react';
import { css, cx } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { Dialog } from '@/components/Dialog.js';
import { inputClass } from '@/features/settings/styles.js';
import type { Game } from '@shared/dat.js';
import { linkableGames, searchGames, suggestGames } from './suggest-games.js';

interface Props {
  fileName: string;
  games: Game[];
  saving: boolean;
  error: string | null;
  onConfirm: (gameId: string) => void;
  onClose: () => void;
}

/** Picks the game a file is another version of. Nothing is saved unconfirmed. */
export function LinkGameDialog({ fileName, games, saving, error, onConfirm, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);
  const linkable = useMemo(() => linkableGames(games), [games]);
  const suggested = useMemo(() => suggestGames(fileName, linkable), [fileName, linkable]);
  const isSearching = query.trim() !== '';
  const results = isSearching ? searchGames(query, linkable) : suggested;
  const isPickVisible = results.some((game) => game.id === gameId);

  return (
    <Dialog open onClose={onClose} title="Rattacher à un jeu">
      <p className={css({ fontSize: 'sm', color: 'fg.subtle' })}>
        <span className={css({ fontFamily: 'mono', overflowWrap: 'anywhere' })}>{fileName}</span>
        {' : le jeu comptera comme possédé. Le fichier n’est pas renommé.'}
      </p>
      <input
        type="search"
        aria-label="Chercher un jeu du DAT"
        placeholder="Chercher un jeu du DAT"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={cx(inputClass, css({ w: 'full' }))}
      />
      {results.length === 0 && (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          {isSearching
            ? 'Aucun jeu ne correspond.'
            : 'Aucun titre proche : le nom est peut-être traduit, ou le jeu absent de ce DAT.'}
        </p>
      )}
      <div role="radiogroup" aria-label="Jeux" className={css({ overflowY: 'auto' })}>
        {results.map((game) => (
          <label
            key={game.id}
            className={css({
              display: 'flex',
              gap: '3',
              px: '3',
              py: '2',
              fontSize: 'sm',
              color: 'fg.default',
              cursor: 'pointer',
              borderRadius: '10px',
              _hover: { bg: 'bg.muted' },
            })}
          >
            <input
              type="radio"
              name="link-game"
              checked={gameId === game.id}
              onChange={() => setGameId(game.id)}
            />
            {game.name}
          </label>
        ))}
      </div>
      {error !== null && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {error}
        </p>
      )}
      <Button
        disabled={!isPickVisible || saving}
        onClick={() => {
          if (gameId !== null) onConfirm(gameId);
        }}
      >
        Rattacher
      </Button>
    </Dialog>
  );
}
