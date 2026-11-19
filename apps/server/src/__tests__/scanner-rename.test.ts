import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findCollisions, renameWithRollback } from '../services/scanner/rename.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rename-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('findCollisions', () => {
  it('reports a destination that already exists', async () => {
    await writeFile(join(dir, 'a.sfc'), '');
    await writeFile(join(dir, 'taken.sfc'), '');
    expect(await findCollisions([{ from: join(dir, 'a.sfc'), to: 'taken.sfc' }])).toEqual([
      join(dir, 'taken.sfc'),
    ]);
  });

  it('reports a destination used twice in the batch', async () => {
    const collisions = await findCollisions([
      { from: join(dir, 'a.sfc'), to: 'same.sfc' },
      { from: join(dir, 'b.sfc'), to: 'same.sfc' },
    ]);
    expect(collisions).toEqual([join(dir, 'same.sfc')]);
  });

  it('is empty when every destination is free', async () => {
    expect(await findCollisions([{ from: join(dir, 'a.sfc'), to: 'free.sfc' }])).toEqual([]);
  });
});

describe('renameWithRollback', () => {
  it('renames every entry', async () => {
    await writeFile(join(dir, 'a.sfc'), '');
    const result = await renameWithRollback([{ from: join(dir, 'a.sfc'), to: 'A (USA).sfc' }]);
    expect(result.failed).toEqual([]);
    expect(await readdir(dir)).toEqual(['A (USA).sfc']);
  });

  it('stops at the first failure and puts the earlier renames back', async () => {
    await writeFile(join(dir, 'a.sfc'), '');
    // Renaming a file onto a non-empty directory fails on every platform.
    await mkdir(join(dir, 'blocked'));
    await writeFile(join(dir, 'blocked', 'keep'), '');
    await writeFile(join(dir, 'b.sfc'), '');

    const result = await renameWithRollback([
      { from: join(dir, 'a.sfc'), to: 'A.sfc' },
      { from: join(dir, 'b.sfc'), to: 'blocked' },
      { from: join(dir, 'c.sfc'), to: 'C.sfc' },
    ]);

    expect(result.failed.map((f) => f.entry.from)).toEqual([join(dir, 'b.sfc')]);
    expect(result.rolledBack).toEqual([join(dir, 'a.sfc')]);
    expect((await readdir(dir)).sort()).toEqual(['a.sfc', 'b.sfc', 'blocked']);
  });
});
