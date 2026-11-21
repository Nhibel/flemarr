import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type {
  DownloadEvent,
  DownloadTarget,
  DownloadSource,
  RunningDownload,
} from '@shared/download.js';

// Browser-target files are staged here (outside any library root — they
// never get placed, only served once and then deleted).
export const BROWSER_STAGING_DIR = join(tmpdir(), 'rom-curator-browser-dl');

export interface DownloadItemState {
  gameId: string;
  romName: string;
  expectedCrc: string;
  // Ordered candidates — see downloadSourceSchema. A candidate with
  // innerPath set is an archive-container fast path (fetch the whole
  // container via getOrFetchContainer, then extractContainerEntry); others
  // go straight through downloadFile as before.
  sources: DownloadSource[];
  status: 'queued' | 'downloading' | 'done' | 'failed' | 'cancelled';
  tempPath: string;
  // Own controller, separate from the job's — lets one item be cancelled
  // without aborting its siblings. Combined with the job's own signal (see
  // processItem) so the existing "cancel everything" action still works.
  controller: AbortController;
}

export interface DownloadJobState {
  status: 'running' | 'cancelled' | 'done';
  // What the job was started with, so a reloaded page can pick it up.
  datId: string;
  destinationDir?: string;
  target: DownloadTarget;
  items: DownloadItemState[];
  events: DownloadEvent[];
  controller: AbortController;
  completedAt?: number;
  // Several roms of the same game can share one archive-container (e.g. a
  // disc's .bin and .cue both live in the same per-game .7z) — dedup'd here
  // by container URL so it's only fetched once per job.
  // `listeners` fans the one real download's progress out to every item
  // waiting on it — a per-game .7z/.zip is itself multiple hundred MB, and
  // without this nothing at all showed in the UI until the whole thing
  // finished (looked exactly like the download never started).
  // `refCount`/`controller`: once every item that needed this container has
  // settled (done, failed, or cancelled — see getOrFetchContainer's
  // `release`), the fetch itself is aborted if it's still running. Without
  // this, cancelling every item sharing a container left the real download
  // running to completion in the background regardless, which also blocked
  // the job from ever reaching 'done' (cleanupContainerCache awaits it at
  // job end) — the job-level "Annuler" button stayed up until a multi-
  // hundred-MB download finished on its own, long after every row it was
  // for had already disappeared.
  containerCache: Map<
    string,
    {
      promise: Promise<string>;
      listeners: Set<(bytesDownloaded: number, totalBytes: number) => void>;
      controller: AbortController;
      refCount: number;
    }
  >;
  // Browser-target CHD conversions only: a game's raw .bin/.cue are never
  // placed anywhere findBrowserFile already knows to look (see
  // maybeConvertGameForBrowser) — the resulting .chd's own path+filename is
  // recorded here, keyed by gameId, so findBrowserFile can serve it.
  convertedFiles: Map<string, { path: string; filename: string }>;
}

export const downloadJobs = new Map<string, DownloadJobState>();

/** The jobs of a DAT still running, in start order, as a reloaded page needs them. */
export function runningDownloads(datId: string): RunningDownload[] {
  const running: RunningDownload[] = [];
  for (const [jobId, job] of downloadJobs) {
    if (job.datId !== datId || job.status !== 'running') continue;
    running.push({
      jobId,
      datId,
      target: job.target,
      destinationDir: job.destinationDir,
      items: job.items.map(({ gameId, romName, expectedCrc, sources }) => ({
        gameId,
        romName,
        expectedCrc,
        sources,
      })),
      eventCount: job.events.length,
    });
  }
  return running;
}

/** Where the client fetches a browser-target file (or a converted .chd) from. */
export function browserFileUrl(jobId: string, gameId: string, filename: string): string {
  return `/api/downloads/${jobId}/items/${encodeURIComponent(gameId)}/${encodeURIComponent(filename)}`;
}
