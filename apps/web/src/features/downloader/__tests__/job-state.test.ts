import { describe, expect, it } from 'vitest';
import { applyDownloadEvent, initJobState, isFinalEvent, UNKNOWN } from '../job-state.js';
import type { JobState, QueuedDownload } from '../job-state.js';

const SOURCE = { url: 'https://example.invalid/a.zip', extractFromZip: false };

function queued(): QueuedDownload {
  return {
    jobId: 'job-1',
    datId: 'dat-1',
    target: 'server',
    destinationDir: '/roms',
    items: [
      { gameId: 'g1', romName: 'disc1.bin', expectedCrc: 'aabbccdd', sources: [SOURCE] },
      { gameId: 'g1', romName: 'disc2.bin', expectedCrc: 'aabbccde', sources: [SOURCE] },
      { gameId: 'g2', romName: 'other.sfc', expectedCrc: 'aabbccdf', sources: [SOURCE] },
    ],
  };
}

function item(job: JobState, romName: string) {
  return job.items.find((i) => i.romName === romName);
}

describe('initJobState', () => {
  it('starts running, with every item queued and nothing converted', () => {
    const job = initJobState(queued());
    expect(job.status).toBe('running');
    expect(job.items.map((i) => i.status)).toEqual(['queued', 'queued', 'queued']);
    expect(job.gameConversions.size).toBe(0);
  });
});

describe('applyDownloadEvent', () => {
  it('computes a percentage when the total is known', () => {
    const job = applyDownloadEvent(initJobState(queued()), {
      type: 'progress',
      gameId: 'g1',
      romName: 'disc1.bin',
      bytesDownloaded: 25,
      totalBytes: 100,
    });
    expect(item(job, 'disc1.bin')).toMatchObject({
      status: 'downloading',
      progress: 25,
      totalBytes: 100,
    });
  });

  it('marks progress and total unknown when the source sends no length', () => {
    const job = applyDownloadEvent(initJobState(queued()), {
      type: 'progress',
      gameId: 'g1',
      romName: 'disc1.bin',
      bytesDownloaded: 25,
      totalBytes: 0,
    });
    expect(item(job, 'disc1.bin')).toMatchObject({ progress: UNKNOWN, totalBytes: UNKNOWN });
  });

  it('only touches the disc named by the event, not its sibling', () => {
    const job = applyDownloadEvent(initJobState(queued()), {
      type: 'file-extracting',
      gameId: 'g1',
      romName: 'disc2.bin',
    });
    expect(item(job, 'disc1.bin')?.status).toBe('queued');
    expect(item(job, 'disc2.bin')?.status).toBe('extracting');
  });

  it.each(['file-done', 'file-ready'] as const)('treats %s as a finished file', (type) => {
    const base = { type, gameId: 'g2', romName: 'other.sfc' };
    const event =
      type === 'file-ready' ? { ...base, type, downloadUrl: '/api/x' } : { ...base, type };
    const job = applyDownloadEvent(initJobState(queued()), event);
    expect(item(job, 'other.sfc')).toMatchObject({ status: 'done', progress: 100 });
  });

  it('keeps the reason of a failed file', () => {
    const job = applyDownloadEvent(initJobState(queued()), {
      type: 'file-failed',
      gameId: 'g2',
      romName: 'other.sfc',
      reason: 'CRC mismatch',
    });
    expect(item(job, 'other.sfc')).toMatchObject({ status: 'failed', failReason: 'CRC mismatch' });
  });

  it('drops a cancelled file instead of marking it', () => {
    const job = applyDownloadEvent(initJobState(queued()), {
      type: 'file-cancelled',
      gameId: 'g2',
      romName: 'other.sfc',
    });
    expect(item(job, 'other.sfc')).toBeUndefined();
    expect(job.items).toHaveLength(2);
  });

  it('records each conversion step per game', () => {
    let job = initJobState(queued());
    job = applyDownloadEvent(job, { type: 'game-converting', gameId: 'g1' });
    expect(job.gameConversions.get('g1')).toEqual({ status: 'converting' });
    job = applyDownloadEvent(job, { type: 'game-converted', gameId: 'g1' });
    expect(job.gameConversions.get('g1')).toEqual({ status: 'converted' });
    job = applyDownloadEvent(job, { type: 'game-convert-failed', gameId: 'g2', reason: 'chdman' });
    expect(job.gameConversions.get('g2')).toEqual({ status: 'failed', reason: 'chdman' });
  });

  it.each([
    [{ type: 'complete' } as const, 'done'],
    [{ type: 'cancelled' } as const, 'cancelled'],
    [{ type: 'error', message: 'boom' } as const, 'error'],
  ])('ends the job on %o', (event, status) => {
    const job = applyDownloadEvent(initJobState(queued()), event);
    expect(job.status).toBe(status);
    expect(isFinalEvent(event)).toBe(true);
  });

  it('never mutates the job it was given', () => {
    const before = initJobState(queued());
    const snapshot = structuredClone(before);
    applyDownloadEvent(before, { type: 'game-converting', gameId: 'g1' });
    applyDownloadEvent(before, { type: 'file-cancelled', gameId: 'g1', romName: 'disc1.bin' });
    expect(before).toEqual(snapshot);
  });
});
