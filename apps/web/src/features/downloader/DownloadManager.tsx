import { useState } from 'react';
import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { resolveGames, startDownload } from '@/lib/api.js';
import { buildDownloadItems } from '@/features/archive/build-items.js';
import { JobCard } from './JobCard.js';
import type { QueuedDownload } from './job-state.js';
import { buildRetryRequest, itemsOfGame } from './retry.js';
import type { RetryMode } from './retry.js';
import { useDownloadJobs } from './use-download-jobs.js';

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

/** The Downloads tab: every job of the session, live, with retry and cleanup. */
export function DownloadManager({
  jobs,
  onAllDone,
  onGamesDownloaded,
  onClearCompleted,
  onQueueRetry,
}: Props) {
  const [retryError, setRetryError] = useState<string | null>(null);
  const { jobStates, completedJobIds, forgetJobs } = useDownloadJobs({
    jobs,
    onGamesDownloaded,
    onAllDone,
  });

  if (jobs.length === 0) {
    return (
      <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
        Aucun téléchargement en cours. Lance-en un depuis l'onglet Sources.
      </p>
    );
  }

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
      let items = itemsOfGame(queued, gameId);
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
      const request = buildRetryRequest(queued, items);
      const jobId = await startDownload(request);
      onQueueRetry?.({ ...request, jobId, destinationDir: queued.destinationDir });
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'La relance a échoué');
    }
  };

  const handleClearCompleted = (): void => {
    if (completedJobIds.length === 0) return;
    onClearCompleted?.(completedJobIds);
    forgetJobs(completedJobIds);
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
