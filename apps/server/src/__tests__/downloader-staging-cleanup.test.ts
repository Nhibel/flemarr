import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isStagingDirShared,
  removeStagingDirIfEmpty,
} from '../services/downloader/staging-cleanup.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'flemarr-staging-cleanup-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('removeStagingDirIfEmpty', () => {
  it('removes an empty staging dir', async () => {
    const staging = join(dir, '.flemarr-tmp');
    await mkdir(staging);
    await removeStagingDirIfEmpty(staging);
    expect(await exists(staging)).toBe(false);
  });

  it('never removes a file left inside it', async () => {
    const staging = join(dir, '.flemarr-tmp');
    await mkdir(staging);
    await writeFile(join(staging, 'still-there.bin'), 'x');
    await removeStagingDirIfEmpty(staging);
    expect(await exists(join(staging, 'still-there.bin'))).toBe(true);
  });

  it('is fine when the dir was never created', async () => {
    await expect(removeStagingDirIfEmpty(join(dir, 'missing'))).resolves.toBeUndefined();
  });
});

describe('isStagingDirShared', () => {
  const folder = '/roms/psx';

  it('is shared while another running job downloads into the same folder', () => {
    expect(
      isStagingDirShared('this', folder, [
        ['this', { status: 'done', target: 'server', destinationDir: folder }],
        ['other', { status: 'running', target: 'server', destinationDir: folder }],
      ]),
    ).toBe(true);
  });

  it('is not shared with finished jobs, other folders or browser jobs', () => {
    expect(
      isStagingDirShared('this', folder, [
        ['this', { status: 'running', target: 'server', destinationDir: folder }],
        ['done', { status: 'done', target: 'server', destinationDir: folder }],
        ['elsewhere', { status: 'running', target: 'server', destinationDir: '/roms/snes' }],
        ['browser', { status: 'running', target: 'browser', destinationDir: undefined }],
      ]),
    ).toBe(false);
  });
});
