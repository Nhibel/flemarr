import { rmdir } from 'node:fs/promises';
import { logger } from '@/lib/logger.js';
import type { DownloadJobState } from './job-store.js';

type JobDestination = Pick<DownloadJobState, 'status' | 'target' | 'destinationDir'>;

/**
 * Whether another running server-target job still downloads into the same
 * library folder, and so may still need its staging dir.
 */
export function isStagingDirShared(
  jobId: string,
  destinationDir: string,
  jobs: Iterable<[string, JobDestination]>,
): boolean {
  for (const [otherId, other] of jobs) {
    const isOtherRunningJob = otherId !== jobId && other.status === 'running';
    if (isOtherRunningJob && other.target === 'server' && other.destinationDir === destinationDir) {
      return true;
    }
  }
  return false;
}

/**
 * Removes a library folder's staging dir once a job is over, so an empty
 * `.flemarr-tmp` does not stay behind next to the user's games.
 *
 * `rmdir`, not a recursive `rm`: it only ever removes an empty folder. A
 * file still in there is one this job did not expect (a cancelled item
 * still being deleted, another job), and is left alone. A missing dir is
 * fine too — the job may have failed before creating it.
 */
export async function removeStagingDirIfEmpty(stagingDir: string): Promise<void> {
  try {
    await rmdir(stagingDir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTEMPTY' || code === 'EEXIST') return;
    logger.warn({ err: error, dir: stagingDir }, 'could not remove the staging dir');
  }
}
