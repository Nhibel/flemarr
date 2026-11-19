import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSources, resolveGames, startDownload } from '@/lib/api.js';
import type { DownloadRequest, ResolveResponse } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { useSettings } from '@/lib/use-settings.js';
import { useSystemFolder } from '@/lib/use-system-folder.js';
import type { QueuedDownload } from '@/features/downloader/job-state.js';
import { buildDownloadItems } from './build-items.js';
import { sourceKeyOf, summarizeResolve } from './resolve-summary.js';
import type { ResolveSummary } from './resolve-summary.js';

interface ResolvePanelInput {
  datId: string;
  system: string;
  selectedGameIds: string[];
  missingGameIds: string[] | null;
  onQueueDownload: (job: QueuedDownload) => void;
}

/**
 * State and actions of ResolvePanel: which games to resolve, the resolve
 * results, the per-ROM source choice, and queueing the download. The panel
 * itself only lays these out.
 */
export function useResolvePanel({
  datId,
  system,
  selectedGameIds,
  missingGameIds,
  onQueueDownload,
}: ResolvePanelInput) {
  // Stored with the source list it was resolved against: the server drops its
  // resolver cache when sources change, but these results are client state and
  // would otherwise keep offering download URLs from a source just removed.
  const [resolved, setResolved] = useState<{ result: ResolveResponse; sourceKey: string } | null>(
    null,
  );
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excludeOwned, setExcludeOwned] = useState(true);
  const [queuing, setQueuing] = useState(false);
  // Keyed by `${gameId}/${romName}` — which of a rom's matching sources to
  // actually download from, when more than one configured source has it.
  // Absent means "use the first" (today's behavior, unchanged when there's
  // only one match anyway).
  const [selectedSourceIndex, setSelectedSourceIndex] = useState<Map<string, number>>(new Map());

  const { data: sourcesData } = useQuery({
    queryKey: queryKeys.archiveSources(system),
    queryFn: () => fetchSources(system),
  });

  // Picked once in Settings for the whole session — no reason to mix
  // server and browser destinations across downloads (the choice lives in
  // Réglages' topology section, which writes downloadTarget).
  const { data: settingsData } = useSettings();
  const downloadTarget = settingsData?.downloadTarget ?? 'server';

  // The system's folder, chosen once in SystemFolderBar — the server
  // download's actual destination, or (in browser mode) just the folder the
  // scanner checks once the files are moved there by hand.
  const { folder: destinationDir, loaded: settingsLoaded } = useSystemFolder(system);

  const hasSources = (sourcesData?.sources.length ?? 0) > 0;
  const sourceKey = sourceKeyOf(sourcesData?.sources ?? []);
  const result = resolved?.result ?? null;
  const summary: ResolveSummary | null = result ? summarizeResolve(result) : null;
  const isStale = resolved !== null && resolved.sourceKey !== sourceKey;
  const isServerTarget = downloadTarget === 'server';
  const lacksServerFolder = isServerTarget && destinationDir === '';
  // Only once settings have loaded: an empty folder before that means
  // "unknown", not "unset".
  const hasNoFolder = lacksServerFolder && settingsLoaded;

  const effectiveGameIds =
    excludeOwned && missingGameIds !== null ? missingGameIds : selectedGameIds;

  const canResolve = !resolving && effectiveGameIds.length > 0 && hasSources;
  const canDownload = !queuing && !isStale && !lacksServerFolder;

  const resolve = useCallback(async () => {
    if (effectiveGameIds.length === 0) return;
    setResolving(true);
    setError(null);
    try {
      const response = await resolveGames(datId, effectiveGameIds);
      setResolved({ result: response, sourceKey });
      // A fresh resolve invalidates any earlier per-rom source choice — the
      // set of matching sources (and their order) may have changed.
      setSelectedSourceIndex(new Map());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setResolving(false);
    }
  }, [datId, effectiveGameIds, sourceKey]);

  const download = useCallback(async () => {
    if (isStale || lacksServerFolder || result === null) return;
    // Item building lives in build-items.ts so the retry path in
    // DownloadManager produces identical items, fallbacks included.
    const items = buildDownloadItems(result, selectedSourceIndex);
    if (items.length === 0) return;
    const request: DownloadRequest = isServerTarget
      ? { datId, items, target: 'server', destinationDir }
      : { datId, items, target: 'browser' };
    setQueuing(true);
    try {
      const jobId = await startDownload(request);
      onQueueDownload({ jobId, ...request });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur au lancement');
    } finally {
      setQueuing(false);
    }
  }, [
    datId,
    destinationDir,
    isServerTarget,
    isStale,
    lacksServerFolder,
    onQueueDownload,
    result,
    selectedSourceIndex,
  ]);

  const selectSource = useCallback((gameId: string, romName: string, index: number) => {
    setSelectedSourceIndex((previous) => {
      const next = new Map(previous);
      next.set(`${gameId}/${romName}`, index);
      return next;
    });
  }, []);

  return {
    downloadTarget,
    destinationDir,
    effectiveGameIds,
    excludeOwned,
    setExcludeOwned,
    hasSources,
    hasNoFolder,
    isStale,
    result,
    summary,
    error,
    resolving,
    queuing,
    canResolve,
    canDownload,
    resolve,
    download,
    selectedSourceIndex,
    selectSource,
  };
}
