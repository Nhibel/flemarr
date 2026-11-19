import { useState } from 'react';
import { css, cx } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { cancelDownloadItem } from '@/lib/api.js';
import { formatSize } from '@/lib/format.js';
import type { GameStatus, GameStatusKind } from './game-status.js';
import { formatRate } from './transfer-rate.js';
import type { RetryMode } from './retry.js';

const KIND_LABELS: Record<GameStatusKind, string> = {
  queued: 'En attente',
  downloading: 'Téléchargement',
  extracting: 'Extraction…',
  converting: 'Compression en .chd…',
  done: 'Vérifié et rangé',
  failed: 'Échec',
};

// Whole static classes rather than a colour picked at runtime: Panda
// extracts CSS at build time, so every value must be visible in the source.
const subtleClass = css({ color: 'fg.subtle' });
const KIND_COLOR_CLASS: Record<GameStatusKind, string> = {
  queued: subtleClass,
  downloading: subtleClass,
  extracting: subtleClass,
  converting: css({ color: 'status.warning.text' }),
  done: css({ color: 'status.success.text' }),
  failed: css({ color: 'status.danger.text' }),
};

interface Props {
  jobId: string;
  game: GameStatus;
  target: 'server' | 'browser';
  rate: number | undefined;
  running: boolean;
  onRetry: (gameId: string, mode: RetryMode) => void;
}

/**
 * One game, one row, one state — the shape the design comps use. The files
 * behind it are summarised as a count rather than listed: a three-disc game
 * used to take three rows, and its conversion a fourth somewhere else.
 */
export function DownloadGameRow({ jobId, game, target, rate, running, onRetry }: Props) {
  const [cancelling, setCancelling] = useState(false);

  const isSentToBrowser = game.kind === 'done' && target === 'browser';
  const label = isSentToBrowser ? 'Envoyé à ton navigateur' : KIND_LABELS[game.kind];
  const isFinished = game.kind === 'done' || game.kind === 'failed';
  const canCancel = running && !isFinished;
  const showProgressBar = game.kind === 'downloading' || game.kind === 'extracting';

  const handleCancel = async () => {
    setCancelling(true);
    try {
      // Cancels every file of the game — the user asked for the game, so
      // that is the thing they can take back.
      await Promise.all(
        game.files.map((romName) => cancelDownloadItem(jobId, game.gameId, romName)),
      );
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className={css({ py: '2.5' })}>
      <div className={css({ display: 'flex', alignItems: 'baseline', gap: '3' })}>
        <span className={css({ flex: '1', minW: '0', fontSize: 'sm', truncate: true })}>
          {game.label}
          {game.fileCount > 1 && (
            <span className={css({ fontFamily: 'mono', fontSize: '2xs', color: 'fg.dataFaint' })}>
              {' '}
              · {game.fileCount} fichiers
            </span>
          )}
        </span>

        <span
          className={cx(
            css({ fontSize: 'xs', flexShrink: '0', fontWeight: 'medium' }),
            KIND_COLOR_CLASS[game.kind],
          )}
        >
          {label}
          {game.kind === 'downloading' && <DownloadProgress game={game} rate={rate} />}
        </span>

        {canCancel && (
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={cancelling}
            className={css({
              flexShrink: '0',
              fontSize: 'xs',
              color: 'fg.faint',
              cursor: 'pointer',
              bg: 'transparent',
              border: 'none',
              _hover: { color: 'status.danger.text' },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            {cancelling ? 'Annulation…' : 'Annuler'}
          </button>
        )}
      </div>

      {game.kind === 'failed' && <FailureActions game={game} onRetry={onRetry} />}

      {showProgressBar && <ProgressBar progress={game.progress} />}
    </div>
  );
}

/** "42 %" or the bytes so far when the total is unknown, then the rate. */
function DownloadProgress({ game, rate }: { game: GameStatus; rate: number | undefined }) {
  const hasKnownTotal = game.progress >= 0;
  return (
    <>
      <span className={css({ fontFamily: 'mono' })}>
        {' '}
        {hasKnownTotal ? `${game.progress} %` : formatSize(game.bytesDownloaded)}
      </span>
      {rate !== undefined && (
        <span className={css({ fontFamily: 'mono', color: 'fg.dataFaint' })}>
          {' '}
          · {formatRate(rate)}
        </span>
      )}
    </>
  );
}

function FailureActions({
  game,
  onRetry,
}: {
  game: GameStatus;
  onRetry: (gameId: string, mode: RetryMode) => void;
}) {
  return (
    <div
      className={css({
        mt: '1.5',
        display: 'flex',
        alignItems: 'center',
        gap: '2',
        flexWrap: 'wrap',
      })}
    >
      <span className={css({ flex: '1', minW: '0', fontSize: 'xs', color: 'fg.muted' })}>
        {game.reason ?? 'Raison inconnue'}
      </span>
      {/* A failed conversion is not a failed download: the bytes are on
          disk, so re-downloading them is not the fix and re-resolving a
          source would be beside the point. */}
      {!game.convertFailed && (
        <>
          <Button variant="secondary" size="sm" onClick={() => onRetry(game.gameId, 'same')}>
            Réessayer
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onRetry(game.gameId, 'elsewhere')}>
            Chercher ailleurs
          </Button>
        </>
      )}
    </div>
  );
}

/** A determinate bar, or an indeterminate slide when the total is unknown. */
function ProgressBar({ progress }: { progress: number }) {
  const hasKnownTotal = progress >= 0;
  return (
    <div
      className={css({
        mt: '1.5',
        h: '4px',
        bg: 'bg.muted',
        borderRadius: '2px',
        overflow: 'hidden',
      })}
    >
      <div
        className={css({
          h: 'full',
          bg: 'accent.solid',
          borderRadius: '2px',
          transition: 'width 0.2s',
        })}
        style={
          hasKnownTotal
            ? { width: `${progress}%` }
            : { width: '25%', animation: 'indeterminate-slide 1.2s linear infinite' }
        }
      />
    </div>
  );
}
