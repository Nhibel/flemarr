import { accessSync, constants } from 'node:fs';
import { logger } from '@/lib/logger.js';

/**
 * Logs a library folder the server cannot write to: in Docker it runs as UID
 * 1000, and every download or rename would fail one by one with EACCES.
 */
export function warnIfNotWritable(directory: string): void {
  try {
    accessSync(directory, constants.R_OK | constants.W_OK);
  } catch (err) {
    logger.warn(
      { directory, uid: process.getuid?.(), err },
      'library folder missing or not writable by the server',
    );
  }
}
