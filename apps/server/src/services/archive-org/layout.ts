import type { ArchiveFile, ArchiveLayout } from '@shared/archive.js';
import { isArchiveContainer } from './system-name.js';

// archive.org adds bookkeeping files to every item — they say nothing about
// how the ROMs themselves are stored, so they're excluded from the ratio.
const METADATA_PATTERNS = [
  /_meta\.(xml|sqlite)$/i,
  /_files\.xml$/i,
  /_reviews\.xml$/i,
  /\.torrent$/i,
  /_archive\.torrent$/i,
  /_thumb\.(jpg|png)$/i,
  /\.(sqlite|log)$/i,
];

function isMetadataFile(name: string): boolean {
  return METADATA_PATTERNS.some((re) => re.test(name));
}

/**
 * Guess how a collection stores its ROMs from its file list: a majority of
 * archive files (.zip, .7z) means the ROMs live inside them (Pattern B/C),
 * anything else is treated as individual files (Pattern A). Missing .7z
 * here once meant every Redump rr-sony-playstation-* style collection
 * (per-game .7z, not .zip) was mis-detected as `direct` — which then let
 * the direct-layout name match (resolver.ts's findMatch) treat a compressed
 * .7z itself as if it were the raw ROM inside it.
 */
export function detectLayout(files: ArchiveFile[]): ArchiveLayout {
  const relevant = files.filter((f) => !isMetadataFile(f.name));
  if (relevant.length === 0) return 'direct';

  const archiveCount = relevant.filter((f) => isArchiveContainer(f)).length;

  return archiveCount / relevant.length >= 0.5 ? 'zip-collection' : 'direct';
}
