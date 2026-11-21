import { describe, it, expect, beforeEach } from 'vitest';
import { downloadJobs, runningDownloads } from '../services/downloader/job-store.js';
import type { DownloadJobState } from '../services/downloader/job-store.js';

const SOURCE = { url: 'https://archive.org/download/x/a.sfc', extractFromZip: false };

function job(over: Partial<DownloadJobState>): DownloadJobState {
  return {
    status: 'running',
    datId: 'dat1',
    destinationDir: '/roms/snes',
    target: 'server',
    items: [
      {
        gameId: 'g1',
        romName: 'a.sfc',
        expectedCrc: 'aabbccdd',
        sources: [SOURCE],
        status: 'downloading',
        tempPath: '/tmp/a',
        controller: new AbortController(),
      },
    ],
    events: [{ type: 'complete' }],
    controller: new AbortController(),
    containerCache: new Map(),
    convertedFiles: new Map(),
    ...over,
  };
}

beforeEach(() => {
  downloadJobs.clear();
});

describe('runningDownloads', () => {
  it('describes a running job as it was requested, with its event count', () => {
    downloadJobs.set('j1', job({}));
    expect(runningDownloads('dat1')).toEqual([
      {
        jobId: 'j1',
        datId: 'dat1',
        target: 'server',
        destinationDir: '/roms/snes',
        items: [{ gameId: 'g1', romName: 'a.sfc', expectedCrc: 'aabbccdd', sources: [SOURCE] }],
        eventCount: 1,
      },
    ]);
  });

  // A finished job the user cleared must not come back after a reload.
  it('leaves out finished jobs and other DATs', () => {
    downloadJobs.set('done', job({ status: 'done' }));
    downloadJobs.set('cancelled', job({ status: 'cancelled' }));
    downloadJobs.set('other', job({ datId: 'dat2' }));
    expect(runningDownloads('dat1')).toEqual([]);
  });
});
