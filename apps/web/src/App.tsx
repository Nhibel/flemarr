import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { Card } from '@/components/Card.js';
import { DatUpload } from '@/features/dat-loader/DatUpload.js';
import { Fresh1g1rBrowser } from '@/features/dat-loader/Fresh1g1rBrowser.js';
import { GameFilters } from '@/features/game-list/GameFilters.js';
import { GameList } from '@/features/game-list/GameList.js';
import { SelectionSummary } from '@/features/game-list/SelectionSummary.js';
import { useGameFilters, applySelectedOnly } from '@/features/game-list/use-game-filters.js';
import { useSelection } from '@/features/game-list/use-selection.js';
import { ScanPage } from '@/features/scanner/ScanPage.js';
import { SourcesPanel } from '@/features/archive/SourcesPanel.js';
import { SystemFolderBar } from '@/components/SystemFolderBar.js';
import { DownloadManager } from '@/features/downloader/DownloadManager.js';
import type { QueuedDownload } from '@/features/downloader/DownloadManager.js';
import { fetchGames, listDats, deleteDat, getSettings } from '@/lib/api.js';
import { computeMissingGameIds } from '@/lib/missing-games.js';
import type { ScanResult } from '@shared/scan.js';
import { SettingsPage } from '@/features/settings/SettingsPage.js';
import { LexiquePage } from '@/features/lexique/LexiquePage.js';
import { useTheme } from '@/lib/use-theme.js';
import type { DatUploadResponse } from '@shared/api.js';
import { GearIcon, BookIcon, iconBtnClass } from '@/components/icons.js';

type Tab = 'games' | 'scanner' | 'sources' | 'downloads';
type LoaderMode = 'manual' | 'fresh1g1r';
type AppView = 'loader' | 'game' | 'settings' | 'lexique';

const TAB_LABELS: Record<Tab, string> = {
  games: 'Jeux',
  scanner: 'Scanner',
  sources: 'Sources',
  downloads: 'Téléchargements',
};

export function App() {
  const [activeDat, setActiveDat] = useState<DatUploadResponse | null>(null);
  const [loaderMode, setLoaderMode] = useState<LoaderMode>('fresh1g1r');
  const [view, setView] = useState<AppView>('loader');
  const { theme, setTheme } = useTheme();

  if (view === 'settings') {
    return (
      <SettingsPage
        onClose={() => setView(activeDat ? 'game' : 'loader')}
        theme={theme}
        onSetTheme={setTheme}
      />
    );
  }

  if (view === 'lexique') {
    return <LexiquePage onClose={() => setView(activeDat ? 'game' : 'loader')} />;
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
        onSettings={() => setView('settings')}
        onLexique={() => setView('lexique')}
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
      onLexique={() => setView('lexique')}
    />
  );
}

interface LoaderViewProps {
  loaderMode: LoaderMode;
  onSetLoaderMode: (m: LoaderMode) => void;
  onLoaded: (dat: DatUploadResponse) => void;
  onSettings: () => void;
  onLexique: () => void;
}

