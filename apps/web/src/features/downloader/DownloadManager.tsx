import { useState, useEffect, useRef, useCallback } from 'react';
import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { formatSize } from '@/lib/format.js';
import { Card } from '@/components/Card.js';
import {
  openDownloadEvents,
  cancelDownload,
  cancelDownloadItem,
  downloadEventSchema,
} from '@/lib/api.js';
import type { DownloadEvent } from '@/lib/api.js';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import { fullyDownloadedGameIds } from './completed-games.js';
import { groupByGame, summarizeJob } from './game-status.js';
import type { GameStatus, GameStatusKind, ItemStatus } from './game-status.js';
import { computeEta, formatEta, formatRate } from './transfer-rate.js';
import { useTransferRates } from './use-transfer-rates.js';
import { resolveGames, startDownload } from '@/lib/api.js';
import { buildDownloadItems } from '@/features/archive/build-items.js';
import type { DownloadItem } from '@shared/download.js';

/**
 * 'same' retries the sources the game already had — the usual case, since
 * most failures are a collection being briefly unreachable. 'elsewhere'
 * re-resolves against every configured source, for when that collection is
 * actually gone.
 */
export type RetryMode = 'same' | 'elsewhere';

export interface QueuedDownload {
  jobId: string;
  datId: string;
  /**
   * The full items, sources included — which is what ResolvePanel already
   * passed; only this type was narrower. Keeping them is what lets a failed
   * game be retried against the same source without resolving again.
   */
  items: DownloadItem[];
  target: 'server' | 'browser';
  destinationDir?: string;
}

interface ItemState {
  gameId: string;
  romName: string;
  status: ItemStatus;
  // -1 means "unknown total" (archive.org's zip-view extraction streams
  // chunked, with no Content-Length — every restricted zip-collection
  // source hits this, not just an occasional one) — rendered as bytes
  // downloaded and an indeterminate bar instead of a percentage that would
  // otherwise read as permanently stuck at 0.
  progress: number; // 0-100, or -1
  bytesDownloaded: number;
  /** -1 when unknown, 0 before the first progress event. */
  totalBytes: number;
  failReason?: string;
}

interface GameConversionState {
  status: 'converting' | 'converted' | 'failed';
  reason?: string;
}

interface JobState {
  jobId: string;
  target: 'server' | 'browser';
  destinationDir?: string;
  status: 'running' | 'done' | 'cancelled' | 'error';
  items: ItemState[];
  // Keyed by gameId, not romName — CHD conversion is a whole-game step
  // (every rom of a disc folds into one .chd), not a per-file one.
  gameConversions: Map<string, GameConversionState>;
}

