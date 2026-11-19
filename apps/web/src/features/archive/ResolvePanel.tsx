import { css } from '@/styled-system/css';
import type { QueuedDownload } from '@/features/downloader/job-state.js';
import { ResolvedGameRow } from './ResolvedGameRow.js';
import { useResolvePanel } from './use-resolve-panel.js';
import { Button } from '@/components/Button.js';
import { Chip } from '@/components/Chip.js';
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
  const panel = useResolvePanel({
    datId,
    system,
    selectedGameIds,
    missingGameIds,
    onQueueDownload,
  });
  const romsRoot = useRomsRoot();
  const { effectiveGameIds, result, summary, downloadTarget, destinationDir } = panel;
  const downloadableCount = summary?.downloadableCount ?? 0;

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
        <Button onClick={() => void panel.resolve()} disabled={!panel.canResolve}>
          {panel.resolving
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
            checked={panel.excludeOwned}
            onChange={(e) => panel.setExcludeOwned(e.target.checked)}
          />
          Exclure les jeux déjà possédés d'après le dernier scan (
          {selectedGameIds.length - missingGameIds.length} sur {selectedGameIds.length} possédé
          {selectedGameIds.length - missingGameIds.length !== 1 ? 's' : ''})
        </label>
      )}

      {!panel.hasSources && (
        <p className={css({ fontSize: 'sm', color: 'status.warning.text' })}>
          Ajoute au moins une source ci-dessus avant de lancer la résolution.
        </p>
      )}

      {selectedGameIds.length === 0 && panel.hasSources && (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Sélectionne des jeux dans l'onglet Jeux pour lancer la résolution.
        </p>
      )}

      {selectedGameIds.length > 0 && effectiveGameIds.length === 0 && panel.hasSources && (
        <p className={css({ fontSize: 'sm', color: 'status.success.text' })}>
          Tous les jeux sélectionnés sont déjà présents sur le disque — rien à télécharger.
        </p>
      )}

      {panel.hasNoFolder && (
        <p className={css({ fontSize: 'sm', color: 'status.warning.text' })}>
          Aucun dossier défini pour ce système : les téléchargements seront refusés. Choisis-le dans
          le bandeau en haut de page.
        </p>
      )}

      {panel.error && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {panel.error}
        </p>
      )}

      {panel.isStale && (
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
                onClick={() => void panel.download()}
                disabled={!panel.canDownload}
                className={css({ flexShrink: 0 })}
              >
                {panel.queuing
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
                selectedSourceIndex={panel.selectedSourceIndex}
                onSelectSource={panel.selectSource}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
