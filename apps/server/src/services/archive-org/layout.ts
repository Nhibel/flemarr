import type { ArchiveFile, ArchiveLayout } from '@shared/archive.js';

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
 * .zip files means the ROMs live inside ZIPs (Pattern B), anything else is
 * treated as individual files (Pattern A).
 */
export function detectLayout(files: ArchiveFile[]): ArchiveLayout {
  const relevant = files.filter((f) => !isMetadataFile(f.name));
  if (relevant.length === 0) return 'direct';

  const zipCount = relevant.filter(
    (f) => f.format?.toUpperCase() === 'ZIP' || f.name.toLowerCase().endsWith('.zip'),
  ).length;

  return zipCount / relevant.length >= 0.5 ? 'zip-collection' : 'direct';
}
