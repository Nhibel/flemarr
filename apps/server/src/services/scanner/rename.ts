import { rename, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { logger } from '@/lib/logger.js';
import type { RenameRequest, RenameResult } from '@shared/scan.js';

type RenameEntry = RenameRequest['renames'][number];

/** The renamed file's full path: `to` is a bare filename in `from`'s folder. */
export function renameDestination({ from, to }: RenameEntry): string {
  return join(dirname(from), to);
}

async function fileIdentity(path: string): Promise<string | null> {
  try {
    const { dev, ino } = await stat(path, { bigint: true });
    return `${dev}:${ino}`;
  } catch (err) {
    const isMissing = err instanceof Error && 'code' in err && err.code === 'ENOENT';
    if (isMissing) return null;
    throw err;
  }
}

/** A rename onto an existing file would silently overwrite it. */
async function isDestinationTaken(entry: RenameEntry): Promise<boolean> {
  const taken = await fileIdentity(renameDestination(entry));
  if (taken === null) return false;
  // On a case-insensitive disk, a name that only changes case finds itself.
  const isCaseChange = basename(entry.from).toLowerCase() === entry.to.toLowerCase();
  return !isCaseChange || taken !== (await fileIdentity(entry.from));
}

/**
 * Renames in order, leaving alone the files whose destination is taken —
 * each is checked at its turn, so a name freed or taken earlier in the batch
 * counts. Stops at the first disk failure and puts back the files
 * already renamed (best effort), so a failed batch changes nothing.
 */
export async function renameWithRollback(renames: RenameEntry[]): Promise<RenameResult> {
  const done: RenameEntry[] = [];
  const skipped: RenameResult['skipped'] = [];
  for (const entry of renames) {
    try {
      if (await isDestinationTaken(entry)) {
        logger.warn({ from: entry.from, to: entry.to }, 'rename skipped, destination exists');
        skipped.push({ entry, reason: 'destination-exists' });
        continue;
      }
      await rename(entry.from, renameDestination(entry));
      done.push(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ from: entry.from, to: entry.to, err }, 'rename failed, rolling back');
      const rolledBack = await rollBack(done);
      return { done, failed: [{ entry, error: message }], skipped, rolledBack };
    }
  }
  logger.info({ files: done.length, skipped: skipped.length }, 'files renamed');
  return { done, failed: [], skipped, rolledBack: [] };
}

async function rollBack(done: RenameEntry[]): Promise<string[]> {
  const rolledBack: string[] = [];
  // Last first: an earlier rename may have freed the name of a later one.
  for (const completed of [...done].reverse()) {
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
