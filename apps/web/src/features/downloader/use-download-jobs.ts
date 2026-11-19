import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadEventSchema, openDownloadEvents } from '@/lib/api.js';
import type { DownloadEvent } from '@/lib/api.js';
import { triggerBrowserSave } from '@/lib/browser-save.js';
import { fullyDownloadedGameIds } from './completed-games.js';
import { applyDownloadEvent, initJobState, isFinalEvent } from './job-state.js';
import type { JobState, QueuedDownload } from './job-state.js';

interface Options {
  jobs: QueuedDownload[];
  /** Called with games whose every ROM landed, as soon as each one completes. */
  onGamesDownloaded?: (gameIds: string[]) => void;
  onAllDone?: () => void;
}

/**
 * Follows every queued job live: one SSE stream per job, folded into a
 * JobState by applyDownloadEvent. Also reports finished games and drops
 * finished jobs on request.
 */
export function useDownloadJobs({ jobs, onGamesDownloaded, onAllDone }: Options) {
  const [jobStates, setJobStates] = useState<Map<string, JobState>>(new Map());
  const streams = useRef<Map<string, EventSource>>(new Map());

  // Initialise new jobs as they arrive
  useEffect(() => {
    setJobStates((prev) => {
      const fresh = jobs.filter((queued) => !prev.has(queued.jobId));
      if (fresh.length === 0) return prev;
      const next = new Map(prev);
      for (const queued of fresh) next.set(queued.jobId, initJobState(queued));
      return next;
    });
  }, [jobs]);

  const applyEvent = useCallback((jobId: string, event: DownloadEvent) => {
    setJobStates((prev) => {
      const job = prev.get(jobId);
      if (!job) return prev;
      const next = new Map(prev);
      next.set(jobId, applyDownloadEvent(job, event));
      return next;
    });
  }, []);

  // Open one SSE stream per job, once.
  useEffect(() => {
    for (const queued of jobs) {
      if (streams.current.has(queued.jobId)) continue;

      const stream = openDownloadEvents(queued.jobId);
      streams.current.set(queued.jobId, stream);

      stream.onmessage = (message) => {
        const parsed = downloadEventSchema.safeParse(JSON.parse(message.data as string) as unknown);
        if (!parsed.success) return;
        const event = parsed.data;
        if (event.type === 'file-ready') triggerBrowserSave(event.downloadUrl, event.romName);
        applyEvent(queued.jobId, event);
        if (isFinalEvent(event)) stream.close();
      };

      // Connection lost — the job may still run server-side, but we can't
      // observe it anymore; report an error instead of pretending it finished.
      stream.onerror = () => {
        applyEvent(queued.jobId, { type: 'error', message: 'Connexion au flux perdue' });
        stream.close();
      };
    }
  }, [jobs, applyEvent]);

  // Close every stream on unmount.
  useEffect(() => {
    const openStreams = streams.current;
    return () => openStreams.forEach((stream) => stream.close());
  }, []);

  // Report each game once it is fully downloaded, not once the whole job is:
  // the selection empties as the queue drains. Keyed by jobId so re-downloading
  // the same game in a later job reports it again.
  const reported = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onGamesDownloaded) return;
    const fresh: string[] = [];
    for (const job of jobStates.values()) {
      for (const gameId of fullyDownloadedGameIds(job.items)) {
        const key = `${job.jobId}/${gameId}`;
        if (reported.current.has(key)) continue;
        reported.current.add(key);
        fresh.push(gameId);
      }
    }
    if (fresh.length > 0) onGamesDownloaded(fresh);
  }, [jobStates, onGamesDownloaded]);

  useEffect(() => {
    if (jobs.length === 0) return;
    const allDone = jobs.every((queued) => {
      const status = jobStates.get(queued.jobId)?.status;
      return status === 'done' || status === 'cancelled';
    });
    if (allDone) onAllDone?.();
  }, [jobs, jobStates, onAllDone]);

  // Anything not 'running' is finished one way or another (done, cancelled,
  // or an SSE stream that errored out) — purgeable without touching jobs
  // still actively downloading or converting.
  const completedJobIds = jobs
    .filter((queued) => jobStates.get(queued.jobId)?.status !== 'running')
    .map((queued) => queued.jobId);

  const forgetJobs = useCallback((jobIds: string[]) => {
    setJobStates((prev) => {
      const next = new Map(prev);
      for (const id of jobIds) next.delete(id);
      return next;
    });
    for (const id of jobIds) {
      streams.current.get(id)?.close();
      streams.current.delete(id);
    }
  }, []);

  return { jobStates, completedJobIds, forgetJobs };
}
