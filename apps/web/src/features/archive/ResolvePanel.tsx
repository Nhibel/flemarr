import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { fetchSources, resolveGames, startDownload, getSettings } from '@/lib/api.js';
import type { ResolveResponse } from '@/lib/api.js';
import type { DownloadSource } from '@shared/download.js';
import type { ResolvedSource } from '@shared/archive.js';
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
  // Layout included: correcting a wrongly-detected layout changes which URLs
  // resolve, not just which sources exist.
  const sourceKey = (sourcesData?.sources ?? [])
    .map((src) => `${src.identifier}:${src.layout}`)
    .sort()
    .join('|');
  const result = resolved?.result ?? null;
  const stale = resolved !== null && resolved.sourceKey !== sourceKey;
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

  // A ResolvedSource flattens straight into one ordered candidate — see
  // downloadSourceSchema. innerPath/archiveFormat are only ever set on the
  // archive-container kind; omitted otherwise.
  const toDownloadSource = (s: {
    downloadUrl: string;
    extractFromZip: boolean;
    innerPath?: string;
    archiveFormat?: 'zip' | '7z' | 'rar';
  }): DownloadSource => ({
    url: s.downloadUrl,
    extractFromZip: s.extractFromZip,
    innerPath: s.innerPath,
    archiveFormat: s.archiveFormat,
  });

  // One download item per resolved ROM — multi-disc games queue every disc.
  // The preferred source (the user's pick, via the per-rom picker below, or
  // the first match by default) is tried first, then its own fallback (the
  // archive-container fast path's slower-but-already-working alternative,
  // if it has one), then other configured sources of the same container
  // kind as further network-failure fallbacks.
  const buildItems = useCallback(() => {
    if (!result) return [];
    return result.results.flatMap((r) =>
      r.roms
        .filter((rom) => rom.sources.length > 0)
        .map((rom) => {
          const chosenIndex = selectedSourceIndex.get(`${r.gameId}/${rom.romName}`) ?? 0;
          const chosen: ResolvedSource = rom.sources[chosenIndex] ?? rom.sources[0]!;

          const sources: DownloadSource[] = [toDownloadSource(chosen)];
          if (chosen.fallback) {
            sources.push({
              url: chosen.fallback.downloadUrl,
              extractFromZip: chosen.fallback.extractFromZip,
            });
          }
          for (const s of rom.sources) {
            if (s === chosen || s.container !== chosen.container) continue;
            sources.push(toDownloadSource(s));
          }

          return {
            gameId: r.gameId,
            romName: rom.romName,
            expectedCrc: rom.expectedCrc,
            sources,
          };
        }),
    );
  }, [result, selectedSourceIndex]);

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
          ? { jobId, items, target: 'server', destinationDir }
          : { jobId, items, target: 'browser' },
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

      {stale && (
        <p className={css({ fontSize: 'sm', color: 'status.warning.text', mb: '3' })}>
          Les sources ont changé depuis cette résolution : relancez la recherche avant de
          télécharger.
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
