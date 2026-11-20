import { useRef, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { GameRow } from './GameRow.js';
import { usePagination } from './use-pagination.js';
import { useDisplayMode, DISPLAY_MODES } from './use-display-mode.js';
import { usePageSize, PAGE_SIZES, resolvePageSize } from './use-page-size.js';
import { fetchGameDetails } from '@/lib/api.js';
import { gameBoxartUrl } from '@/lib/asset-urls.js';
import { queryKeys } from '@/lib/query-keys.js';
import { SearchIcon } from '@/components/icons.js';
import type { Game } from '@shared/dat.js';
import type { Ownership } from '@/lib/missing-games.js';
import { plural } from '@/lib/plural.js';

const MODE_LABELS = { compact: 'Compact', normal: 'Normal' } as const;

interface Props {
  datId: string;
  games: Game[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  /**
   * Per-game ownership from the last scan, keyed by game id. Omitted (or a
   * game absent from it) renders no status tag on that row — which is the
   * state in browser mode and before any scan has run.
   */
  ownership?: Map<string, Ownership>;
  /**
   * The library search. It lives on this component's own toolbar rather
   * than in the page header, where its width (and therefore everything
   * after it) moved with the length of the system name. Here it sits
   * directly above the list it filters, on a row that was otherwise half
   * empty, and `total` is the unfiltered count for the placeholder — this
   * component only ever receives the already-filtered games.
   */
  search: string;
  onSearch: (v: string) => void;
  totalGames: number;
}

const pageBtnClass = css({
  px: '3',
  py: '1',
  minH: '32px',
  fontSize: 'sm',
  borderRadius: '11px',
  cursor: 'pointer',
  bg: 'bg.surface',
  border: 'none',
  color: 'fg.default',
  shadow: 'sm',
  _hover: { bg: 'bg.muted' },
  _disabled: { opacity: 0.4, cursor: 'default', shadow: 'none', _hover: { bg: 'bg.surface' } },
});

export function GameList({
  datId,
  games,
  selected,
  onToggle,
  ownership,
  search,
  onSearch,
  totalGames,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [mode, setMode] = useDisplayMode();
  const [pageSize, setPageSize] = usePageSize();
  const { pageItems, page, pageCount, start, total, next, prev } = usePagination(
    games,
    resolvePageSize(pageSize, games.length),
  );

  // Details for the displayed page only. The backend caches per game in
  // SQLite, so a page is cheap after its first visit; staleTime Infinity
  // because the answer never changes within a session. Compact mode shows
  // no details at all, so it doesn't ask for any.
  const pageIds = pageItems.map((g) => g.id);
  const { data: details } = useQuery({
    queryKey: queryKeys.gameDetails(datId, pageIds),
    queryFn: async () => {
      const res = await fetchGameDetails(datId, pageIds);
      return new Map(res.details.map((d) => [d.gameId, d]));
    },
    enabled: pageIds.length > 0 && mode !== 'compact',
    staleTime: Infinity,
    // gcTime >= staleTime: otherwise a page left alone for 5 minutes is
    // purged and refetched despite being "fresh forever".
    gcTime: Infinity,
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

  // The toolbar renders in both the empty and non-empty cases on purpose:
  // it holds the search field, and a search that filters everything out
  // must still leave the user a box to clear.
  const toolbar = (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '2',
        justifyContent: 'space-between',
        mb: '2',
        flexShrink: '0',
      })}
    >
      <label
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          flex: '1',
          minWidth: '0',
          px: '3',
          bg: 'bg.inset',
          borderRadius: '12px',
          color: 'fg.subtle',
          _focusWithin: {
            _nightdrive: { boxShadow: '0 0 0 1px #37EBF3' },
            _contraste: { boxShadow: '0 0 0 1px #37EBF3' },
          },
        })}
      >
        <SearchIcon />
        <span className={css({ srOnly: true })}>Rechercher un jeu</span>
        <input
          type="search"
          placeholder={`Rechercher parmi ${totalGames} ${plural(totalGames, 'jeu', 'jeux')}…`}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className={css({
            flex: '1',
            minWidth: '0',
            py: '2',
            bg: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'fg.default',
            fontSize: 'sm',
          })}
        />
      </label>

      {/* How many games per page. "Tout" renders every filtered game at
          once with no virtualisation — fine on a desktop, heavy on the
          Deck past a thousand rows, which is why 50 stays the default. */}
      <label
        className={css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '1.5',
          flexShrink: '0',
          fontSize: 'xs',
          color: 'fg.subtle',
        })}
      >
        Par page
        <select
          value={String(pageSize)}
          onChange={(e) =>
            setPageSize(
              e.target.value === 'all' ? 'all' : (Number(e.target.value) as 20 | 50 | 100),
            )
          }
          className={css({
            px: '2',
            minH: '28px',
            fontSize: 'xs',
            fontFamily: 'mono',
            cursor: 'pointer',
            borderRadius: '9px',
          })}
        >
          {PAGE_SIZES.map((s) => (
            <option key={String(s)} value={String(s)}>
              {s === 'all' ? 'Tout' : s}
            </option>
          ))}
        </select>
      </label>

      {/* A segmented control, not two separate outlined buttons: the two
          modes are mutually exclusive, and one track with a sliding filled
          thumb says that where two bordered pills did not. */}
      <div
        className={css({
          display: 'inline-flex',
          gap: '0.5',
          flexShrink: '0',
          p: '0.5',
          bg: 'bg.muted',
          borderRadius: '12px',
        })}
      >
        {DISPLAY_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={css({
              px: '2.5',
              py: '1',
              minH: '28px',
              fontSize: 'xs',
              fontWeight: mode === m ? 'bold' : 'medium',
              border: 'none',
              borderRadius: '9px',
              cursor: 'pointer',
              bg: mode === m ? 'accent.solid' : 'transparent',
              color: mode === m ? 'accent.fg' : 'fg.subtle',
              _hover: { color: mode === m ? 'accent.fg' : 'fg.default' },
            })}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );

  if (games.length === 0) {
    return (
      <>
        {toolbar}
        <div className={css({ py: '12', textAlign: 'center', color: 'fg.faint', fontSize: 'sm' })}>
          Aucun jeu ne correspond aux filtres actuels.
        </div>
      </>
    );
  }

  return (
    <>
      {toolbar}

      <div
        role="listbox"
        aria-label="Liste des jeux"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (resolvedFocus < 0 && pageItems.length > 0) setFocusedIndex(0);
        }}
        className={css({
          // Flex child, not a viewport-relative calc — an earlier version
          // subtracted a fixed rem budget from 100vh for "everything else
          // on screen", but that budget was tuned against one specific
          // window (1400×900) and either overflowed (more chrome added
          // above/below) or hit its floor and showed as few as 3 rows on a
          // short screen (Steam Deck's ~800px).
          //
          // flexGrow: 0 (not 1) — this box sizes to its own content (however
          // many rows actually render) and only *shrinks* under pressure; a
          // short filtered list no longer stretches to fill the whole tab on
          // a tall screen just because the space is there. flexShrink: 1 is
          // what actually bounds it to "whatever's left" when content is
          // taller than available space (every sibling in the parent tab
          // panel — App.tsx — is pinned to its natural size, so this is the
          // only thing left to shrink); minHeight overrides a flex item's
          // normal content-based shrink floor so that shrinking — and the
          // overflowY below — can actually kick in instead of forcing the
          // page itself to grow past the viewport.
          //
          // The 180px floor on minHeight is a *different* bound, on top of
          // that: on a short viewport with a lot of filter chrome above
          // (Steam Deck's ~800px, wrapped filter rows), shrinking with no
          // floor at all could squeeze this down to a sliver — unusable,
          // not just cramped. 180px keeps the list itself always usable;
          // the page (already scrollable — see the 100dvh container in
          // App.tsx) scrolls a little further to reach the footer below
          // instead.
          flexGrow: '0',
          flexShrink: '1',
          flexBasis: 'auto',
          minHeight: '180px',
          overflowY: 'auto',
          bg: 'bg.surface',
          // A floating surface: shadow and tone for depth, no 1px outline,
          // and literal-px radii so they don't scale with the live
          // font-size control. The small padding is what lets each row's
          // inset selection highlight (GameRow) stay clear of these
          // rounded corners.
          borderRadius: '18px',
          shadow: 'md',
          p: '1',
          outline: 'none',
          _focusVisible: {
            ring: '2px',
            ringColor: 'accent.subtleBorder',
            ringOffset: '2px',
            _nightdrive: { ringColor: '#37EBF3' },
            _contraste: { ringColor: '#37EBF3' },
          },
        })}
      >
        <div ref={listRef}>
          {pageItems.map((game, i) => (
            <GameRow
              key={game.id}
              game={game}
              isSelected={selected.has(game.id)}
              isFocused={resolvedFocus === i}
              // POINTERDOWN, not click, and this is the whole fix.
              //
              // A row is a plain, non-focusable div, so pressing one moves
              // the browser's focus to the nearest focusable ancestor —
              // this listbox — not to the row. The listbox's onFocus below
              // then falls back to "focus row 0" whenever nothing was
              // focused yet (the first press after mounting, and the first
              // press after Suivant/Précédent, which reset the index to
              // -1), and the effect above scrolls row 0 into view.
              //
              // All of that happens while the button is still down. The
              // list has therefore scrolled to the top before the user
              // releases, so mouseup lands on a different row and the
              // click fires on their common ancestor — the listbox —
              // instead of on a row. The result the user sees: the row is
              // not selected AND the list jumps back to the start.
              //
              // Claiming the index on click was the previous attempt at
              // this and could not work: that click never reaches a row.
              // pointerdown runs before the focus moves, so onFocus finds
              // an index already set and leaves it alone.
              onPointerDown={() => setFocusedIndex(i)}
              onToggle={(id) => {
                // Still set here for the paths that produce no pointerdown
                // at all: a synthetic click, and assistive tech that
                // activates the row directly.
                setFocusedIndex(i);
                onToggle(id);
              }}
              mode={mode}
              boxartSrc={
                details?.get(game.id)?.hasBoxart ? gameBoxartUrl(datId, game.id) : undefined
              }
              ownership={ownership?.get(game.id)}
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
            flexShrink: '0',
          })}
        >
          <button
            type="button"
            className={pageBtnClass}
            disabled={page === 0}
            onClick={() => goToPage('prev')}
          >
            ‹ Précédent
          </button>
          {/* Counts in mono — they are technical data, and the fixed
              advance stops the whole row from shifting as the numbers
              change width between pages. */}
          <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'fg.data' })}>
            {start + 1}–{Math.min(start + pageItems.length, total)} sur {total}
            {' · '}page {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            className={pageBtnClass}
            disabled={page >= pageCount - 1}
            onClick={() => goToPage('next')}
          >
            Suivant ›
          </button>
        </div>
      )}
    </>
  );
}
