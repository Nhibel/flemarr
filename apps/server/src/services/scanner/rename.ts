import { rename, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { logger } from '@/lib/logger.js';
import type { RenameRequest, RenameResult } from '@shared/scan.js';

type RenameEntry = RenameRequest['renames'][number];

/** The renamed file's full path: `to` is a bare filename in `from`'s folder. */
export function renameDestination({ from, to }: RenameEntry): string {
  return join(dirname(from), to);
}

/**
 * Destinations that already exist on disk or appear twice in the batch — a
 * rename onto either would silently overwrite a file.
 */
export async function findCollisions(renames: RenameEntry[]): Promise<string[]> {
  const seen = new Set<string>();
  const collisions: string[] = [];
  for (const dest of renames.map(renameDestination)) {
    if (seen.has(dest)) collisions.push(dest);
    seen.add(dest);
    try {
      await access(dest);
      collisions.push(dest);
    } catch {
      // destination free — ok
    }
  }
  return collisions;
}

/**
 * Renames in order and stops at the first failure, then puts back the files
 * already renamed (best effort) so a batch never leaves a half-renamed
 * folder behind.
 */
export async function renameWithRollback(renames: RenameEntry[]): Promise<RenameResult> {
  const done: RenameEntry[] = [];
  for (const entry of renames) {
    try {
      await rename(entry.from, renameDestination(entry));
      done.push(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ from: entry.from, to: entry.to, err }, 'rename failed, rolling back');
      const rolledBack = await rollBack(done);
      return { done, failed: [{ entry, error: message }], rolledBack };
    }
  }
  logger.info({ files: done.length }, 'files renamed');
  return { done, failed: [], rolledBack: [] };
}

async function rollBack(done: RenameEntry[]): Promise<string[]> {
  const rolledBack: string[] = [];
  for (const completed of done) {
    try {
      await rename(renameDestination(completed), completed.from);
      rolledBack.push(completed.from);
    } catch (err) {
      // best-effort — log but continue
      logger.error({ from: completed.from, to: completed.to, err }, 'rename rollback failed');
    }
  }
  return rolledBack;
}
