import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { fetchSources, resolveGames, startDownload, getSettings } from '@/lib/api.js';
import type { ResolveResponse } from '@/lib/api.js';
import type { QueuedDownload } from '@/features/downloader/DownloadManager.js';
import { ResolvedGameRow } from './ResolvedGameRow.js';
import { Chip } from '@/components/Chip.js';
import { PathInput } from '@/components/PathInput.js';

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
  const [destinationDir, setDestinationDir] = useState('');
  const [destTouched, setDestTouched] = useState(false);
  const [excludeOwned, setExcludeOwned] = useState(true);
  const [queuing, setQueuing] = useState(false);

  const { data: sourcesData } = useQuery({
    queryKey: ['archive-sources', system],
    queryFn: () => fetchSources(system),
  });

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  // Downloads are confined to settings.systemPaths — prefill with the path
  // configured for this system (or the only one configured) instead of
  // letting the user type something the server will reject.
  const paths = settings?.systemPaths ?? {};
  const defaultDest =
    paths[system] ?? (Object.values(paths).length === 1 ? Object.values(paths)[0] : undefined);
  useEffect(() => {
    if (defaultDest !== undefined && !destTouched) setDestinationDir(defaultDest);
  }, [defaultDest, destTouched]);

  const hasSources = (sourcesData?.sources.length ?? 0) > 0;
  const noPathsConfigured = settings !== undefined && Object.keys(paths).length === 0;

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

  const handleDownload = useCallback(async () => {
    if (!result || !destinationDir.trim()) return;
    // One download item per resolved ROM — multi-disc games queue every disc.
    // The preferred (first) source decides the extraction mode; fallback URLs
    // are limited to sources of the same kind so extraction stays consistent.
    const items = result.results.flatMap((r) =>
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
    if (items.length === 0) return;
    setQueuing(true);
    try {
      const jobId = await startDownload({ datId, items, destinationDir: destinationDir.trim() });
      onQueueDownload({ jobId, items, destinationDir: destinationDir.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur au lancement');
    } finally {
      setQueuing(false);
    }
  }, [result, datId, destinationDir, onQueueDownload]);

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
        <button
          onClick={() => void handleResolve()}
          disabled={resolving || effectiveGameIds.length === 0 || !hasSources}
          className={css({
            px: '3',
            py: '1.5',
            fontSize: 'sm',
            fontWeight: 'medium',
            bg: 'green.500',
            color: 'white',
            borderRadius: 'md',
            cursor: 'pointer',
            _hover: { bg: 'green.600' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {resolving
            ? 'Recherche…'
            : `Chercher les sources (${effectiveGameIds.length} jeu${effectiveGameIds.length !== 1 ? 'x' : ''})`}
        </button>
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
        <p className={css({ fontSize: 'sm', color: 'amber.600' })}>
          Ajoutez au moins une source ci-dessus avant de lancer la résolution.
        </p>
      )}

      {selectedGameIds.length === 0 && hasSources && (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Sélectionnez des jeux dans l'onglet Games pour lancer la résolution.
        </p>
      )}

      {selectedGameIds.length > 0 && effectiveGameIds.length === 0 && hasSources && (
        <p className={css({ fontSize: 'sm', color: 'green.600' })}>
          Tous les jeux sélectionnés sont déjà présents sur le disque — rien à télécharger.
        </p>
      )}

      {noPathsConfigured && (
        <p className={css({ fontSize: 'sm', color: 'amber.600' })}>
          Aucun dossier système configuré : les téléchargements seront refusés. Ajoutez un dossier
          dans Paramètres.
        </p>
      )}

      {error && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'red.600' })}>
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
            <div className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
              <PathInput
                value={destinationDir}
                onChange={(v) => {
                  setDestTouched(true);
                  setDestinationDir(v);
                }}
                placeholder="Dossier de destination"
                inputClassName={css({
                  px: '2.5',
                  py: '1.5',
                  fontSize: 'sm',
                  border: '1px solid',
                  borderColor: 'bd.strong',
                  borderRadius: 'md',
                  bg: 'bg.page',
                  outline: 'none',
                  _focusVisible: { borderColor: 'blue.400' },
                })}
              />
              <button
                onClick={() => void handleDownload()}
                disabled={queuing || !destinationDir.trim()}
                className={css({
                  px: '3',
                  py: '1.5',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  flexShrink: 0,
                  bg: 'green.500',
                  color: 'white',
                  borderRadius: 'md',
                  cursor: 'pointer',
                  _hover: { bg: 'green.600' },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                {queuing
                  ? 'Lancement…'
                  : `Télécharger (${downloadableCount} fichier${downloadableCount !== 1 ? 's' : ''})`}
              </button>
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