/** Triggers the browser's native save for an already-validated file. */
function triggerBrowserSave(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

interface Props {
  jobs: QueuedDownload[];
  onAllDone?: () => void;
  /**
   * Reports games whose every ROM landed successfully, as soon as each one
   * completes. The parent owns the selection and unchecks them, so what stays
   * checked is exactly what failed or never ran.
   */
  onGamesDownloaded?: (gameIds: string[]) => void;
  /**
   * Reports which jobIds the "clear finished" button wants removed — only
   * ever jobs whose status isn't 'running'. The parent owns `jobs`, so it's
   * the one that actually drops them.
   */
  onClearCompleted?: (jobIds: string[]) => void;
  /**
   * A retry is a new job, so it has to reach the same place a fresh
   * download does: the parent owns `jobs`, and a job it never heard about
   * would never be rendered.
   */
  onQueueRetry?: (job: QueuedDownload) => void;
}

export function DownloadManager({
  jobs,
  onAllDone,
  onGamesDownloaded,
  onClearCompleted,
  onQueueRetry,
}: Props) {
  const [jobStates, setJobStates] = useState<Map<string, JobState>>(new Map());
  const [retryError, setRetryError] = useState<string | null>(null);

  const initJob = useCallback((queued: QueuedDownload) => {
    setJobStates((prev) => {
      if (prev.has(queued.jobId)) return prev;
      const next = new Map(prev);
      next.set(queued.jobId, {
        jobId: queued.jobId,
        target: queued.target,
        destinationDir: queued.destinationDir,
        status: 'running',
        items: queued.items.map((i) => ({
          ...i,
          status: 'queued',
          progress: 0,
          bytesDownloaded: 0,
          totalBytes: 0,
        })),
        gameConversions: new Map(),
      });
      return next;
    });
  }, []);

  // Initialise new jobs as they arrive
  useEffect(() => {
    jobs.forEach(initJob);
  }, [jobs, initJob]);

  const applyEvent = useCallback((jobId: string, event: DownloadEvent) => {
    setJobStates((prev) => {
      const job = prev.get(jobId);
      if (!job) return prev;
      const next = new Map(prev);
      const items = [...job.items];

      // Items are identified by gameId + romName: a multi-disc game queues
      // one item per disc under the same gameId.
      const findItem = (gameId: string, romName: string) =>
        items.findIndex((i) => i.gameId === gameId && i.romName === romName);

      if (event.type === 'progress') {
        const idx = findItem(event.gameId, event.romName);
        if (idx !== -1) {
          items[idx] = {
            ...items[idx]!,
            status: 'downloading',
            progress:
              event.totalBytes > 0
                ? Math.round((event.bytesDownloaded / event.totalBytes) * 100)
                : -1,
            bytesDownloaded: event.bytesDownloaded,
            // Kept so the job can say what is left to transfer. -1 when the
            // source streams without a Content-Length, which is every
            // restricted re-zipped collection — summarizeJob then withholds
            // the estimate instead of inventing one.
            totalBytes: event.totalBytes > 0 ? event.totalBytes : -1,
          };
        }
      } else if (event.type === 'file-extracting') {
        const idx = findItem(event.gameId, event.romName);
        if (idx !== -1) items[idx] = { ...items[idx]!, status: 'extracting' };
      } else if (event.type === 'file-done' || event.type === 'file-ready') {
        const idx = findItem(event.gameId, event.romName);
        if (idx !== -1) items[idx] = { ...items[idx]!, status: 'done', progress: 100 };
      } else if (event.type === 'file-failed') {
        const idx = findItem(event.gameId, event.romName);
        if (idx !== -1) items[idx] = { ...items[idx]!, status: 'failed', failReason: event.reason };
      } else if (event.type === 'file-cancelled') {
        // Dropped outright, not marked — a cancelled item isn't a failure
        // to show and investigate, it's "never mind, don't want this one."
        const idx = findItem(event.gameId, event.romName);
        if (idx !== -1) items.splice(idx, 1);
      } else if (event.type === 'game-converting') {
        const gameConversions = new Map(job.gameConversions);
        gameConversions.set(event.gameId, { status: 'converting' });
        next.set(jobId, { ...job, items, gameConversions });
        return next;
      } else if (event.type === 'game-converted') {
        const gameConversions = new Map(job.gameConversions);
        gameConversions.set(event.gameId, { status: 'converted' });
        next.set(jobId, { ...job, items, gameConversions });
        return next;
      } else if (event.type === 'game-convert-failed') {
        const gameConversions = new Map(job.gameConversions);
        gameConversions.set(event.gameId, { status: 'failed', reason: event.reason });
        next.set(jobId, { ...job, items, gameConversions });
        return next;
      } else if (event.type === 'complete') {
        next.set(jobId, { ...job, items, status: 'done' });
        return next;
      } else if (event.type === 'cancelled') {
        next.set(jobId, { ...job, items, status: 'cancelled' });
        return next;
      } else if (event.type === 'error') {
        next.set(jobId, { ...job, items, status: 'error' });
        return next;
      }

      next.set(jobId, { ...job, items });
      return next;
    });
  }, []);

  // Open SSE streams for running jobs
  const esRefs = useRef<Map<string, EventSource>>(new Map());

  useEffect(() => {
    jobs.forEach((queued) => {
      if (esRefs.current.has(queued.jobId)) return;

      const es = openDownloadEvents(queued.jobId);
      esRefs.current.set(queued.jobId, es);

      es.onmessage = (e) => {
        const parsed = downloadEventSchema.safeParse(JSON.parse(e.data as string) as unknown);
        if (!parsed.success) return;
        if (parsed.data.type === 'file-ready') {
          triggerBrowserSave(parsed.data.downloadUrl, parsed.data.romName);
        }
        applyEvent(queued.jobId, parsed.data);
        if (
          parsed.data.type === 'complete' ||
          parsed.data.type === 'cancelled' ||
          parsed.data.type === 'error'
        ) {
          es.close();
        }
      };

      // Connection lost — the job may still run server-side, but we can't
      // observe it anymore; report an error instead of pretending it finished.
      es.onerror = () => {
        applyEvent(queued.jobId, { type: 'error', message: 'Connexion au flux perdue' });
        es.close();
      };
    });

    return () => {
      // Cleanup on unmount
      esRefs.current.forEach((es) => es.close());
    };
  }, [jobs, applyEvent]);

  // Report each game once it is fully downloaded, not once the whole job is:
  // the selection empties as the queue drains. Keyed by jobId so re-downloading
  // the same game in a later job reports it again.
  const reportedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!onGamesDownloaded) return;
    const fresh: string[] = [];
    jobStates.forEach((job) => {
      for (const gameId of fullyDownloadedGameIds(job.items)) {
        const key = `${job.jobId}/${gameId}`;
        if (reportedRef.current.has(key)) continue;
        reportedRef.current.add(key);
        fresh.push(gameId);
      }
    });
    if (fresh.length > 0) onGamesDownloaded(fresh);
  }, [jobStates, onGamesDownloaded]);

  // Notify parent when all jobs are done
  useEffect(() => {
    if (jobs.length === 0) return;
    const allDone = jobs.every((j) => {
      const state = jobStates.get(j.jobId);
      return state?.status === 'done' || state?.status === 'cancelled';
    });
    if (allDone) onAllDone?.();
  }, [jobs, jobStates, onAllDone]);

  if (jobs.length === 0) {
    return (
      <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
        Aucun téléchargement en cours. Lancez-en un depuis l'onglet Sources.
      </p>
    );
  }

  // Anything not 'running' is finished one way or another (done, cancelled,
  // or an SSE stream that errored out) — purgeable without touching jobs
  // still actively downloading or converting.
  const completedJobIds = jobs
    .filter((j) => jobStates.get(j.jobId)?.status !== 'running')
    .map((j) => j.jobId);

  /**
   * Relaunches one game as a new job, and hands it to the parent exactly
   * like a fresh download — a retry is a download, so it goes through the
   * same path rather than mutating the failed job in place. The failed row
   * stays visible in its original card, which is where the user clicked;
   * the new card shows what is happening now.
   */
  const handleRetry = async (
    queued: QueuedDownload,
    gameId: string,
    mode: RetryMode,
  ): Promise<void> => {
    setRetryError(null);
    try {
      let items = queued.items.filter((i) => i.gameId === gameId);
      if (mode === 'elsewhere') {
        // Same builder as the normal download path: a simplified copy here
        // would drop the fallback sources, making a retry *less* likely to
        // work than the attempt that just failed.
        items = buildDownloadItems(await resolveGames(queued.datId, [gameId]));
        if (items.length === 0) {
          setRetryError('Aucune autre source ne propose ce jeu.');
          return;
        }
      }
      const request =
        queued.target === 'server'
          ? ({
              datId: queued.datId,
              items,
              target: 'server',
              destinationDir: queued.destinationDir,
            } as const)
          : ({ datId: queued.datId, items, target: 'browser' } as const);
      const jobId = await startDownload(request);
      onQueueRetry?.({ ...request, jobId, destinationDir: queued.destinationDir });
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'La relance a échoué');
    }
  };

  const handleClearCompleted = (): void => {
    if (completedJobIds.length === 0) return;
    onClearCompleted?.(completedJobIds);
    setJobStates((prev) => {
      const next = new Map(prev);
      for (const id of completedJobIds) next.delete(id);
      return next;
    });
    for (const id of completedJobIds) {
      esRefs.current.get(id)?.close();
      esRefs.current.delete(id);
    }
  };

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '6' })}>
      <div className={css({ display: 'flex', justifyContent: 'flex-end' })}>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClearCompleted}
          disabled={completedJobIds.length === 0}
        >
          Vider les téléchargements terminés
        </Button>
      </div>
      {retryError !== null && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {retryError}
        </p>
      )}
      {jobs.map((queued) => {
        const state = jobStates.get(queued.jobId);
        if (!state) return null;
        return (
          <JobCard
            key={queued.jobId}
            state={state}
            onRetry={(gameId, mode) => void handleRetry(queued, gameId, mode)}
          />
        );
      })}
    </div>
  );
}

