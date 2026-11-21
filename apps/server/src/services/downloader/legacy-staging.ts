import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logger } from '@/lib/logger.js';

/**
 * Staging dirs named after the app's previous name (rom-curator, renamed
 * Flemarr on 2026-11-21). Jobs live in memory only, so after a restart on
 * the new code nothing can still be writing to them: whatever they hold is
 * a partial download that was interrupted. Remove this file once installs
 * have had time to download into each of their folders since the rename.
 */
const LEGACY_LIBRARY_STAGING_DIR_NAME = '.rom-curator-tmp';
const LEGACY_BROWSER_STAGING_DIR = join(tmpdir(), 'rom-curator-browser-dl');

/**
 * Deletes the legacy staging dirs a download is about to sit next to: the
 * one inside its library folder (for a server-target download) and the one
 * in the OS temp dir. Missing dirs are fine; a failure is logged, not
 * thrown, since leftover partial files must never block a new download.
 */
export async function removeLegacyStagingDirs(destinationDir: string | undefined): Promise<void> {
  const dirs = [LEGACY_BROWSER_STAGING_DIR];
  if (destinationDir !== undefined)
    dirs.push(join(destinationDir, LEGACY_LIBRARY_STAGING_DIR_NAME));

  for (const dir of dirs) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (error) {
      logger.warn({ err: error, dir }, 'could not remove a pre-rename staging dir');
    }
  }
}
