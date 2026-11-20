import { describe, expect, it } from 'vitest';
import { buildRetryRequest, itemsOfGame } from '../retry.js';
import type { QueuedDownload } from '../job-state.js';

const SOURCE = { url: 'https://example.invalid/a.zip', extractFromZip: false };

function queued(target: 'server' | 'browser'): QueuedDownload {
  return {
    jobId: 'job-1',
    datId: 'dat-1',
    target,
    destinationDir: target === 'server' ? '/roms/snes' : undefined,
    items: [
      { gameId: 'g1', romName: 'a.sfc', expectedCrc: 'aabbccdd', sources: [SOURCE] },
      { gameId: 'g2', romName: 'b.sfc', expectedCrc: 'aabbccde', sources: [SOURCE] },
    ],
  };
}

describe('itemsOfGame', () => {
  it('keeps only the retried game, with its sources', () => {
    expect(itemsOfGame(queued('server'), 'g2')).toEqual([
      { gameId: 'g2', romName: 'b.sfc', expectedCrc: 'aabbccde', sources: [SOURCE] },
    ]);
  });
});

describe('buildRetryRequest', () => {
  it('sends a server retry to the same folder', () => {
    const job = queued('server');
    expect(buildRetryRequest(job, job.items)).toEqual({
      datId: 'dat-1',
      items: job.items,
      target: 'server',
      destinationDir: '/roms/snes',
    });
  });

  it('sends a browser retry without a folder', () => {
    const job = queued('browser');
    expect(buildRetryRequest(job, job.items)).toEqual({
      datId: 'dat-1',
      items: job.items,
      target: 'browser',
    });
  });
});