function LoaderView({
  loaderMode,
  onSetLoaderMode,
  onLoaded,
  onSettings,
  onLexique,
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
    <main
      className={css({
        maxW: '4xl',
        mx: 'auto',
        mt: { base: '8', md: '16' },
        px: { base: '4', md: '6', lg: '8' },
      })}
    >
      <div className={css({ display: 'flex', alignItems: 'center', gap: '1', mb: '6' })}>
        <h1
          className={css({
            fontSize: '3xl',
            fontWeight: 'bold',
            color: 'fg.heading',
            flex: 1,
            _cyberpunk: {
              textShadow: '0 0 10px #FDF500, 0 0 24px rgba(253, 245, 0, 0.4)',
            },
          })}
        >
          rom-curator
        </h1>
        <button onClick={onLexique} title="Lexique" aria-label="Lexique" className={iconBtnClass}>
          <BookIcon />
        </button>
        <button
          onClick={onSettings}
          title="Paramètres"
          aria-label="Paramètres"
          className={iconBtnClass}
        >
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
          <Card className={css({ overflow: 'hidden' })}>
            {existingDats.map((dat) => (
              <div
                key={dat.id}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid',
                  borderColor: 'bd.subtle',
                  bg: 'transparent',
                  _hover: { bg: 'bg.muted' },
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
                  aria-label="Supprimer ce DAT"
                  className={css({
                    px: '3',
                    py: '2',
                    fontSize: 'sm',
                    color: 'fg.faint',
                    cursor: 'pointer',
                    flexShrink: 0,
                    _hover: { color: 'status.danger.text' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  ✕
                </button>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Mode toggle */}
      <div
        className={css({
          display: 'inline-flex',
          mb: '6',
          border: '1px solid',
          borderColor: 'bd.default',
          borderRadius: 'xl',
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
              transition: 'background-color 0.15s, color 0.15s',
              bg: loaderMode === m ? 'accent.solid' : 'bg.surface',
              color: loaderMode === m ? 'accent.fg' : 'fg.subtle',
              _hover: { bg: loaderMode === m ? 'accent.solid' : 'bg.muted' },
            })}
          >
            {m === 'fresh1g1r' ? 'Fresh1G1R' : 'Manuel'}
          </button>
        ))}
      </div>

      {loaderMode === 'fresh1g1r' ? (
        // Loading a preset just adds it to "Reprendre un DAT chargé" above —
        // no auto-navigation, so browsing/loading several systems in a row
        // doesn't bounce to the game view each time.
        <Fresh1g1rBrowser
          onSuccess={() => void queryClient.invalidateQueries({ queryKey: ['dats'] })}
        />
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
  onLexique: () => void;
}

function GameView({ dat, onReset, onSettings, onLexique }: GameViewProps) {
  const [tab, setTab] = useState<Tab>('games');
  const [downloadJobs, setDownloadJobs] = useState<QueuedDownload[]>([]);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);

  const handleQueueDownload = (job: QueuedDownload) => {
    setDownloadJobs((prev) => [...prev, job]);
    setTab('downloads');
  };

  const handleClearCompletedDownloads = (jobIds: string[]) => {
    setDownloadJobs((prev) => prev.filter((j) => !jobIds.includes(j.jobId)));
  };

  const {
    data: games = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['games', dat.id],
    queryFn: () => fetchGames(dat.id),
  });

  // In "browser" mode the app never places files in a server-side folder it
  // manages, so there's nothing for the scanner (which reads
  // settings.systemPaths[system]) to check against — hide it and the folder
  // bar that exists to configure it, instead of nagging for a folder nobody
  // needs in that workflow.
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const showScanner = (settings?.downloadTarget ?? 'server') !== 'browser';
  const tabs: Tab[] = showScanner
    ? ['games', 'scanner', 'sources', 'downloads']
    : ['games', 'sources', 'downloads'];
  // Tabs always start with 'games' — this is specifically the Games tab's
  // own "next" shortcut, not a generic next-tab-in-general affordance.
  const nextTab = tabs[tabs.indexOf('games') + 1];

  const {
    filtered: baseFiltered,
    filterState,
    setSearch,
    toggleRegion,
    toggleCategory,
    setSortBy,
    toggleSortDir,
  } = useGameFilters(games);

  // "Select all" keeps operating on baseFiltered: with the selected-only view
  // active it must still mean "all filtered games", not "the visible subset".
  const { selected, toggle, selectAll, clearAll, deselect, isAllSelected } =
    useSelection(baseFiltered);

  const [selectedOnly, setSelectedOnly] = useState(false);
  const filtered = useMemo(
    () => applySelectedOnly(baseFiltered, selected, selectedOnly),
    [baseFiltered, selected, selectedOnly],
  );

  // Selected games the last scan didn't find on disk — null until a scan ran
  const missingGameIds = useMemo(
    () => (lastScan ? computeMissingGameIds(selected, games, lastScan) : null),
    [lastScan, selected, games],
  );

  return (
    <main
      className={css({
        maxW: '8xl',
        mx: 'auto',
        mt: { base: '6', md: '8' },
        px: { base: '4', md: '6', lg: '10' },
        pb: '12',
        // A real `height`, not `minHeight` — flex-grow only has space to
        // distribute when its container's own size is definite. With only
        // a minimum, this element simply grows to fit its content (its own
        // flex:1 child included), which defeats the point: the Games tab's
        // listbox would render at its full, unclipped content height
        // instead of being squeezed into the viewport. `overflowY: auto`
        // here (not on <html>/<body>) means the *other* tabs — plain block
        // children, not flex:1 — still scroll normally once their own
        // content exceeds 100vh, same as before this change.
        // Plain `vh`, not `dvh`: the dynamic unit exists specifically to
        // track a mobile browser's address bar showing/hiding, which
        // doesn't apply to Steam Deck's embedded/overlay browser context —
        // a likely candidate for an older engine that either doesn't
        // support `dvh` at all or computes it unreliably there (the
        // reported symptom, the list collapsing to a sliver instead of
        // over-filling or under-filling, didn't match either known flex
        // failure mode for a *missing* height — worth confirming this
        // actually fixes it rather than treating it as proven). `vh` has
        // been supported everywhere for well over a decade.
        height: '100vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '4',
          mb: '4',
          flexShrink: '0',
        })}
      >
        <h1
          title={dat.system}
          className={css({
            fontSize: '3xl',
            fontWeight: 'bold',
            color: 'fg.heading',
            flex: 1,
            minWidth: '0',
            truncate: true,
          })}
        >
          {dat.system}
        </h1>
        <span className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          {dat.source} · {dat.gameCount} jeux
        </span>
        <Button variant="secondary" size="sm" onClick={onReset}>
          Charger un autre DAT
        </Button>
        <button onClick={onLexique} title="Lexique" aria-label="Lexique" className={iconBtnClass}>
          <BookIcon />
        </button>
        <button
          onClick={onSettings}
          title="Paramètres"
          aria-label="Paramètres"
          className={iconBtnClass}
        >
          <GearIcon />
        </button>
      </div>

      {/* The system's library folder — only relevant to the scanner and to
          server-target downloads, both absent in "browser" mode */}
      {showScanner && (
        <div className={css({ flexShrink: '0' })}>
          <SystemFolderBar system={dat.system} />
        </div>
      )}

      {/* Tabs */}
      <div
        className={css({
          display: 'flex',
          gap: '1',
          mb: '4',
          pb: '2',
          borderBottom: '1px solid',
          borderColor: 'bd.default',
          flexWrap: 'wrap',
          flexShrink: '0',
        })}
      >
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={css({
              px: '4',
              py: '1.5',
              fontSize: 'sm',
              fontWeight: 'medium',
              cursor: 'pointer',
              borderRadius: 'lg',
              transition: 'background-color 0.15s, color 0.15s',
              bg: tab === t ? 'accent.subtle' : 'transparent',
              color: tab === t ? 'accent.text' : 'fg.subtle',
              _hover: {
                color: tab === t ? 'accent.text' : 'fg.default',
                bg: tab === t ? 'accent.subtle' : 'bg.surface',
              },
            })}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Games tab — kept mounted to preserve filter/selection state. Flex
          column, not a plain block: GameList's own listbox is the one
          child here that isn't pinned to its natural size (flexShrink: 0)
          — it sizes to its own content but shrinks (down to a floor) when
          that content plus everything else here doesn't fit the screen —
          see the comment on that listbox in GameList.tsx. */}
      <div
        className={css({
          display: tab === 'games' ? 'flex' : 'none',
          flexDirection: 'column',
          flex: '1',
          minHeight: '0',
        })}
      >
        {isLoading && (
          <p className={css({ color: 'fg.faint', fontSize: 'sm' })}>Chargement des jeux…</p>
        )}
        {error instanceof Error && (
          <p role="alert" className={css({ color: 'status.danger.text', fontSize: 'sm' })}>
            {error.message}
          </p>
        )}
        {!isLoading && !error && (
          <>
            <div className={css({ flexShrink: '0' })}>
              <GameFilters
                filterState={filterState}
                totalCount={games.length}
                filteredCount={filtered.length}
                selectedOnly={selectedOnly}
                selectedCount={selected.size}
                onToggleSelectedOnly={() => setSelectedOnly((v) => !v)}
                onSearch={setSearch}
                onToggleRegion={toggleRegion}
                onToggleCategory={toggleCategory}
                onSetSortBy={setSortBy}
                onToggleSortDir={toggleSortDir}
                onSelectAll={selectAll}
                onClearAll={clearAll}
                isAllSelected={isAllSelected}
              />
            </div>
            <GameList datId={dat.id} games={filtered} selected={selected} onToggle={toggle} />
            {/* Reserved space, not sticky — a fixed slot below the table so
                the summary's two states (plain text vs. the bordered chip)
                don't shift the layout when the selection count changes.
                Height scales with viewport so it doesn't look oversized on
                a small window or cramped on a large one. The next-tab
                button lives in the same row instead of adding one of its
                own — every row here is vertical space taken from the list. */}
            <div
              className={css({
                flexShrink: '0',
                mt: '3',
                minH: { base: '10', md: '12', lg: '14' },
                display: 'flex',
                alignItems: 'center',
                gap: '3',
              })}
            >
              <div className={css({ flex: '1', minWidth: '0' })}>
                <SelectionSummary games={games} selected={selected} />
              </div>
              {nextTab && (
                <Button variant="secondary" size="sm" onClick={() => setTab(nextTab)}>
                  {TAB_LABELS[nextTab]} ›
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Scanner tab — absent in "browser" mode (see showScanner above);
          kept mounted otherwise to preserve scan progress */}
      {showScanner && (
        <div className={css({ display: tab === 'scanner' ? 'block' : 'none' })}>
          <ScanPage datId={dat.id} system={dat.system} onScanComplete={setLastScan} />
        </div>
      )}

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
        {/* Games that downloaded cleanly leave the selection, so a retry (or a
            re-resolve) only ever covers what's left to fix. */}
        <DownloadManager
          jobs={downloadJobs}
          onGamesDownloaded={deselect}
          onClearCompleted={handleClearCompletedDownloads}
        />
      </div>
    </main>
  );
}
