import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { SystemFolderBar } from '@/components/SystemFolderBar.js';
import { DownloadManager } from '@/features/downloader/DownloadManager.js';
import type { QueuedDownload } from '@/features/downloader/DownloadManager.js';
import { fetchGames, listDats, deleteDat } from '@/lib/api.js';
import { computeMissingGameIds } from '@/lib/missing-games.js';
import type { ScanResult } from '@shared/scan.js';
import { SettingsPage } from '@/features/settings/SettingsPage.js';
import { useTheme } from '@/lib/use-theme.js';
import type { DatUploadResponse } from '@shared/api.js';
import { GearIcon, SunIcon, MoonIcon, iconBtnClass } from '@/components/icons.js';

type Tab = 'games' | 'scanner' | 'sources' | 'downloads';
type LoaderMode = 'manual' | 'fresh1g1r';
type AppView = 'loader' | 'game' | 'settings';

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
      <LoaderView
        loaderMode={loaderMode}
        onSetLoaderMode={setLoaderMode}
        onLoaded={(dat) => {
          setActiveDat(dat);
          setView('game');
        }}
        theme={theme}
        onToggleTheme={toggle}
        onSettings={() => setView('settings')}
      />
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

interface LoaderViewProps {
  loaderMode: LoaderMode;
  onSetLoaderMode: (m: LoaderMode) => void;
  onLoaded: (dat: DatUploadResponse) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSettings: () => void;
}

function LoaderView({
  loaderMode,
  onSetLoaderMode,
  onLoaded,
  theme,
  onToggleTheme,
  onSettings,
}: LoaderViewProps) {
  // DATs persisted server-side (SQLite) — lets the user resume without re-parsing
  const queryClient = useQueryClient();
  const { data: existingDats = [] } = useQuery({
    queryKey: ['dats'],
    queryFn: listDats,
  });
  const removeDat = useMutation({
    mutationFn: deleteDat,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['dats'] }),
  });

  return (
    <main className={css({ maxW: '2xl', mx: 'auto', mt: '16', px: '6' })}>
      <div className={css({ display: 'flex', alignItems: 'baseline', mb: '6' })}>
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'fg.heading', flex: 1 })}>
          rom-curator
        </h1>
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

      {/* Resume a previously loaded DAT */}
      {existingDats.length > 0 && (
        <section className={css({ mb: '6' })}>
          <h2
            className={css({
              fontSize: 'sm',
              fontWeight: 'semibold',
              color: 'fg.default',
              mb: '2',
            })}
          >
            Reprendre un DAT chargé
          </h2>
          <div
            className={css({
              border: '1px solid',
              borderColor: 'bd.default',
              borderRadius: 'md',
              overflow: 'hidden',
            })}
          >
            {existingDats.map((dat) => (
              <div
                key={dat.id}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid',
                  borderColor: 'bd.subtle',
                  bg: 'bg.page',
                  _hover: { bg: 'bg.surface' },
                  _last: { borderBottom: 'none' },
                })}
              >
                <button
                  onClick={() => onLoaded(dat)}
                  className={css({
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '2',
                    flex: 1,
                    minW: 0,
                    px: '3',
                    py: '2',
                    fontSize: 'sm',
                    textAlign: 'left',
                    cursor: 'pointer',
                  })}
                >
                  <span className={css({ color: 'fg.default', flex: 1, truncate: true })}>
                    {dat.system}
                  </span>
                  <span className={css({ fontSize: 'xs', color: 'fg.faint', flexShrink: 0 })}>
                    {dat.source} · {dat.gameCount} jeux
                  </span>
                </button>
                <button
                  onClick={() => removeDat.mutate(dat.id)}
                  disabled={removeDat.isPending}
                  title="Supprimer ce DAT"
                  className={css({
                    px: '3',
                    py: '2',
                    fontSize: 'sm',
                    color: 'fg.faint',
                    cursor: 'pointer',
                    flexShrink: 0,
                    _hover: { color: 'red.600' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

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
            onClick={() => onSetLoaderMode(m)}
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
        <Fresh1g1rBrowser onSuccess={onLoaded} />
      ) : (
        <DatUpload onSuccess={onLoaded} />
      )}
    </main>
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
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);

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

  // Selected games the last scan didn't find on disk — null until a scan ran
  const missingGameIds = useMemo(
    () => (lastScan ? computeMissingGameIds(selected, games, lastScan) : null),
    [lastScan, selected, games],
  );

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

      {/* The system's library folder — single definition used by scanner and downloads */}
      <SystemFolderBar system={dat.system} />

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
            <GameList datId={dat.id} games={filtered} selected={selected} onToggle={toggle} />
            <div className={css({ mt: '3' })}>
              <SelectionSummary games={games} selected={selected} />
            </div>
          </>
        )}
      </div>

      {/* Scanner tab — kept mounted to preserve scan progress */}
      <div className={css({ display: tab === 'scanner' ? 'block' : 'none' })}>
        <ScanPage datId={dat.id} system={dat.system} onScanComplete={setLastScan} />
      </div>

      {/* Sources tab — kept mounted to preserve resolve results */}
      <div className={css({ display: tab === 'sources' ? 'block' : 'none' })}>
        <SourcesPanel
          datId={dat.id}
          system={dat.system}
          source={dat.source}
          selectedGameIds={[...selected]}
          missingGameIds={missingGameIds}
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
