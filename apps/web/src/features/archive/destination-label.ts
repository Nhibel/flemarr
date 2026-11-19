import type { DownloadTarget } from '@shared/download.js';
import { displayPath } from '@/lib/paths.js';

/**
 * Where the download button's files will land, shown next to it. Null for a
 * server download with no system folder: the missing-folder notice already
 * says so, and the button is disabled.
 */
export function destinationLabel(
  target: DownloadTarget,
  destinationDir: string,
  romsRoot: string | null,
): string | null {
  if (target === 'browser') return '→ Mon navigateur';
  if (destinationDir === '') return null;
  return `→ ${displayPath(destinationDir, romsRoot)}`;
}
