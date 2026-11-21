import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { LIBRARY_STAGING_DIR_NAME } from '@/lib/staging-dir.js';

/**
 * Every file under a directory, recursively. Skips the downloader's
 * staging dir: what it holds is a download in progress, and a scan run at
 * that moment would report the partial files as unknown.
 */
export async function* walkDir(directory: string): AsyncGenerator<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === LIBRARY_STAGING_DIR_NAME) continue;
      yield* walkDir(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}
