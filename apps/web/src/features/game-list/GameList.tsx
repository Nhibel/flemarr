import { useRef, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { GameRow } from './GameRow.js';
import { usePagination } from './use-pagination.js';
import { useDisplayMode, DISPLAY_MODES } from './use-display-mode.js';
import { fetchGameDetails, gameBoxartUrl } from '@/lib/api.js';
import type { Game } from '@shared/dat.js';

const MODE_LABELS = { compact: 'Compact', normal: 'Normal' } as const;

interface Props {
  datId: string;
  games: Game[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

const pageBtnClass = css({
  px: '3',
  py: '1',
  fontSize: 'sm',
  border: '1px solid',
  borderColor: 'bd.default',
  borderRadius: 'md',
  cursor: 'pointer',
  bg: 'bg.page',
  _hover: { bg: 'bg.surface' },
  _disabled: { opacity: 0.4, cursor: 'default', _hover: { bg: 'bg.page' } },
});

export function GameList({ datId, games, selected, onToggle }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [mode, setMode] = useDisplayMode();
  const { pageItems, page, pageCount, start, total, next, prev } = usePagination(games);

  // Details for the displayed page only. The backend caches per game in
  // SQLite, so a page is cheap after its first visit; staleTime Infinity
  // because the answer never changes within a session. Compact mode shows
  // no details at all, so it doesn't ask for any.
  const pageIds = pageItems.map((g) => g.id);
  const { data: details } = useQuery({
    queryKey: ['game-details', datId, pageIds],
    queryFn: async () => {
      const res = await fetchGameDetails(datId, pageIds);
      return new Map(res.details.map((d) => [d.gameId, d]));
    },
    enabled: pageIds.length > 0 && mode !== 'compact',
    staleTime: Infinity,
  });

  // -2 is "focus the last row once the previous page rendered": its length
  // isn't knowable at the time of the ArrowUp keydown that crossed the page.
  const resolvedFocus = focusedIndex === -2 ? pageItems.length - 1 : focusedIndex;

  // Arrow keys move within the page and cross page boundaries at its edges,
  // so keyboard users can still walk the whole list like before pagination.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (pageItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (resolvedFocus >= pageItems.length - 1) {
          if (page < pageCount - 1) {
            next();
            setFocusedIndex(0);
          }
        } else {
          setFocusedIndex(resolvedFocus + 1);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (resolvedFocus <= 0) {
          if (page > 0) {
            prev();
            setFocusedIndex(-2);
          }
        } else {
          setFocusedIndex(resolvedFocus - 1);
        }
      } else if (e.key === ' ' && resolvedFocus >= 0) {
        e.preventDefault();
        const game = pageItems[resolvedFocus];
        if (game) onToggle(game.id);
      }
    },
    [pageItems, resolvedFocus, page, pageCount, next, prev, onToggle],
  );

  useEffect(() => {
    if (resolvedFocus < 0) return;
    const el = listRef.current?.children[resolvedFocus];
    if (el instanceof HTMLElement) el.scrollIntoView?.({ block: 'nearest' });
  }, [resolvedFocus, page]);

  function goToPage(dir: 'next' | 'prev') {
    (dir === 'next' ? next : prev)();
    setFocusedIndex(-1);
    listRef.current?.parentElement?.scrollTo?.({ top: 0 });
  }

  if (games.length === 0) {
    return (
      <div className={css({ py: '12', textAlign: 'center', color: 'fg.faint', fontSize: 'sm' })}>
        No games match the current filters.
      </div>
    );
  }

  return (
    <>
      <div
        className={css({
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1',
          mb: '2',
        })}
      >
        {DISPLAY_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={css({
              px: '2',
              py: '0.5',
              fontSize: 'xs',
              border: '1px solid',
              borderRadius: 'md',
              cursor: 'pointer',
              bg: mode === m ? 'blue.500' : 'bg.page',
              color: mode === m ? 'white' : 'fg.muted',
              borderColor: mode === m ? 'blue.500' : 'bd.strong',
              _hover: { borderColor: 'blue.400' },
            })}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div
        role="listbox"
        aria-label="Game list"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (resolvedFocus < 0 && pageItems.length > 0) setFocusedIndex(0);
        }}
        className={css({
          maxHeight: '600px',
          overflowY: 'auto',
          border: '1px solid',
          borderColor: 'bd.default',
          borderRadius: 'md',
          outline: 'none',
          _focusVisible: { ring: '2px', ringColor: 'blue.300', ringOffset: '2px' },
        })}
      >
        <div ref={listRef}>
          {pageItems.map((game, i) => (
            <GameRow
              key={game.id}
              game={game}
              isSelected={selected.has(game.id)}
              isFocused={resolvedFocus === i}
              onToggle={onToggle}
              mode={mode}
              boxartSrc={
                details?.get(game.id)?.hasBoxart ? gameBoxartUrl(datId, game.id) : undefined
              }
            />
          ))}
        </div>
      </div>

      {pageCount > 1 && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4',
            mt: '2',
            fontSize: 'sm',
            color: 'fg.muted',
          })}
        >
          <button
            type="button"
            className={pageBtnClass}
            disabled={page === 0}
            onClick={() => goToPage('prev')}
          >
            ‹ Prev
          </button>
          <span>
            {start + 1}–{Math.min(start + pageItems.length, total)} of {total}
            {' · '}page {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            className={pageBtnClass}
            disabled={page >= pageCount - 1}
            onClick={() => goToPage('next')}
          >
            Next ›
          </button>
        </div>
      )}
    </>
  );
}
