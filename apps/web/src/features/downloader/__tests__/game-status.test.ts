import { describe, it, expect } from 'vitest';
import { deriveGameStatus, groupByGame, summarizeJob, gameLabel } from '../game-status.js';
import type { ItemLike, ConversionLike } from '../game-status.js';

function item(over: Partial<ItemLike> & Pick<ItemLike, 'romName'>): ItemLike {
  return {
    gameId: 'g1',
    status: 'queued',
    progress: 0,
    bytesDownloaded: 0,
    totalBytes: 1000,
    ...over,
  };
}

describe('gameLabel', () => {
  it('uses the cue basename for a disc game', () => {
    expect(
      gameLabel([
        item({ romName: 'Game (USA) (Track 1).bin' }),
        item({ romName: 'Game (USA).cue' }),
      ]),
    ).toBe('Game (USA)');
  });

  it('falls back to the single rom name', () => {
    expect(gameLabel([item({ romName: 'Super Mario World.sfc' })])).toBe('Super Mario World.sfc');
  });
});

describe('deriveGameStatus', () => {
  it('reports a single downloading file as the game downloading', () => {
    const s = deriveGameStatus('g1', [
      item({ romName: 'a.sfc', status: 'downloading', bytesDownloaded: 500, totalBytes: 1000 }),
    ]);
    expect(s.kind).toBe('downloading');
    expect(s.progress).toBe(50);
  });

  // One missing disc makes the game unusable, so it is not "two thirds
  // done" — the least-advanced file decides.
  it('a three-disc game stays downloading until its last disc is in', () => {
    const items = [
      item({ romName: 'd1.bin', status: 'done', bytesDownloaded: 1000, progress: 100 }),
      item({ romName: 'd2.bin', status: 'done', bytesDownloaded: 1000, progress: 100 }),
      item({ romName: 'd3.bin', status: 'downloading', bytesDownloaded: 500 }),
    ];
    const s = deriveGameStatus('g1', items);
    expect(s.kind).toBe('downloading');
    expect(s.progress).toBe(83);
    expect(s.fileCount).toBe(3);
  });

  it('one failure among successes fails the whole game, with its reason', () => {
    const s = deriveGameStatus('g1', [
      item({ romName: 'd1.bin', status: 'done', bytesDownloaded: 1000 }),
      item({ romName: 'd2.bin', status: 'failed', failReason: 'Source indisponible' }),
    ]);
    expect(s.kind).toBe('failed');
    expect(s.reason).toBe('Source indisponible');
  });

  it('conversion in progress wins over every file being done', () => {
    const items = [item({ romName: 'd1.bin', status: 'done', bytesDownloaded: 1000 })];
    const converting: ConversionLike = { status: 'converting' };
    expect(deriveGameStatus('g1', items, converting).kind).toBe('converting');
    expect(deriveGameStatus('g1', items).kind).toBe('done');
  });

  // The bytes are on disk and only the .chd step broke, which is a
  // different thing to tell the user than a download that never arrived.
  it('marks a failed conversion as a failure, flagged as a conversion one', () => {
    const s = deriveGameStatus('g1', [item({ romName: 'd1.bin', status: 'done' })], {
      status: 'failed',
      reason: 'chdman a échoué',
    });
    expect(s.kind).toBe('failed');
    expect(s.convertFailed).toBe(true);
    expect(s.reason).toBe('chdman a échoué');
  });

  // Every restricted re-zipped collection streams without a Content-Length.
  it('propagates an unknown total instead of understating it', () => {
    const s = deriveGameStatus('g1', [
      item({ romName: 'd1.bin', status: 'done', bytesDownloaded: 1000, totalBytes: 1000 }),
      item({ romName: 'd2.bin', status: 'downloading', bytesDownloaded: 300, totalBytes: -1 }),
    ]);
    expect(s.totalBytes).toBe(-1);
    expect(s.progress).toBe(-1);
    expect(s.bytesDownloaded).toBe(1300);
  });

  it('still reports 100% when every file is done without a known total', () => {
    const s = deriveGameStatus('g1', [
      item({ romName: 'd1.bin', status: 'done', bytesDownloaded: 1000, totalBytes: -1 }),
    ]);
    expect(s.kind).toBe('done');
    expect(s.progress).toBe(100);
  });
});

describe('groupByGame', () => {
  it('keeps one entry per game, in queue order', () => {
    const games = groupByGame(
      [
        item({ gameId: 'b', romName: 'b1.bin' }),
        item({ gameId: 'a', romName: 'a1.bin' }),
        item({ gameId: 'b', romName: 'b2.bin' }),
      ],
      new Map(),
    );
    expect(games.map((g) => g.gameId)).toEqual(['b', 'a']);
    expect(games[0]?.fileCount).toBe(2);
  });
});

describe('summarizeJob', () => {
  it('counts each game once, by state', () => {
    const games = groupByGame(
      [
        item({ gameId: 'a', romName: 'a.bin', status: 'done', bytesDownloaded: 1000 }),
        item({ gameId: 'b', romName: 'b.bin', status: 'downloading', bytesDownloaded: 400 }),
        item({ gameId: 'c', romName: 'c.bin', status: 'queued' }),
        item({ gameId: 'd', romName: 'd.bin', status: 'failed', failReason: 'x' }),
      ],
      new Map(),
    );
    const s = summarizeJob(games);
    expect(s).toMatchObject({ total: 4, done: 1, running: 1, queued: 1, failed: 1 });
    // b has 600 left, c has 1000, and neither a nor d counts.
    expect(s.remainingBytes).toBe(1600);
  });

  // Undefined must mean "no estimate". Zero would render as "0 seconds
  // left" on a download that has barely started.
  it('withholds the remaining bytes when any unfinished game has no total', () => {
    const games = groupByGame(
      [item({ gameId: 'a', romName: 'a.bin', status: 'downloading', totalBytes: -1 })],
      new Map(),
    );
    expect(summarizeJob(games).remainingBytes).toBeUndefined();
  });

  it('ignores an unknown total on a game that already finished', () => {
    const games = groupByGame(
      [
        item({
          gameId: 'a',
          romName: 'a.bin',
          status: 'done',
          bytesDownloaded: 500,
          totalBytes: -1,
        }),
      ],
      new Map(),
    );
    expect(summarizeJob(games).remainingBytes).toBe(0);
  });
});
