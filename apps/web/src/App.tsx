import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
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
import { fetchGames, listDats, deleteDat, getSettings, updateSettings } from '@/lib/api.js';
import { computeMissingGameIds, computeOwnership } from '@/lib/missing-games.js';
import type { ScanResult } from '@shared/scan.js';
import { SettingsPage } from '@/features/settings/SettingsPage.js';
import { LexiquePage } from '@/features/lexique/LexiquePage.js';
import { TopologyStep } from '@/features/onboarding/TopologyStep.js';
import { useTheme } from '@/lib/use-theme.js';
import { useFontScale } from '@/lib/use-font-scale.js';
import { FontScaleControl } from '@/components/FontScaleControl.js';
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
  const queryClient = useQueryClient();
  const { data: rootSettings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const { data: knownDats } = useQuery({ queryKey: ['dats'], queryFn: listDats });

  const chooseTopology = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => queryClient.setQueryData(['settings'], updated),
  });

  // The install question runs only on an install that has never been used:
  // no answer recorded, no system folder configured, no DAT ever loaded.
  //
  // All three conditions matter, not just the first. Answering writes
  // downloadTarget, so showing this to an existing user who happens to have
  // no topology recorded — anyone who installed before this field existed —
  // could silently flip where their downloads go. The extra conditions make
  // that impossible: an install with a folder or a DAT is one that already
  // works, and its existing downloadTarget is the answer.
  const needsTopology =
    rootSettings !== undefined &&
    knownDats !== undefined &&
    rootSettings.topology === null &&
    Object.keys(rootSettings.systemPaths).length === 0 &&
    knownDats.length === 0;
  const { fontScale, setFontScale } = useFontScale();

  let content: ReactNode;
  if (view === 'settings') {
    content = (
      <SettingsPage
        onClose={() => setView(activeDat ? 'game' : 'loader')}
        theme={theme}
        onSetTheme={setTheme}
      />
    );
  } else if (view === 'lexique') {
    content = <LexiquePage onClose={() => setView(activeDat ? 'game' : 'loader')} />;
  } else if (needsTopology && activeDat === null) {
    content = <TopologyStep saving={chooseTopology.isPending} onChoose={chooseTopology.mutate} />;
  } else if (activeDat === null) {
    content = (
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
  } else {
    content = (
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

  return (
    <>
      {content}
      {/* Fixed position, outside the normal page flow, mounted once here
          (not per-view, not inline next to Lexique/Réglages) — see
          FontScaleControl's own comment for why it can't sit inline with
          those icons and still stay put as fontScale changes. */}
      <FontScaleControl fontScale={fontScale} onSetFontScale={setFontScale} />
    </>
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
        maxW: '6xl',
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
              // The comps' own title glow strength. Cyberpunk and Matrix
              // are the two themes whose artboard lights the page title;
              // both read the colour from fg.heading, which is their
              // accent.
              textShadow: '0 0 14px rgba(253, 245, 0, 0.3)',
            },
            _matrix: {
              textShadow: '0 0 12px rgba(67, 245, 123, 0.28)',
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

      {/* Mode toggle — a segmented control on a track, like the tab row and
          the display-mode switch. Two mutually exclusive choices, so the
          same shape everywhere they appear. */}
      <div
        className={css({
          display: 'inline-flex',
          gap: '0.5',
          p: '0.5',
          mb: '6',
          bg: 'bg.muted',
          borderRadius: '13px',
        })}
      >
        {(['fresh1g1r', 'manual'] as LoaderMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onSetLoaderMode(m)}
            className={css({
              px: '4',
              minH: '34px',
              fontSize: 'sm',
              fontWeight: loaderMode === m ? 'bold' : 'medium',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '10px',
              transition: 'background-color 0.15s, color 0.15s',
              bg: loaderMode === m ? 'accent.solid' : 'transparent',
              color: loaderMode === m ? 'accent.fg' : 'fg.subtle',
              _hover: { color: loaderMode === m ? 'accent.fg' : 'fg.default' },
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
  // When that scan ran, for the header. A clock time rather than the comps'
  // relative "il y a 2 jours": the scan result lives in React state only
  // and is lost on reload, so it can never be older than the current
  // session — a duration would imply a persistence that isn't there.
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);

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

  // Per-game ownership for the row tags, and its totals for the header.
  // Undefined until a scan has run: with no scan the app knows nothing
  // about what's on disk, and says so rather than tagging 1500 rows
  // "missing" on the strength of no evidence.
  const ownership = useMemo(
    () => (lastScan ? computeOwnership(games, lastScan) : undefined),
    [games, lastScan],
  );
  const ownedCount = useMemo(() => {
    if (!ownership) return null;
    let owned = 0;
    for (const state of ownership.values()) if (state !== 'missing') owned += 1;
    return owned;
  }, [ownership]);

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
      {/* Header — one floating card holding the system name, the library
          search and the icon actions, as the design comps show it. The
          header holds the system it applies to on the left and the app's own
          navigation on the right, with a divider between them.
          It does NOT hold the library search any more: see GameList, which
          renders it on the row above the list.

          No flexWrap, and exactly ONE flexible child — the title. Every
          other child is flexShrink: 0, so they are all pinned to the right
          edge at a constant position and the title absorbs the variation by
          truncating. Before this, the header wrapped and every control
          after the title shifted with the length of the system name, which
          moved Lexique and Réglages around between consoles. Navigation
          that moves is navigation you have to re-find every time. */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '3',
          mb: '4',
          px: '4',
          py: '3',
          bg: 'bg.surface',
          borderRadius: '16px',
          shadow: 'md',
          flexShrink: '0',
        })}
      >
        <h1
          title={dat.system}
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: 'fg.heading',
            flex: '1',
            minWidth: '0',
            truncate: true,
            _cyberpunk: {
              textShadow: '0 0 12px rgba(253, 245, 0, 0.3)',
            },
            _matrix: {
              textShadow: '0 0 12px rgba(67, 245, 123, 0.28)',
            },
          })}
        >
          {dat.system}
        </h1>
        {/* Ownership counter, as in the comps: how much of the catalogue is
            already on disk, and how much is not. Two wordings, because the
            honest answer differs — with no scan the app does not know what
            is owned, and the comps' "catalogue, possession inconnue" state
            says exactly that instead of showing a count of zero. */}
        {ownedCount !== null ? (
          <span
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              flexShrink: '0',
              fontFamily: 'mono',
              fontSize: '2xs',
            })}
          >
            <span className={css({ color: 'status.success.text' })}>
              {ownedCount} sur ton disque
            </span>
            <span className={css({ color: 'fg.faint' })}>
              {dat.gameCount - ownedCount} manquants sur {dat.gameCount}
            </span>
            {/* Dropped below lg: this row has to stay on one line at the
                Steam Deck's 1280px, and the time is the least load-bearing
                thing in it. */}
            {lastScanAt && (
              <span className={css({ color: 'fg.faint', display: { base: 'none', lg: 'inline' } })}>
                vérifié à {lastScanAt.toLocaleTimeString()}
              </span>
            )}
          </span>
        ) : (
          <span
            className={css({
              flexShrink: '0',
              fontFamily: 'mono',
              fontSize: '2xs',
              color: 'fg.faint',
            })}
          >
            {dat.source} · {dat.gameCount} jeux · possession inconnue
          </span>
        )}

        {/* The comps' "Revérifier mon dossier". It navigates to the scanner
            rather than starting a scan from here: the scan trigger lives in
            ScanPage with its own directory picker and progress stream, and
            lifting it into the header belongs with dissolving the tabs, not
            with this change. */}
        {showScanner && (
          <span className={css({ flexShrink: '0' })}>
            <Button variant="secondary" size="sm" onClick={() => setTab('scanner')}>
              {ownedCount !== null ? 'Revérifier mon dossier' : 'Vérifier un dossier'}
            </Button>
          </span>
        )}

        {/* Everything left of this line is about the console currently open;
            everything right of it is about the app. A 1px rule is the right
            tool here: it is a divider inside a card, which is the one place
            the redesign kept borders. */}
        <span
          aria-hidden
          className={css({
            flexShrink: '0',
            w: '1px',
            alignSelf: 'stretch',
            my: '1',
            bg: 'bd.default',
          })}
        />

        <span className={css({ display: 'flex', alignItems: 'center', gap: '2', flexShrink: '0' })}>
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
        </span>
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
          alignSelf: 'flex-start',
          p: '0.5',
          bg: 'bg.muted',
          borderRadius: '13px',
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
              minH: '34px',
              fontSize: 'sm',
              fontWeight: tab === t ? 'bold' : 'medium',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '10px',
              transition: 'background-color 0.15s, color 0.15s',
              bg: tab === t ? 'accent.solid' : 'transparent',
              color: tab === t ? 'accent.fg' : 'fg.subtle',
              _hover: {
                color: tab === t ? 'accent.fg' : 'fg.default',
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
                onToggleRegion={toggleRegion}
                onToggleCategory={toggleCategory}
                onSetSortBy={setSortBy}
                onToggleSortDir={toggleSortDir}
                onSelectAll={selectAll}
                onClearAll={clearAll}
                isAllSelected={isAllSelected}
              />
            </div>
            {/* The comps' "possession inconnue" notice. Only when a scan
                could tell us something but hasn't run — in browser mode it
                never can, and repeating that on every visit would be
                nagging about a choice the user already made. */}
            {showScanner && ownership === undefined && (
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
                Aucun dossier n&apos;a encore été vérifié, donc tout le catalogue s&apos;affiche :
                rom-curator ne peut pas savoir quels jeux tu as déjà. Pointe ton dossier une fois et
                chaque ligne dira où elle en est.
              </p>
            )}

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
            {/* Reserved space, not sticky — a fixed slot below the table so
                the summary's two states (plain text vs. the bordered chip)
                don't shift the layout when the selection count changes.
                Height scales with viewport so it doesn't look oversized on
                a small window or cramped on a large one. The next-tab
                button lives in the same row instead of adding one of its
                own — every row here is vertical space taken from the list. */}
            {/* A floating action dock: its own rounded surface detached
                from the page, rather than text sitting loose under the
                list. SelectionSummary no longer draws a surface of its own
                (that was a card inside a card), so the dock is the only
                one here. Radius in literal px, like every other radius
                since the redesign, so the live font-size control can't
                round it into a lozenge. */}
            <div
              className={css({
                flexShrink: '0',
                mt: '3',
                minH: { base: '10', md: '12', lg: '14' },
                display: 'flex',
                alignItems: 'center',
                gap: '3',
                px: '4',
                // bg.inverse, not bg.surface: in six themes they are the
                // same value, and in Sonic Mania the dock is the dark card
                // its artboard makes it. SelectionSummary reads
                // fg.onInverse for the same reason.
                bg: 'bg.inverse',
                borderRadius: '16px',
                shadow: 'lg',
              })}
            >
              <div className={css({ flex: '1', minWidth: '0' })}>
                <SelectionSummary
                  games={games}
                  selected={selected}
                  target={settings?.downloadTarget}
                />
              </div>
              {/* Primary, not secondary: in the comps the dock's button is
                  the filled accent one — it is what you press once the
                  selection is made, and the dock exists to carry it. */}
              {nextTab && (
                <Button variant="primary" size="md" onClick={() => setTab(nextTab)}>
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
          <ScanPage
            datId={dat.id}
            system={dat.system}
            onScanComplete={(result) => {
              setLastScan(result);
              setLastScanAt(new Date());
            }}
          />
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
