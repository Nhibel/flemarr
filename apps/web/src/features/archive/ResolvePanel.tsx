import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { fetchSources, resolveGames, startDownload } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { useSettings } from '@/lib/use-settings.js';
import type { ResolveResponse } from '@/lib/api.js';
import type { QueuedDownload } from '@/features/downloader/job-state.js';
import { ResolvedGameRow } from './ResolvedGameRow.js';
import { buildDownloadItems } from './build-items.js';
import { sourceKeyOf, summarizeResolve } from './resolve-summary.js';
import { Button } from '@/components/Button.js';
import { Chip } from '@/components/Chip.js';
import { useSystemFolder } from '@/lib/use-system-folder.js';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';

export function ResolvePanel({
  datId,
  system,
  selectedGameIds,
  missingGameIds,
  onQueueDownload,
}: {
  datId: string;
  system: string;
  selectedGameIds: string[];
  missingGameIds: string[] | null;
  onQueueDownload: (job: QueuedDownload) => void;
}) {
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
  const romsRoot = useRomsRoot();

  const hasSources = (sourcesData?.sources.length ?? 0) > 0;
  const sourceKey = sourceKeyOf(sourcesData?.sources ?? []);
  const result = resolved?.result ?? null;
  const stale = resolved !== null && resolved.sourceKey !== sourceKey;
  const noFolder = downloadTarget === 'server' && settingsLoaded && destinationDir === '';

  const effectiveGameIds =
    excludeOwned && missingGameIds !== null ? missingGameIds : selectedGameIds;

  const summary = result ? summarizeResolve(result) : null;
  const downloadableCount = summary?.downloadableCount ?? 0;

  const handleResolve = useCallback(async () => {
    if (effectiveGameIds.length === 0) return;
    setResolving(true);
    setError(null);
    try {
      const res = await resolveGames(datId, effectiveGameIds);
      setResolved({ result: res, sourceKey });
      // A fresh resolve invalidates any earlier per-rom source choice — the
      // set of matching sources (and their order) may have changed.
      setSelectedSourceIndex(new Map());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setResolving(false);
    }
  }, [datId, effectiveGameIds, sourceKey]);

  // Item building lives in build-items.ts so the retry path in
  // DownloadManager produces identical items, fallbacks included.
  const buildItems = useCallback(
    () => (result ? buildDownloadItems(result, selectedSourceIndex) : []),
    [result, selectedSourceIndex],
  );

  const handleDownload = useCallback(async () => {
    if (stale) return;
    if (downloadTarget === 'server' && !destinationDir) return;
    const items = buildItems();
    if (items.length === 0) return;
    setQueuing(true);
    try {
      const jobId =
        downloadTarget === 'server'
          ? await startDownload({ datId, items, target: 'server', destinationDir })
          : await startDownload({ datId, items, target: 'browser' });
      onQueueDownload(
        downloadTarget === 'server'
          ? { jobId, datId, items, target: 'server', destinationDir }
          : { jobId, datId, items, target: 'browser' },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur au lancement');
    } finally {
      setQueuing(false);
    }
  }, [buildItems, datId, destinationDir, downloadTarget, onQueueDownload, stale]);

  return (
    <section>
      <div className={css({ display: 'flex', alignItems: 'center', gap: '3', mb: '3' })}>
        <h2
          className={css({
            fontSize: 'base',
            fontWeight: 'semibold',
            color: 'fg.heading',
            flex: 1,
          })}
        >
          Résolution des sources
        </h2>
        <Button
          onClick={() => void handleResolve()}
          disabled={resolving || effectiveGameIds.length === 0 || !hasSources}
        >
          {resolving
            ? 'Recherche…'
            : `Chercher les sources (${effectiveGameIds.length} jeu${effectiveGameIds.length !== 1 ? 'x' : ''})`}
        </Button>
      </div>

      {missingGameIds !== null && (
        <label
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            mb: '3',
            fontSize: 'sm',
            color: 'fg.default',
            cursor: 'pointer',
          })}
        >
          <input
            type="checkbox"
            checked={excludeOwned}
            onChange={(e) => setExcludeOwned(e.target.checked)}
          />
          Exclure les jeux déjà possédés d'après le dernier scan (
          {selectedGameIds.length - missingGameIds.length} sur {selectedGameIds.length} possédé
          {selectedGameIds.length - missingGameIds.length !== 1 ? 's' : ''})
        </label>
      )}

      {!hasSources && (
        <p className={css({ fontSize: 'sm', color: 'status.warning.text' })}>
          Ajoute au moins une source ci-dessus avant de lancer la résolution.
        </p>
      )}

      {selectedGameIds.length === 0 && hasSources && (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Sélectionne des jeux dans l'onglet Jeux pour lancer la résolution.
        </p>
      )}

      {selectedGameIds.length > 0 && effectiveGameIds.length === 0 && hasSources && (
        <p className={css({ fontSize: 'sm', color: 'status.success.text' })}>
          Tous les jeux sélectionnés sont déjà présents sur le disque — rien à télécharger.
        </p>
      )}

      {noFolder && (
        <p className={css({ fontSize: 'sm', color: 'status.warning.text' })}>
          Aucun dossier défini pour ce système : les téléchargements seront refusés. Choisis-le dans
          le bandeau en haut de page.
        </p>
      )}

      {error && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {error}
        </p>
      )}

      {stale && (
        <p className={css({ fontSize: 'sm', color: 'status.warning.text', mb: '3' })}>
          Les sources ont changé depuis cette résolution : relance la recherche avant de
          télécharger.
        </p>
      )}

      {result && (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <div className={css({ display: 'flex', gap: '3' })}>
            <Chip label="Complets" count={summary?.complete ?? 0} color="green" />
            <Chip label="Partiels" count={summary?.partial ?? 0} color="gray" />
            <Chip label="Introuvables" count={summary?.notFound ?? 0} color="gray" />
          </div>

          {downloadableCount > 0 && (
            <div className={css({ display: 'flex', gap: '3', alignItems: 'center' })}>
              <Button
                onClick={() => void handleDownload()}
                disabled={queuing || stale || (downloadTarget === 'server' && !destinationDir)}
                className={css({ flexShrink: 0 })}
              >
                {queuing
                  ? 'Lancement…'
                  : `Télécharger (${downloadableCount} fichier${downloadableCount !== 1 ? 's' : ''})`}
              </Button>
              <span
                className={css({
                  fontSize: 'sm',
                  color: 'fg.dataFaint',
                  fontFamily: 'mono',
                  minW: 0,
                  truncate: true,
                })}
              >
                {downloadTarget === 'browser'
                  ? '→ Mon navigateur'
                  : destinationDir && `→ ${displayPath(destinationDir, romsRoot)}`}
              </span>
            </div>
          )}

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
            {result.results.map((r) => (
              <ResolvedGameRow
                key={r.gameId}
                game={r}
                selectedSourceIndex={selectedSourceIndex}
                onSelectSource={(gameId, romName, index) =>
                  setSelectedSourceIndex((prev) => {
                    const next = new Map(prev);
                    next.set(`${gameId}/${romName}`, index);
                    return next;
                  })
                }
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
