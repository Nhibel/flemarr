import { useState, useEffect, useRef, useCallback } from 'react';
import { css } from '@/styled-system/css';
import { openDownloadEvents, cancelDownload, downloadEventSchema } from '@/lib/api.js';
import type { DownloadEvent } from '@/lib/api.js';

export interface QueuedDownload {
  jobId: string;
  items: { gameId: string; romName: string }[];
  destinationDir: string;
}

interface ItemState {
  gameId: string;
  romName: string;
  status: 'queued' | 'downloading' | 'done' | 'failed';
  progress: number; // 0-100
  failReason?: string;
}

interface JobState {
  jobId: string;
  destinationDir: string;
  status: 'running' | 'done' | 'cancelled' | 'error';
  items: ItemState[];
}

interface Props {
  jobs: QueuedDownload[];
  onAllDone?: () => void;
}

export function DownloadManager({ jobs, onAllDone }: Props) {
  const [jobStates, setJobStates] = useState<Map<string, JobState>>(new Map());

  const initJob = useCallback((queued: QueuedDownload) => {
    setJobStates((prev) => {
      if (prev.has(queued.jobId)) return prev;
      const next = new Map(prev);
      next.set(queued.jobId, {
        jobId: queued.jobId,
        destinationDir: queued.destinationDir,
        status: 'running',
        items: queued.items.map((i) => ({
          ...i,
          status: 'queued',
          progress: 0,
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

      if (event.type === 'progress') {
        const idx = items.findIndex((i) => i.gameId === event.gameId);
        if (idx !== -1) {
          items[idx] = {
            ...items[idx]!,
            status: 'downloading',
            progress:
              event.totalBytes > 0
                ? Math.round((event.bytesDownloaded / event.totalBytes) * 100)
                : 0,
          };
        }
      } else if (event.type === 'file-done') {
        const idx = items.findIndex((i) => i.gameId === event.gameId);
        if (idx !== -1) items[idx] = { ...items[idx]!, status: 'done', progress: 100 };
      } else if (event.type === 'file-failed') {
        const idx = items.findIndex((i) => i.gameId === event.gameId);
        if (idx !== -1) items[idx] = { ...items[idx]!, status: 'failed', failReason: event.reason };
      } else if (event.type === 'complete') {
        next.set(jobId, { ...job, items, status: 'done' });
        return next;
      } else if (event.type === 'cancelled') {
        next.set(jobId, { ...job, items, status: 'cancelled' });
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
        applyEvent(queued.jobId, parsed.data);
        if (parsed.data.type === 'complete' || parsed.data.type === 'cancelled') {
          es.close();
        }
      };

      es.onerror = () => {
        applyEvent(queued.jobId, { type: 'complete' });
        es.close();
      };
    });

    return () => {
      // Cleanup on unmount
      esRefs.current.forEach((es) => es.close());
    };
  }, [jobs, applyEvent]);

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
      <p className={css({ fontSize: 'sm', color: 'gray.400' })}>
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
    running: 'blue.600',
    done: 'green.600',
    cancelled: 'gray.500',
    error: 'red.600',
  }[state.status];

  const statusLabel = {
    running: `${done} / ${total} téléchargés`,
    done: `Terminé — ${done} réussis${failed > 0 ? `, ${failed} échoués` : ''}`,
    cancelled: 'Annulé',
    error: 'Erreur',
  }[state.status];

  return (
    <div
      className={css({
        border: '1px solid',
        borderColor: 'gray.200',
        borderRadius: 'lg',
        overflow: 'hidden',
      })}
    >
      {/* Job header */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '3',
          px: '4',
          py: '3',
          bg: 'gray.50',
          borderBottom: '1px solid',
          borderColor: 'gray.200',
        })}
      >
        <div className={css({ flex: 1, minW: 0 })}>
          <p
            className={css({
              fontSize: 'xs',
              color: 'gray.400',
              fontFamily: 'mono',
              truncate: true,
            })}
          >
            → {state.destinationDir}
          </p>
          <p className={css({ fontSize: 'sm', fontWeight: 'medium', color: statusColor })}>
            {statusLabel}
          </p>
        </div>
        {state.status === 'running' && (
          <button
            onClick={() => void handleCancel()}
            disabled={cancelling}
            className={css({
              px: '3',
              py: '1.5',
              fontSize: 'xs',
              borderRadius: 'md',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: 'red.200',
              color: 'red.600',
              _hover: { bg: 'red.50' },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            {cancelling ? 'Annulation…' : 'Annuler'}
          </button>
        )}
      </div>

      {/* Items */}
      <div className={css({ display: 'flex', flexDirection: 'column' })}>
        {state.items.map((item) => (
          <DownloadRow key={item.gameId} item={item} />
        ))}
      </div>
    </div>
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
    queued: 'gray.300',
    downloading: 'blue.500',
    done: 'green.500',
    failed: 'red.500',
  }[item.status];

  return (
    <div
      className={css({
        px: '4',
        py: '2.5',
        borderBottom: '1px solid',
        borderColor: 'gray.100',
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
        <span className={css({ fontSize: 'sm', color: 'gray.700', flex: 1, truncate: true })}>
          {item.romName}
        </span>
        {item.status === 'downloading' && (
          <span className={css({ fontSize: 'xs', color: 'blue.500', flexShrink: 0 })}>
            {item.progress}%
          </span>
        )}
        {item.status === 'failed' && item.failReason && (
          <span className={css({ fontSize: 'xs', color: 'red.500', flexShrink: 0 })}>
            {item.failReason}
          </span>
        )}
      </div>
      {item.status === 'downloading' && (
        <div
          className={css({
            ml: '6.5',
            h: '1',
            bg: 'gray.100',
            borderRadius: 'full',
            overflow: 'hidden',
          })}
        >
          <div
            className={css({
              h: 'full',
              bg: 'blue.400',
              borderRadius: 'full',
              transition: 'width 0.2s',
            })}
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
