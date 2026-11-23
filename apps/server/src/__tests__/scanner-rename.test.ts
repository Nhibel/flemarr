import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renameWithRollback } from '../services/scanner/rename.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rename-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('renameWithRollback', () => {
  it('renames every entry', async () => {
    await writeFile(join(dir, 'a.sfc'), '');
    const result = await renameWithRollback([{ from: join(dir, 'a.sfc'), to: 'A (USA).sfc' }]);
    expect(result.failed).toEqual([]);
    expect(await readdir(dir)).toEqual(['A (USA).sfc']);
  });

  it('skips a taken destination and renames the rest', async () => {
    await writeFile(join(dir, 'a.sfc'), 'a');
    await writeFile(join(dir, 'taken.sfc'), 'untouched');
    await writeFile(join(dir, 'b.sfc'), 'b');

    const blocked = { from: join(dir, 'a.sfc'), to: 'taken.sfc' };
    const result = await renameWithRollback([blocked, { from: join(dir, 'b.sfc'), to: 'B.sfc' }]);

    expect(result.skipped).toEqual([{ entry: blocked, reason: 'destination-exists' }]);
    expect(result.done).toHaveLength(1);
    expect((await readdir(dir)).sort()).toEqual(['B.sfc', 'a.sfc', 'taken.sfc']);
    expect(await readFile(join(dir, 'taken.sfc'), 'utf8')).toBe('untouched');
  });

  it('keeps the second of two duplicates under its own name', async () => {
    await writeFile(join(dir, 'a.sfc'), 'first');
    await writeFile(join(dir, 'b.sfc'), 'second');

    const result = await renameWithRollback([
      { from: join(dir, 'a.sfc'), to: 'Same.sfc' },
      { from: join(dir, 'b.sfc'), to: 'Same.sfc' },
    ]);

    expect(result.skipped.map((skip) => skip.entry.from)).toEqual([join(dir, 'b.sfc')]);
    expect(await readFile(join(dir, 'Same.sfc'), 'utf8')).toBe('first');
    expect(await readFile(join(dir, 'b.sfc'), 'utf8')).toBe('second');
  });

  it('changes only the case of a name', async () => {
    await writeFile(join(dir, 'game.sfc'), '');
    const result = await renameWithRollback([{ from: join(dir, 'game.sfc'), to: 'Game.sfc' }]);
    expect(result.skipped).toEqual([]);
    expect(await readdir(dir)).toEqual(['Game.sfc']);
  });

  it('undoes a chain of renames in reverse order', async () => {
    await writeFile(join(dir, 'a'), 'a');
    await writeFile(join(dir, 'b'), 'b');
    const result = await renameWithRollback([
      { from: join(dir, 'b'), to: 'c' },
      { from: join(dir, 'a'), to: 'b' },
      { from: join(dir, 'missing'), to: 'd' },
    ]);
    expect(result.rolledBack).toHaveLength(2);
    expect(await readFile(join(dir, 'a'), 'utf8')).toBe('a');
    expect(await readFile(join(dir, 'b'), 'utf8')).toBe('b');
  });

  it('stops at the first failure and puts the earlier renames back', async () => {
    await writeFile(join(dir, 'a.sfc'), '');

    const result = await renameWithRollback([
      { from: join(dir, 'a.sfc'), to: 'A.sfc' },
      { from: join(dir, 'b.sfc'), to: 'B.sfc' },
      { from: join(dir, 'c.sfc'), to: 'C.sfc' },
    ]);

    expect(result.failed.map((f) => f.entry.from)).toEqual([join(dir, 'b.sfc')]);
    expect(result.rolledBack).toEqual([join(dir, 'a.sfc')]);
    expect((await readdir(dir)).sort()).toEqual(['a.sfc']);
  });
});
