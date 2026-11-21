import { cpus } from 'node:os';
import { randomUUID } from 'node:crypto';
import { getDat } from '@/services/dat/index.js';
import { computeCrc32 } from '@/lib/crc32.js';
import { buildCrcIndex, matchFiles } from './matcher.js';
import { matchChdFile } from './chd-match.js';
import { walkDir } from './walk.js';
import { saveLastScan } from './last-scan.js';
import type { ScanResult, ScanEvent } from '@shared/scan.js';

export type ScanJobState =
  | { status: 'running'; events: ScanEvent[] }
  | { status: 'done'; events: ScanEvent[]; result: ScanResult; completedAt: number }
  | { status: 'error'; events: ScanEvent[]; message: string; completedAt: number };

const CONCURRENCY = Math.max(1, cpus().length);
const PROGRESS_INTERVAL = 50;
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

  // Run in background — caller gets jobId immediately
  (async () => {
    try {
      const crcIndex = buildCrcIndex(dat);

      // Collect all file paths first so we know the total
      const filePaths: string[] = [];
      for await (const p of walkDir(directory)) filePaths.push(p);

      const total = filePaths.length;
      let scanned = 0;
      const results: { filePath: string; crc: string }[] = [];
      // .chd files never hash to a DAT CRC directly (chdman exposes no
      // per-track hash to read instead — confirmed hands-on, see
      // chd-match.ts) and must never flow through matchFiles' ordinary
      // name-equality check (a .chd's name can't equal any single
      // original rom's name by design) — matched entirely separately.
      const chdMatched: { filePath: string; gameName: string; romName: string; crc: string }[] = [];

      // Process in chunks of CONCURRENCY
      for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
        const chunk = filePaths.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(
          chunk.map(async (filePath) => {
            if (filePath.toLowerCase().endsWith('.chd')) {
              chdMatched.push(...(await matchChdFile(filePath, crcIndex)));
              return undefined;
            }
            const crc = await computeCrc32(filePath);
            return { filePath, crc };
          }),
        );
        for (const r of chunkResults) if (r) results.push(r);
        scanned += chunkResults.length;

        if (scanned % PROGRESS_INTERVAL === 0 || scanned === total) {
          const event: ScanEvent = { type: 'progress', scanned, total };
          events.push(event);
        }
      }

      const result = matchFiles(results, crcIndex);
      result.matched.push(...chdMatched);
      const doneEvent: ScanEvent = { type: 'done', result };
      const completedAt = Date.now();
      // Stored before the done event goes out, so a client refetching on
      // that event reads this scan.
      saveLastScan(datId, directory, result, completedAt);
      events.push(doneEvent);
      scanJobs.set(jobId, { status: 'done', events, result, completedAt });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorEvent: ScanEvent = { type: 'error', message };
      events.push(errorEvent);
      scanJobs.set(jobId, { status: 'error', events, message, completedAt: Date.now() });
    }
  })();

  return jobId;
}
