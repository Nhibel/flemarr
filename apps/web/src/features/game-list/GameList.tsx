import { useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { css } from '@/styled-system/css';
import { GameRow } from './GameRow.js';
import type { Game } from '@shared/dat.js';

const ROW_HEIGHT = 44;

interface Props {
  games: Game[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export function GameList({ games, selected, onToggle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const virtualizer = useVirtualizer({
    count: games.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (games.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(focusedIndex + 1, games.length - 1);
        setFocusedIndex(next);
        virtualizer.scrollToIndex(next, { align: 'auto' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(focusedIndex - 1, 0);
        setFocusedIndex(next);
        virtualizer.scrollToIndex(next, { align: 'auto' });
      } else if (e.key === ' ' && focusedIndex >= 0) {
        e.preventDefault();
        const game = games[focusedIndex];
        if (game) onToggle(game.id);
      }
    },
    [games, focusedIndex, onToggle, virtualizer],
  );

  if (games.length === 0) {
    return (
      <div className={css({ py: '12', textAlign: 'center', color: 'fg.faint', fontSize: 'sm' })}>
        No games match the current filters.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Game list"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        if (focusedIndex < 0 && games.length > 0) setFocusedIndex(0);
      }}
      className={css({
        height: '600px',
        overflowY: 'auto',
        border: '1px solid',
        borderColor: 'bd.default',
        borderRadius: 'md',
        outline: 'none',
        _focusVisible: { ring: '2px', ringColor: 'blue.300', ringOffset: '2px' },
      })}
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const game = games[item.index];
          if (!game) return null;
          return (
            <GameRow
              key={game.id}
              game={game}
              isSelected={selected.has(game.id)}
              isFocused={focusedIndex === item.index}
              onToggle={onToggle}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
