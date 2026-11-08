import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { fetchSources, resolveGames, startDownload, getSettings } from '@/lib/api.js';
import type { ResolveResponse } from '@/lib/api.js';
import type { QueuedDownload } from '@/features/downloader/DownloadManager.js';
import { ResolvedGameRow } from './ResolvedGameRow.js';
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
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excludeOwned, setExcludeOwned] = useState(true);
  const [queuing, setQueuing] = useState(false);

  const { data: sourcesData } = useQuery({
    queryKey: ['archive-sources', system],
    queryFn: () => fetchSources(system),
  });

  // Picked once in Settings for the whole session — no reason to mix
  // server and browser destinations across downloads (see DownloadTargetSection).
  const { data: settingsData } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const downloadTarget = settingsData?.downloadTarget ?? 'server';

  // The system's folder, chosen once in SystemFolderBar — the server
  // download's actual destination, or (in browser mode) just the folder the
  // scanner checks once the files are moved there by hand.
  const { folder: destinationDir, loaded: settingsLoaded } = useSystemFolder(system);
  const romsRoot = useRomsRoot();

  const hasSources = (sourcesData?.sources.length ?? 0) > 0;
  const noFolder = downloadTarget === 'server' && settingsLoaded && destinationDir === '';

  const effectiveGameIds =
    excludeOwned && missingGameIds !== null ? missingGameIds : selectedGameIds;

  const downloadableCount =
    result?.results.reduce(
      (n, r) => n + r.roms.filter((rom) => rom.sources.length > 0).length,
      0,
    ) ?? 0;

  const handleResolve = useCallback(async () => {
    if (effectiveGameIds.length === 0) return;
    setResolving(true);
    setError(null);
    try {
      const res = await resolveGames(datId, effectiveGameIds);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setResolving(false);
    }
  }, [datId, effectiveGameIds]);

  // One download item per resolved ROM — multi-disc games queue every disc.
  // The preferred (first) source decides the extraction mode; fallback URLs
  // are limited to sources of the same kind so extraction stays consistent.
  const buildItems = useCallback(() => {
    if (!result) return [];
    return result.results.flatMap((r) =>
      r.roms
        .filter((rom) => rom.sources.length > 0)
        .map((rom) => {
          const extractFromZip = rom.sources[0]!.container === 'zip-view';
          const urls = rom.sources
            .filter((s) => (s.container === 'zip-view') === extractFromZip)
            .map((s) => s.downloadUrl);
          return {
            gameId: r.gameId,
            romName: rom.romName,
            expectedCrc: rom.expectedCrc,
            downloadUrls: urls,
            extractFromZip,
          };
        }),
    );
  }, [result]);

  const handleDownload = useCallback(async () => {
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
          ? { jobId, items, target: 'server', destinationDir }
          : { jobId, items, target: 'browser' },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur au lancement');
    } finally {
      setQueuing(false);
    }
  }, [buildItems, datId, destinationDir, downloadTarget, onQueueDownload]);

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
          Ajoutez au moins une source ci-dessus avant de lancer la résolution.
        </p>
      )}

      {selectedGameIds.length === 0 && hasSources && (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Sélectionnez des jeux dans l'onglet Games pour lancer la résolution.
        </p>
      )}

      {selectedGameIds.length > 0 && effectiveGameIds.length === 0 && hasSources && (
        <p className={css({ fontSize: 'sm', color: 'status.success.text' })}>
          Tous les jeux sélectionnés sont déjà présents sur le disque — rien à télécharger.
        </p>
      )}

      {noFolder && (
        <p className={css({ fontSize: 'sm', color: 'status.warning.text' })}>
          Aucun dossier défini pour ce système : les téléchargements seront refusés. Choisissez-le
          dans le bandeau en haut de page.
        </p>
      )}

      {error && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {error}
        </p>
      )}

      {result && (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <div className={css({ display: 'flex', gap: '3' })}>
            <Chip
              label="Complets"
              count={
                result.results.filter(
                  (r) => r.roms.length > 0 && r.roms.every((rom) => rom.sources.length > 0),
                ).length
              }
              color="green"
            />
            <Chip
              label="Partiels"
              count={
                result.results.filter(
                  (r) =>
                    r.roms.some((rom) => rom.sources.length > 0) &&
                    r.roms.some((rom) => rom.sources.length === 0),
                ).length
              }
              color="gray"
            />
            <Chip
              label="Introuvables"
              count={
                result.results.filter((r) => r.roms.every((rom) => rom.sources.length === 0)).length
              }
              color="gray"
            />
          </div>

          {result.results.some((r) => r.roms.some((rom) => rom.sources.length > 0)) && (
            <div className={css({ display: 'flex', gap: '3', alignItems: 'center' })}>
              <Button
                onClick={() => void handleDownload()}
                disabled={queuing || (downloadTarget === 'server' && !destinationDir)}
                className={css({ flexShrink: 0 })}
              >
                {queuing
                  ? 'Lancement…'
                  : `Télécharger (${downloadableCount} fichier${downloadableCount !== 1 ? 's' : ''})`}
              </Button>
              <span
                className={css({
                  fontSize: 'sm',
                  color: 'fg.faint',
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
              <ResolvedGameRow key={r.gameId} game={r} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