function JobCard({
  state,
  onRetry,
}: {
  state: JobState;
  onRetry: (gameId: string, mode: RetryMode) => void;
}) {
  const romsRoot = useRomsRoot();
  const [cancelling, setCancelling] = useState(false);

  const games = groupByGame(state.items, state.gameConversions);
  const summary = summarizeJob(games);
  const hasConversion = state.gameConversions.size > 0;
  const { rate: jobRate, rates } = useTransferRates(state.jobId, state.items);
  const eta = computeEta(summary.remainingBytes, jobRate);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelDownload(state.jobId);
    } finally {
      setCancelling(false);
    }
  };

  const done = state.items.filter((i) => i.status === 'done').length;
  const failed = state.items.filter((i) => i.status === 'failed').length;
  const total = state.items.length;

  const statusColor = {
    running: 'accent.text',
    done: 'status.success.text',
    cancelled: 'fg.subtle',
    error: 'status.danger.text',
  }[state.status];

  const statusLabel = {
    running: `${done} / ${total} téléchargés`,
    done: `Terminé — ${done} réussis${failed > 0 ? `, ${failed} échoués` : ''}`,
    cancelled: 'Annulé',
    error: 'Erreur',
  }[state.status];

  return (
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
              color: 'fg.faint',
              fontFamily: 'mono',
              truncate: true,
            })}
          >
            →{' '}
            {state.target === 'browser'
              ? 'Mon navigateur'
              : displayPath(state.destinationDir ?? '', romsRoot)}
          </p>
          <p className={css({ fontSize: 'sm', fontWeight: 'medium', color: statusColor })}>
            {statusLabel}
          </p>
        </div>
        {state.status === 'running' && (
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

      {/* What the job is doing, in one line, as the comps show it. Counted
          per game rather than per file: a three-disc game is one thing the
          user asked for, not three. */}
      <p className={css({ fontSize: 'xs', color: 'fg.subtle', fontFamily: 'mono' })}>
        {[
          `${summary.done} terminé${summary.done > 1 ? 's' : ''}`,
          `${summary.running} en cours`,
          `${summary.queued} en attente`,
          ...(summary.failed > 0 ? [`${summary.failed} en échec`] : []),
        ].join(' · ')}
        {eta !== undefined && ` — ${formatEta(eta)} restantes`}
      </p>

      {/* One row per game. The conversion step used to be a separate list
          below, which split a single game across two places on screen. */}
      <div className={css({ display: 'flex', flexDirection: 'column' })}>
        {games.map((game) => (
          <GameRow
            key={game.gameId}
            jobId={state.jobId}
            game={game}
            target={state.target}
            rate={rates.get(game.gameId)}
            running={state.status === 'running'}
            onRetry={onRetry}
          />
        ))}
      </div>

      {/* The two explanations the comps attach to the list. The browser one
          is a warning, not a note: once the bytes are in the browser's
          downloads, the app cannot reach them again. */}
      {state.target === 'browser' ? (
        <p className={css({ fontSize: 'xs', color: 'status.info.text', lineHeight: '1.5' })}>
          Chaque jeu est téléchargé et vérifié côté serveur <strong>avant</strong> de t&apos;être
          envoyé — une fois les octets partis vers ton navigateur, impossible de les rappeler.
          Retrouve-les dans la liste de téléchargements de ton navigateur, puis range-les où tu veux
          ; rom-curator ne les touche plus après l&apos;envoi.
        </p>
      ) : (
        hasConversion && (
          <p className={css({ fontSize: 'xs', color: 'fg.subtle', lineHeight: '1.5' })}>
            Les jeux sur disque sont regroupés en un seul fichier <code>.chd</code>, plus compact et
            lu par la plupart des émulateurs. Les fichiers d&apos;origine ne sont supprimés
            qu&apos;une fois la copie vérifiée.
          </p>
        )
      )}
    </Card>
  );
}

