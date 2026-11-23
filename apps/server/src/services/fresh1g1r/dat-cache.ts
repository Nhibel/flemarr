import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dataDir } from '@/lib/db.js';
import { logger } from '@/lib/logger.js';

function cacheDir(): string {
  return join(dataDir(), 'cache');
}

function isMissingFile(err: unknown): boolean {
  return err instanceof Error && 'code' in err && err.code === 'ENOENT';
}

export async function readCachedDat(revision: string): Promise<string | null> {
  try {
    return await readFile(join(cacheDir(), `${revision}.dat`), 'utf8');
  } catch (err) {
    if (!isMissingFile(err)) logger.warn({ err, revision }, 'DAT cache unreadable');
    return null;
  }
}

export async function cacheDat(revision: string, content: string): Promise<void> {
  await mkdir(cacheDir(), { recursive: true });
  await writeFile(join(cacheDir(), `${revision}.dat`), content, 'utf8');
}
