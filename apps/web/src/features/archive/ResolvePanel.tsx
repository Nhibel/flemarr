import { css } from '@/styled-system/css';
import type { QueuedDownload } from '@/features/downloader/job-state.js';
import { Button } from '@/components/Button.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import { ExcludeOwnedToggle } from './ExcludeOwnedToggle.js';
import { ResolvedGameRow } from './ResolvedGameRow.js';
import { ResolveNotices } from './ResolveNotices.js';
import { ResolveSummary } from './ResolveSummary.js';
import { destinationLabel } from './destination-label.js';
import { useResolvePanel } from './use-resolve-panel.js';
import { plural } from '@/lib/plural.js';

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

  const toResolveCount = panel.effectiveGameIds.length;
  const resolveLabel = `Chercher les sources (${toResolveCount} ${plural(toResolveCount, 'jeu', 'jeux')})`;

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
          {panel.resolving ? 'Recherche…' : resolveLabel}
        </Button>
      </div>

      {missingGameIds !== null && (
        <ExcludeOwnedToggle
          checked={panel.excludeOwned}
          onChange={panel.setExcludeOwned}
          ownedCount={selectedGameIds.length - missingGameIds.length}
          selectedCount={selectedGameIds.length}
        />
      )}

      <ResolveNotices
        hasSources={panel.hasSources}
        selectedCount={selectedGameIds.length}
        toResolveCount={toResolveCount}
        hasNoFolder={panel.hasNoFolder}
        isStale={panel.isStale}
        error={panel.error}
      />

      {panel.result && panel.summary && (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <ResolveSummary
            summary={panel.summary}
            destination={destinationLabel(panel.downloadTarget, panel.destinationDir, romsRoot)}
            queuing={panel.queuing}
            canDownload={panel.canDownload}
            onDownload={() => void panel.download()}
          />

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
            {panel.result.results.map((game) => (
              <ResolvedGameRow
                key={game.gameId}
                game={game}
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