const KIND_LABELS: Record<GameStatusKind, string> = {
  queued: 'En attente',
  downloading: 'Téléchargement',
  extracting: 'Extraction…',
  converting: 'Compression en .chd…',
  done: 'Vérifié et rangé',
  failed: 'Échec',
};

/**
 * One game, one row, one state — the shape the design comps use. The files
 * behind it are summarised as a count rather than listed: a three-disc game
 * used to take three rows, and its conversion a fourth somewhere else.
 */
function GameRow({
  jobId,
  game,
  target,
  rate,
  running,
  onRetry,
}: {
  jobId: string;
  game: GameStatus;
  target: 'server' | 'browser';
  rate: number | undefined;
  running: boolean;
  onRetry: (gameId: string, mode: RetryMode) => void;
}) {
  const [cancelling, setCancelling] = useState(false);

  const label =
    game.kind === 'done' && target === 'browser'
      ? 'Envoyé à ton navigateur'
      : KIND_LABELS[game.kind];

  const color =
    game.kind === 'failed'
      ? 'status.danger.text'
      : game.kind === 'done'
        ? 'status.success.text'
        : game.kind === 'converting'
          ? 'status.warning.text'
          : 'fg.subtle';

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
    <div className={css({ py: '2.5', px: '1' })}>
      <div className={css({ display: 'flex', alignItems: 'baseline', gap: '3' })}>
        <span className={css({ flex: '1', minW: '0', fontSize: 'sm', truncate: true })}>
          {game.label}
          {game.fileCount > 1 && (
            <span className={css({ fontFamily: 'mono', fontSize: '2xs', color: 'fg.faint' })}>
              {' '}
              · {game.fileCount} fichiers
            </span>
          )}
        </span>

        <span className={css({ fontSize: 'xs', color, flexShrink: '0', fontWeight: 'medium' })}>
          {label}
          {game.kind === 'downloading' && game.progress >= 0 && (
            <span className={css({ fontFamily: 'mono' })}> {game.progress} %</span>
          )}
          {game.kind === 'downloading' && game.progress < 0 && (
            <span className={css({ fontFamily: 'mono' })}> {formatSize(game.bytesDownloaded)}</span>
          )}
          {game.kind === 'downloading' && rate !== undefined && (
            <span className={css({ fontFamily: 'mono', color: 'fg.faint' })}>
              {' '}
              · {formatRate(rate)}
            </span>
          )}
        </span>

        {running && game.kind !== 'done' && game.kind !== 'failed' && (
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

      {game.kind === 'failed' && (
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRetry(game.gameId, 'elsewhere')}
              >
                Chercher ailleurs
              </Button>
            </>
          )}
        </div>
      )}

      {(game.kind === 'downloading' || game.kind === 'extracting') && (
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
              game.progress >= 0
                ? { width: `${game.progress}%` }
                : { width: '25%', animation: 'indeterminate-slide 1.2s linear infinite' }
            }
          />
        </div>
      )}
    </div>
  );
}
