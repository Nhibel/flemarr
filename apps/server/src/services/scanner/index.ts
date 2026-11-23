import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/logger.js';
import { getDat } from '@/services/dat/index.js';
import { scanFiles } from './scan-files.js';
import { walkDir } from './walk.js';
import { saveLastScan } from './last-scan.js';
import type { ScanResult, ScanEvent } from '@shared/scan.js';

export type ScanJobState =
  | { status: 'running'; events: ScanEvent[] }
  | { status: 'done'; events: ScanEvent[]; result: ScanResult; completedAt: number }
  | { status: 'error'; events: ScanEvent[]; message: string; completedAt: number };

const JOB_RETENTION_MS = 30 * 60 * 1000;

export const scanJobs = new Map<string, ScanJobState>();

function evictOldJobs(): void {
  const cutoff = Date.now() - JOB_RETENTION_MS;
  for (const [id, job] of scanJobs) {
    if (job.status !== 'running' && job.completedAt < cutoff) {
      scanJobs.delete(id);
    }
  }
}

export async function runScan(datId: string, directory: string): Promise<string> {
  const dat = getDat(datId);
  if (dat === undefined) throw new Error(`DAT ${datId} not found`);

  evictOldJobs();
  const jobId = randomUUID();
  const events: ScanEvent[] = [];
  scanJobs.set(jobId, { status: 'running', events });

  const start = Date.now();
  logger.info({ jobId, datId, directory }, 'scan started');

  // Run in background — caller gets jobId immediately
  (async () => {
    try {
      // Collect all file paths first so we know the total
      const filePaths: string[] = [];
      for await (const p of walkDir(directory)) filePaths.push(p);

      const result = await scanFiles(filePaths, dat, (progress) => {
        events.push({ type: 'progress', ...progress });
      });
      const doneEvent: ScanEvent = { type: 'done', result };
      const completedAt = Date.now();
      // Stored before the done event goes out, so a client refetching on
      // that event reads this scan.
      saveLastScan(datId, directory, result, completedAt);
      logger.info(
        {
          jobId,
          datId,
          files: filePaths.length,
          matched: result.matched.length,
          wrongName: result.wrongName.length,
          unmatched: result.unmatched.length,
          ms: Date.now() - start,
        },
        'scan done',
      );
      events.push(doneEvent);
      scanJobs.set(jobId, { status: 'done', events, result, completedAt });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ jobId, datId, directory, err }, 'scan failed');
      const errorEvent: ScanEvent = { type: 'error', message };
      events.push(errorEvent);
      scanJobs.set(jobId, { status: 'error', events, message, completedAt: Date.now() });
    }
  })();

  return jobId;
}
