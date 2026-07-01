import { cpus } from 'node:os';
import { randomUUID } from 'node:crypto';
import { getDat } from '@/services/dat/index.js';
import { computeCrc32 } from '@/lib/crc32.js';
import { buildCrcIndex, matchFiles } from './matcher.js';
import { walkDir } from './walk.js';
import type { ScanResult, ScanEvent } from '@shared/scan.js';

export type ScanJobState =
  | { status: 'running'; events: ScanEvent[] }
  | { status: 'done'; events: ScanEvent[]; result: ScanResult }
  | { status: 'error'; events: ScanEvent[]; message: string };

const CONCURRENCY = Math.max(1, cpus().length);
const PROGRESS_INTERVAL = 50;

export const scanJobs = new Map<string, ScanJobState>();

export async function runScan(datId: string, directory: string): Promise<string> {
  const dat = getDat(datId);
  if (dat === undefined) throw new Error(`DAT ${datId} not found`);

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

      // Process in chunks of CONCURRENCY
      for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
        const chunk = filePaths.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(
          chunk.map(async (filePath) => {
            const crc = await computeCrc32(filePath);
            return { filePath, crc };
          }),
        );
        results.push(...chunkResults);
        scanned += chunkResults.length;

        if (scanned % PROGRESS_INTERVAL === 0 || scanned === total) {
          const event: ScanEvent = { type: 'progress', scanned, total };
          events.push(event);
        }
      }

      const result = matchFiles(results, crcIndex);
      const doneEvent: ScanEvent = { type: 'done', result };
      events.push(doneEvent);
      scanJobs.set(jobId, { status: 'done', events, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorEvent: ScanEvent = { type: 'error', message };
      events.push(errorEvent);
      scanJobs.set(jobId, { status: 'error', events, message });
    }
  })();

  return jobId;
}
