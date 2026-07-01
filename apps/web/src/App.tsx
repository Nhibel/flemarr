import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { DatUpload } from '@/features/dat-loader/DatUpload.js';
import { GameFilters } from '@/features/game-list/GameFilters.js';
import { GameList } from '@/features/game-list/GameList.js';
import { SelectionSummary } from '@/features/game-list/SelectionSummary.js';
import { useGameFilters } from '@/features/game-list/use-game-filters.js';
import { useSelection } from '@/features/game-list/use-selection.js';
import { fetchGames } from '@/lib/api.js';
import type { DatUploadResponse } from '@shared/api.js';

export function App() {
  const [activeDat, setActiveDat] = useState<DatUploadResponse | null>(null);

  if (activeDat === null) {
    return (
      <main className={css({ maxW: '2xl', mx: 'auto', mt: '16', px: '6' })}>
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: '8', color: 'gray.800' })}>
          rom-curator
        </h1>
        <DatUpload onSuccess={setActiveDat} />
      </main>
    );
  }

  return <GameView dat={activeDat} onReset={() => setActiveDat(null)} />;
}

interface GameViewProps {
  dat: DatUploadResponse;
  onReset: () => void;
}

function GameView({ dat, onReset }: GameViewProps) {
  const {
    data: games = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['games', dat.id],
    queryFn: () => fetchGames(dat.id),
  });

  const {
    filtered,
    filterState,
    setSearch,
    toggleRegion,
    toggleCategory,
    setSortBy,
    toggleSortDir,
  } = useGameFilters(games);

  const { selected, toggle, selectAll, clearAll, isAllSelected } = useSelection(dat.id, filtered);

  return (
    <main className={css({ maxW: '5xl', mx: 'auto', mt: '8', px: '6', pb: '12' })}>
      {/* Header */}
      <div className={css({ display: 'flex', alignItems: 'baseline', gap: '4', mb: '6' })}>
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'gray.800', flex: 1 })}>
          {dat.system}
        </h1>
        <span className={css({ fontSize: 'sm', color: 'gray.400' })}>
          {dat.source} · {dat.gameCount} games
        </span>
        <button
          onClick={onReset}
          className={css({
            fontSize: 'sm',
            color: 'blue.600',
            cursor: 'pointer',
            _hover: { textDecoration: 'underline' },
          })}
        >
          Load different DAT
        </button>
      </div>

      {isLoading && <p className={css({ color: 'gray.400', fontSize: 'sm' })}>Loading games…</p>}

      {error instanceof Error && (
        <p role="alert" className={css({ color: 'red.600', fontSize: 'sm' })}>
          {error.message}
        </p>
      )}

      {!isLoading && !error && (
        <>
          <GameFilters
            filterState={filterState}
            totalCount={games.length}
            filteredCount={filtered.length}
            onSearch={setSearch}
            onToggleRegion={toggleRegion}
            onToggleCategory={toggleCategory}
            onSetSortBy={setSortBy}
            onToggleSortDir={toggleSortDir}
            onSelectAll={selectAll}
            onClearAll={clearAll}
            isAllSelected={isAllSelected}
          />
          <GameList games={filtered} selected={selected} onToggle={toggle} />
          <div className={css({ mt: '3' })}>
            <SelectionSummary games={games} selected={selected} />
          </div>
        </>
      )}
    </main>
  );
}
