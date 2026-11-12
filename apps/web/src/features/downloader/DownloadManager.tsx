import { useState, useEffect, useRef, useCallback } from 'react';
import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { Card } from '@/components/Card.js';
import { openDownloadEvents, cancelDownload, downloadEventSchema } from '@/lib/api.js';
import type { DownloadEvent } from '@/lib/api.js';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import { fullyDownloadedGameIds } from './completed-games.js';

export interface QueuedDownload {
  jobId: string;
  items: { gameId: string; romName: string }[];
  target: 'server' | 'browser';
  destinationDir?: string;
}

interface ItemState {
  gameId: string;
  romName: string;
  status: 'queued' | 'downloading' | 'done' | 'failed';
  // -1 means "unknown total" (archive.org's zip-view extraction streams
  // chunked, with no Content-Length — every restricted zip-collection
  // source hits this, not just an occasional one) — rendered as bytes
  // downloaded and an indeterminate bar instead of a percentage that would
  // otherwise read as permanently stuck at 0.
  progress: number; // 0-100, or -1
  bytesDownloaded: number;
  failReason?: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

interface JobState {
  jobId: string;
  target: 'server' | 'browser';
  destinationDir?: string;
  status: 'running' | 'done' | 'cancelled' | 'error';
  items: ItemState[];
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
}

export function DownloadManager({ jobs, onAllDone, onGamesDownloaded }: Props) {
  const [jobStates, setJobStates] = useState<Map<string, JobState>>(new Map());

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
        })),
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
          };
        }
      } else if (event.type === 'file-done' || event.type === 'file-ready') {
        const idx = findItem(event.gameId, event.romName);
        if (idx !== -1) items[idx] = { ...items[idx]!, status: 'done', progress: 100 };
      } else if (event.type === 'file-failed') {
        const idx = findItem(event.gameId, event.romName);
        if (idx !== -1) items[idx] = { ...items[idx]!, status: 'failed', failReason: event.reason };
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

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '6' })}>
      {jobs.map((queued) => {
        const state = jobStates.get(queued.jobId);
        if (!state) return null;
        return <JobCard key={queued.jobId} state={state} />;
      })}
    </div>
  );
}

function JobCard({ state }: { state: JobState }) {
  const romsRoot = useRomsRoot();
  const [cancelling, setCancelling] = useState(false);

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
          borderBottom: '1px solid',
          borderColor: 'bd.default',
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

      {/* Items */}
      <div className={css({ display: 'flex', flexDirection: 'column' })}>
        {state.items.map((item) => (
          <DownloadRow key={`${item.gameId}/${item.romName}`} item={item} />
        ))}
      </div>
    </Card>
  );
}

function DownloadRow({ item }: { item: ItemState }) {
  const icon = {
    queued: '○',
    downloading: '↓',
    done: '✓',
    failed: '✗',
  }[item.status];

  const iconColor = {
    queued: 'fg.faint',
    downloading: 'accent.text',
    done: 'status.success.text',
    failed: 'status.danger.text',
  }[item.status];

  return (
    <div
      className={css({
        px: '4',
        py: '2.5',
        borderBottom: '1px solid',
        borderColor: 'bd.subtle',
        _last: { borderBottom: 'none' },
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2.5',
          mb: item.status === 'downloading' ? '1.5' : '0',
        })}
      >
        <span
          className={css({
            fontSize: 'sm',
            color: iconColor,
            flexShrink: 0,
            w: '4',
            textAlign: 'center',
          })}
        >
          {icon}
        </span>
        <span className={css({ fontSize: 'sm', color: 'fg.default', flex: 1, truncate: true })}>
          {item.romName}
        </span>
        {item.status === 'downloading' && (
          <span className={css({ fontSize: 'xs', color: 'accent.text', flexShrink: 0 })}>
            {item.progress >= 0 ? `${item.progress}%` : `${formatSize(item.bytesDownloaded)}…`}
          </span>
        )}
        {item.status === 'failed' && item.failReason && (
          <span className={css({ fontSize: 'xs', color: 'status.danger.text', flexShrink: 0 })}>
            {item.failReason}
          </span>
        )}
      </div>
      {item.status === 'downloading' && (
        <div
          className={css({
            ml: '6.5',
            h: '1',
            bg: 'bg.muted',
            borderRadius: 'full',
            overflow: 'hidden',
          })}
        >
          {item.progress >= 0 ? (
            <div
              className={css({
                h: 'full',
                bg: 'accent.solid',
                borderRadius: 'full',
                transition: 'width 0.2s',
              })}
              style={{ width: `${item.progress}%` }}
            />
          ) : (
            <div
              className={css({
                h: 'full',
                // Width is load-bearing, not just styling — the
                // indeterminate-slide keyframe's translateX values are
                // percentages of THIS element's own width, tuned for 25% so
                // the sweep's ends land exactly off-track (see the keyframe
                // comment in panda.config.ts). Changing this without
                // retuning the keyframe brings back the "stops short, then
                // jumps back" look this was fixing.
                w: '25%',
                bg: 'accent.solid',
                borderRadius: 'full',
                animation: 'indeterminate-slide 1.2s linear infinite',
              })}
            />
          )}
        </div>
      )}
    </div>
  );
}
