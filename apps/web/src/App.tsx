import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { DatUpload } from '@/features/dat-loader/DatUpload.js';
import { Fresh1g1rBrowser } from '@/features/dat-loader/Fresh1g1rBrowser.js';
import { GameFilters } from '@/features/game-list/GameFilters.js';
import { GameList } from '@/features/game-list/GameList.js';
import { SelectionSummary } from '@/features/game-list/SelectionSummary.js';
import { useGameFilters } from '@/features/game-list/use-game-filters.js';
import { useSelection } from '@/features/game-list/use-selection.js';
import { ScanPage } from '@/features/scanner/ScanPage.js';
import { SourcesPanel } from '@/features/archive/SourcesPanel.js';
import { DownloadManager } from '@/features/downloader/DownloadManager.js';
import type { QueuedDownload } from '@/features/downloader/DownloadManager.js';
import { fetchGames } from '@/lib/api.js';
import { SettingsPage } from '@/features/settings/SettingsPage.js';
import { useTheme } from '@/lib/use-theme.js';
import type { DatUploadResponse } from '@shared/api.js';

type Tab = 'games' | 'scanner' | 'sources' | 'downloads';
type LoaderMode = 'manual' | 'fresh1g1r';
type AppView = 'loader' | 'game' | 'settings';

function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

const iconBtnClass = css({
  color: 'fg.faint',
  cursor: 'pointer',
  p: '1',
  borderRadius: 'md',
  _hover: { color: 'fg.muted', bg: 'bg.muted' },
});

export function App() {
  const [activeDat, setActiveDat] = useState<DatUploadResponse | null>(null);
  const [loaderMode, setLoaderMode] = useState<LoaderMode>('fresh1g1r');
  const [view, setView] = useState<AppView>('loader');
  const { theme, toggle } = useTheme();

  if (view === 'settings') {
    return (
      <SettingsPage
        onClose={() => setView(activeDat ? 'game' : 'loader')}
        theme={theme}
        onToggleTheme={toggle}
      />
    );
  }

  if (activeDat === null) {
    return (
      <main className={css({ maxW: '2xl', mx: 'auto', mt: '16', px: '6' })}>
        <div className={css({ display: 'flex', alignItems: 'baseline', mb: '6' })}>
          <h1
            className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'fg.heading', flex: 1 })}
          >
            rom-curator
          </h1>
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            className={iconBtnClass}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={() => setView('settings')} title="Paramètres" className={iconBtnClass}>
            <GearIcon />
          </button>
        </div>

        {/* Mode toggle */}
        <div
          className={css({
            display: 'inline-flex',
            mb: '6',
            border: '1px solid',
            borderColor: 'bd.default',
            borderRadius: 'lg',
            overflow: 'hidden',
          })}
        >
          {(['fresh1g1r', 'manual'] as LoaderMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setLoaderMode(m)}
              className={css({
                px: '4',
                py: '2',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                bg: loaderMode === m ? 'blue.500' : 'bg.page',
                color: loaderMode === m ? 'white' : 'fg.subtle',
                _hover: { bg: loaderMode === m ? 'blue.500' : 'bg.surface' },
              })}
            >
              {m === 'fresh1g1r' ? 'Fresh1G1R' : 'Manuel'}
            </button>
          ))}
        </div>

        {loaderMode === 'fresh1g1r' ? (
          <Fresh1g1rBrowser
            onSuccess={(dat) => {
              setActiveDat(dat);
              setView('game');
            }}
          />
        ) : (
          <DatUpload
            onSuccess={(dat) => {
              setActiveDat(dat);
              setView('game');
            }}
          />
        )}
      </main>
    );
  }

  return (
    <GameView
      dat={activeDat}
      onReset={() => {
        setActiveDat(null);
        setView('loader');
      }}
      onSettings={() => setView('settings')}
      theme={theme}
      onToggleTheme={toggle}
    />
  );
}

interface GameViewProps {
  dat: DatUploadResponse;
  onReset: () => void;
  onSettings: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

function GameView({ dat, onReset, onSettings, theme, onToggleTheme }: GameViewProps) {
  const [tab, setTab] = useState<Tab>('games');
  const [downloadJobs, setDownloadJobs] = useState<QueuedDownload[]>([]);

  const handleQueueDownload = (job: QueuedDownload) => {
    setDownloadJobs((prev) => [...prev, job]);
    setTab('downloads');
  };

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
      <div className={css({ display: 'flex', alignItems: 'baseline', gap: '4', mb: '4' })}>
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'fg.heading', flex: 1 })}>
          {dat.system}
        </h1>
        <span className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          {dat.source} · {dat.gameCount} games
        </span>
        <button
          onClick={onReset}
          className={css({
            fontSize: 'sm',
            color: 'blue.600',
            cursor: 'pointer',
            _hover: { textDecoration: 'underline' },
            _dark: { color: 'blue.400' },
          })}
        >
          Load different DAT
        </button>
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          className={iconBtnClass}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button onClick={onSettings} title="Paramètres" className={iconBtnClass}>
          <GearIcon />
        </button>
      </div>

      {/* Tabs */}
      <div
        className={css({
          display: 'flex',
          gap: '0',
          mb: '4',
          borderBottom: '1px solid',
          borderColor: 'bd.default',
        })}
      >
        {(['games', 'scanner', 'sources', 'downloads'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={css({
              px: '4',
              py: '2',
              fontSize: 'sm',
              fontWeight: 'medium',
              cursor: 'pointer',
              borderBottom: '2px solid',
              borderColor: tab === t ? 'blue.500' : 'transparent',
              color: tab === t ? 'blue.600' : 'fg.subtle',
              _hover: { color: 'fg.default' },
              _dark: { color: tab === t ? 'blue.400' : undefined },
              textTransform: 'capitalize',
            })}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Games tab — kept mounted to preserve filter/selection state */}
      <div className={css({ display: tab === 'games' ? 'block' : 'none' })}>
        {isLoading && <p className={css({ color: 'fg.faint', fontSize: 'sm' })}>Loading games…</p>}
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
      </div>

      {/* Scanner tab — kept mounted to preserve scan progress */}
      <div className={css({ display: tab === 'scanner' ? 'block' : 'none' })}>
        <ScanPage datId={dat.id} />
      </div>

      {/* Sources tab — kept mounted to preserve resolve results */}
      <div className={css({ display: tab === 'sources' ? 'block' : 'none' })}>
        <SourcesPanel
          datId={dat.id}
          system={dat.system}
          selectedGameIds={[...selected]}
          onQueueDownload={handleQueueDownload}
        />
      </div>

      {/* Downloads tab — kept mounted to preserve job progress */}
      <div className={css({ display: tab === 'downloads' ? 'block' : 'none' })}>
        <DownloadManager jobs={downloadJobs} />
      </div>
    </main>
  );
}
