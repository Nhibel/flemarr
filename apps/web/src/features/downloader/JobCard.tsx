import { useState } from 'react';
import { css, cx } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { Card } from '@/components/Card.js';
import { cancelDownload } from '@/lib/api.js';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import { DownloadGameRow } from './DownloadGameRow.js';
import { groupByGame, summarizeJob } from './game-status.js';
import { progressLine, statusLabel } from './job-labels.js';
import type { JobState, JobStatus } from './job-state.js';
import type { RetryMode } from './retry.js';
import { computeEta, formatEta } from './transfer-rate.js';
import { useTransferRates } from './use-transfer-rates.js';

// Whole static classes rather than a colour picked at runtime: Panda
// extracts CSS at build time, so every value must be visible in the source.
const STATUS_COLOR_CLASS: Record<JobStatus, string> = {
  running: css({ color: 'accent.text' }),
  done: css({ color: 'status.success.text' }),
  cancelled: css({ color: 'fg.subtle' }),
  error: css({ color: 'status.danger.text' }),
};

interface Props {
  state: JobState;
  onRetry: (gameId: string, mode: RetryMode) => void;
}

/** One download job: where it goes, how far it is, and one row per game. */
export function JobCard({ state, onRetry }: Props) {
  const romsRoot = useRomsRoot();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const games = groupByGame(state.items, state.gameConversions);
  const summary = summarizeJob(games);
  const { rate: jobRate, rates } = useTransferRates(state.jobId, state.items);
  const eta = computeEta(summary.remainingBytes, jobRate);
  const isRunning = state.status === 'running';
  const destination =
    state.target === 'browser'
      ? 'Mon navigateur'
      : displayPath(state.destinationDir ?? '', romsRoot);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelDownload(state.jobId);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Annulation impossible');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
      <Card className={css({ overflow: 'hidden' })}>
        {/* Job header */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '3',
            px: '4',
            py: '3',
            bg: 'bg.muted',
          })}
        >
          <div className={css({ flex: 1, minW: 0 })}>
            <p
              className={css({
                fontSize: 'xs',
                color: 'fg.dataFaint',
                fontFamily: 'mono',
                truncate: true,
              })}
            >
              → {destination}
            </p>
            <p
              className={cx(
                css({ fontSize: 'sm', fontWeight: 'medium' }),
                STATUS_COLOR_CLASS[state.status],
              )}
            >
              {statusLabel(state.status, summary)}
            </p>
          </div>
          {isRunning && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleCancel()}
              disabled={cancelling}
            >
              {cancelling ? 'Annulation…' : 'Annuler'}
            </Button>
          )}
        </div>

        {cancelError && (
          <p
            role="alert"
            className={css({ px: '4', pt: '3', fontSize: 'xs', color: 'status.danger.text' })}
          >
            {cancelError}
          </p>
        )}

        {/* What the job is doing, in one line, as the comps show it. Counted
            per game rather than per file: a three-disc game is one thing the
            user asked for, not three. */}
        <p
          className={css({
            px: '4',
            pt: '3',
            fontSize: 'xs',
            color: 'fg.data',
            fontFamily: 'mono',
          })}
        >
          {progressLine(summary)}
          {eta !== undefined && ` — ${formatEta(eta)}`}
        </p>

        {/* One row per game. The conversion step used to be a separate list
            below, which split a single game across two places on screen. */}
        <div className={css({ display: 'flex', flexDirection: 'column', px: '4', pb: '3' })}>
          {games.map((game) => (
            <DownloadGameRow
              key={game.gameId}
              jobId={state.jobId}
              game={game}
              target={state.target}
              rate={rates.get(game.gameId)}
              running={isRunning}
              onRetry={onRetry}
            />
          ))}
        </div>
      </Card>
      <JobNote target={state.target} hasConversion={state.gameConversions.size > 0} />
    </div>
  );
}

/**
 * The note under the card, not inside it. Both explanations used to be the
 * card's last child with no horizontal padding of their own, so on a 16px
 * radius the first and last characters of the closing line disappeared into
 * the bottom corners (Camille, 2026-11-18). They are about downloading in
 * general rather than about THIS job, so under the card is also where they
 * belong.
 */
function JobNote({
  target,
  hasConversion,
}: {
  target: 'server' | 'browser';
  hasConversion: boolean;
}) {
  if (target === 'browser') {
    return (
      <p className={css({ fontSize: 'xs', color: 'status.info.text', lineHeight: '1.5' })}>
        Vérifiés côté serveur <strong>avant</strong> l&apos;envoi, les fichiers arrivent dans les
        téléchargements de ton navigateur : rom-curator ne les touche plus ensuite.
      </p>
    );
  }
  if (hasConversion) {
    return (
      <p className={css({ fontSize: 'xs', color: 'fg.subtle', lineHeight: '1.5' })}>
        Les jeux sur disque sont regroupés en un seul fichier <code>.chd</code>, plus compact et lu
        par la plupart des émulateurs. Les fichiers d&apos;origine ne sont supprimés qu&apos;une
        fois la copie vérifiée.
      </p>
    );
  }
  return null;
}
