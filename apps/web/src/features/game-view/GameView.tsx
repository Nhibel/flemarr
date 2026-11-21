import { useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { SegmentedControl } from '@/components/SegmentedControl.js';
import { GameFilters } from '@/features/game-list/GameFilters.js';
import { GameList } from '@/features/game-list/GameList.js';
import { useGameFilters, applySelectedOnly } from '@/features/game-list/use-game-filters.js';
import { useSelection } from '@/features/game-list/use-selection.js';
import { ScanPage } from '@/features/scanner/ScanPage.js';
import { SourcesPanel } from '@/features/archive/SourcesPanel.js';
import { SystemFolderBar } from '@/features/folders/SystemFolderBar.js';
import { DownloadManager } from '@/features/downloader/DownloadManager.js';
import { DownloadHistory } from '@/features/downloader/DownloadHistory.js';
import type { QueuedDownload } from '@/features/downloader/job-state.js';
import { useRunningDownloads } from '@/features/downloader/use-running-downloads.js';
import { fetchGames } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { useSettings } from '@/lib/use-settings.js';
import { useSystemIcons } from '@/lib/use-system-icons.js';
import { computeMissingGameIds, computeOwnership, countOwned } from '@/lib/missing-games.js';
import type { DatUploadResponse } from '@shared/api.js';
import { GameHeader } from './GameHeader.js';
import { SelectionDock } from './SelectionDock.js';
import { TAB_LABELS, tabAfterGames, visibleTabs } from './tabs.js';
import { useLastScan } from './use-last-scan.js';
import type { Tab } from './tabs.js';

interface Props {
  dat: DatUploadResponse;
  /** The tab asked for (from the URL); the Scanner falls back to Games when hidden. */
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onReset: () => void;
  onSettings: () => void;
  onLexique: () => void;
}

/**
 * One system's screen: the header, then the Games / Scanner / Sources /
 * Downloads tabs. Owns the state the tabs share — selection, last scan,
 * queued downloads — and hands each tab what it needs.
 */
export function GameView({
  dat,
  tab: requestedTab,
  onTabChange: setTab,
  onReset,
  onSettings,
  onLexique,
}: Props) {
  const [downloadJobs, setDownloadJobs] = useState<QueuedDownload[]>([]);
  const { lastScan, lastScanAt, refresh: refreshLastScan } = useLastScan(dat.id, dat.system);
  const systemIcons = useSystemIcons([dat.system]);

  // Jobs still running server-side, after a reload: shown again, once each.
  const addRunningDownloads = useCallback((running: QueuedDownload[]) => {
    setDownloadJobs((prev) => {
      const known = new Set(prev.map((job) => job.jobId));
      const fresh = running.filter((job) => !known.has(job.jobId));
      return fresh.length === 0 ? prev : [...prev, ...fresh];
    });
  }, []);
  useRunningDownloads(dat.id, addRunningDownloads);

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
    queryKey: queryKeys.games(dat.id),
    queryFn: () => fetchGames(dat.id),
    // Immutable until the DAT is reloaded, which keeps its id: the loaders
    // invalidate it then (lib/invalidate-loaded-dat.ts). Without this,
    // reopening a system refetched its whole catalogue every time.
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // In "browser" mode the app never places files in a server-side folder it
  // manages, so there's nothing for the scanner (which reads
  // settings.systemPaths[system]) to check against — hide it and the folder
  // bar that exists to configure it, instead of nagging for a folder nobody
  // needs in that workflow.
  const { data: settings } = useSettings();
  const showScanner = (settings?.downloadTarget ?? 'server') !== 'browser';
  const tabs = visibleTabs(showScanner);
  // A bookmarked Scanner tab in "browser" mode, where it does not exist.
  const tab = tabs.includes(requestedTab) ? requestedTab : 'games';
  const tabOptions = tabs.map((t) => ({ value: t, label: TAB_LABELS[t] }));

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
  const { selected, toggle, selectAll, select, clearAll, deselect, isAllSelected } =
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

  // Per-game ownership for the row tags, and its totals for the header.
  // Undefined until a scan has run: with no scan the app knows nothing
  // about what's on disk, and says so rather than tagging 1500 rows
  // "missing" on the strength of no evidence.
  const ownership = useMemo(
    () => (lastScan ? computeOwnership(games, lastScan) : undefined),
    [games, lastScan],
  );
  const ownedCount = useMemo(() => (ownership ? countOwned(ownership) : null), [ownership]);

  const isGamesReady = !isLoading && !error;
  const gameNames = useMemo(() => new Map(games.map((game) => [game.id, game.name])), [games]);
  const queryClient = useQueryClient();
  const refreshHistory = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: queryKeys.downloadHistory(dat.id) }),
    [dat.id, queryClient],
  );
  // The "possession inconnue" notice shows only when a scan could tell us
  // something but hasn't run — in browser mode it never can, and repeating
  // that on every visit would be nagging about a choice already made.
  const showUnscannedNotice = showScanner && ownership === undefined;

  return (
    <main
      className={css({
        maxW: '6xl',
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
      <GameHeader
        dat={dat}
        iconStyle={systemIcons.get(dat.system)}
        ownedCount={ownedCount}
        lastScanAt={lastScanAt}
        showScanner={showScanner}
        onScan={() => setTab('scanner')}
        onReset={onReset}
        onLexique={onLexique}
        onSettings={onSettings}
      />

      {/* The system's library folder — only relevant to the scanner and to
          server-target downloads, both absent in "browser" mode */}
      {showScanner && (
        <div className={css({ flexShrink: '0' })}>
          <SystemFolderBar system={dat.system} />
        </div>
      )}

      <SegmentedControl
        options={tabOptions}
        value={tab}
        onChange={setTab}
        density="roomy"
        className={css({ mb: '4', flexShrink: '0' })}
      />

      {/* Games tab — kept mounted to preserve filter/selection state. Flex
          column, not a plain block: GameList's own listbox is the one
          child here that isn't pinned to its natural size (flexShrink: 0)
          — it sizes to its own content but shrinks (down to a floor) when
          that content plus everything else here doesn't fit the screen —
          see the comment on that listbox in GameList.tsx. */}
      <TabPanel active={tab === 'games'} layout="fill">
        {isLoading && (
          <p className={css({ color: 'fg.faint', fontSize: 'sm' })}>Chargement des jeux…</p>
        )}
        {error instanceof Error && (
          <p role="alert" className={css({ color: 'status.danger.text', fontSize: 'sm' })}>
            {error.message}
          </p>
        )}
        {isGamesReady && (
          <>
            <div className={css({ flexShrink: '0' })}>
              <GameFilters
                filterState={filterState}
                totalCount={games.length}
                filteredCount={filtered.length}
                selectedOnly={selectedOnly}
                selectedCount={selected.size}
                onToggleSelectedOnly={() => setSelectedOnly((v) => !v)}
                onToggleRegion={toggleRegion}
                onToggleCategory={toggleCategory}
                onSetSortBy={setSortBy}
                onToggleSortDir={toggleSortDir}
                onSelectAll={selectAll}
                onClearAll={clearAll}
                isAllSelected={isAllSelected}
              />
            </div>
            {showUnscannedNotice && <UnscannedNotice />}

            <GameList
              datId={dat.id}
              games={filtered}
              selected={selected}
              onToggle={toggle}
              ownership={ownership}
              search={filterState.search}
              onSearch={setSearch}
              totalGames={games.length}
            />
            <SelectionDock
              games={games}
              selected={selected}
              target={settings?.downloadTarget}
              nextTab={tabAfterGames(tabs)}
              onNext={setTab}
            />
          </>
        )}
      </TabPanel>

      {/* Scanner tab — absent in "browser" mode (see showScanner above);
          kept mounted otherwise to preserve scan progress */}
      {showScanner && (
        <TabPanel active={tab === 'scanner'}>
          <ScanPage datId={dat.id} system={dat.system} onScanComplete={refreshLastScan} />
        </TabPanel>
      )}

      {/* Sources tab — kept mounted to preserve resolve results */}
      <TabPanel active={tab === 'sources'}>
        <SourcesPanel
          datId={dat.id}
          system={dat.system}
          source={dat.source}
          selectedGameIds={[...selected]}
          missingGameIds={missingGameIds}
          onQueueDownload={handleQueueDownload}
        />
      </TabPanel>

      {/* Downloads tab — kept mounted to preserve job progress */}
      <TabPanel active={tab === 'downloads'}>
        {/* Games that downloaded cleanly leave the selection, so a retry (or a
            re-resolve) only ever covers what's left to fix. */}
        <DownloadManager
          jobs={downloadJobs}
          onGamesDownloaded={deselect}
          onClearCompleted={handleClearCompletedDownloads}
          // A retry is a new job, so it joins the list the same way a fresh
          // download does — without switching tabs, since the user is
          // already looking at this one.
          onQueueRetry={(job) => setDownloadJobs((prev) => [...prev, job])}
          // Finished jobs have just written their attempts to the history.
          onAllDone={refreshHistory}
        />
        <DownloadHistory
          datId={dat.id}
          gameNames={gameNames}
          onSelectGames={(gameIds) => {
            select(gameIds);
            setTab('games');
          }}
        />
      </TabPanel>
    </main>
  );
}

const TAB_PANEL_CLASS = {
  hidden: css({ display: 'none' }),
  block: css({ display: 'block' }),
  fill: css({ display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' }),
} as const;

/**
 * A tab's content, kept mounted while hidden so its state (filters,
 * selection, scan progress, resolve results, download jobs) survives a tab
 * switch. `fill` takes the remaining height of the view, for the game list.
 */
function TabPanel({
  active,
  layout = 'block',
  children,
}: {
  active: boolean;
  layout?: 'block' | 'fill';
  children: ReactNode;
}) {
  return <div className={TAB_PANEL_CLASS[active ? layout : 'hidden']}>{children}</div>;
}

/** The comps' "possession inconnue" notice, above the list until a scan runs. */
function UnscannedNotice() {
  return (
    <p
      className={css({
        flexShrink: '0',
        mb: '2',
        px: '4',
        py: '3',
        bg: 'status.info.subtle',
        color: 'status.info.text',
        borderRadius: '14px',
        fontSize: 'xs',
      })}
    >
      Aucun dossier n&apos;a encore été vérifié, donc tout le catalogue s&apos;affiche : rom-curator
      ne peut pas savoir quels jeux tu as déjà. Pointe ton dossier une fois et chaque ligne dira où
      elle en est.
    </p>
  );
}
