import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { Chip } from '@/components/Chip.js';
import type { ResolveSummary as Summary } from './resolve-summary.js';
import { plural } from '@/lib/plural.js';

/**
 * The resolve outcome at a glance: how many games are complete, partial or
 * not found, and the download button with where the files will land. The
 * button only shows when at least one file was found.
 */
export function ResolveSummary({
  summary,
  destination,
  queuing,
  canDownload,
  onDownload,
}: {
  summary: Summary;
  /** From destinationLabel(); null shows nothing next to the button. */
  destination: string | null;
  queuing: boolean;
  canDownload: boolean;
  onDownload: () => void;
}) {
  const fileCount = summary.downloadableCount;
  const hasDownloadable = fileCount > 0;
  const downloadLabel = `Télécharger (${fileCount} ${plural(fileCount, 'fichier')})`;

  return (
    <>
      <div className={css({ display: 'flex', gap: '3' })}>
        <Chip label="Complets" count={summary.complete} color="green" />
        <Chip label="Partiels" count={summary.partial} color="gray" />
        <Chip label="Introuvables" count={summary.notFound} color="gray" />
      </div>

      {hasDownloadable && (
        <div className={css({ display: 'flex', gap: '3', alignItems: 'center' })}>
          <Button onClick={onDownload} disabled={!canDownload} className={css({ flexShrink: 0 })}>
            {queuing ? 'Lancement…' : downloadLabel}
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
            {destination}
          </span>
        </div>
      )}
    </>
  );
}
