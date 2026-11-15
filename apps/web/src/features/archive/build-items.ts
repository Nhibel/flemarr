import type { DownloadItem, DownloadSource } from '@shared/download.js';
import type { ResolveResponse } from '@/lib/api.js';
import type { ResolvedSource } from '@shared/archive.js';

/**
 * Turns a resolve result into the items a download request needs.
 *
 * Extracted from ResolvePanel so the retry path in DownloadManager builds
 * its items exactly the same way. A simplified copy there — "just take the
 * first source" — would quietly drop the fallbacks, so a retry would be
 * less likely to succeed than the attempt that already failed, which is
 * the opposite of what a retry is for.
 */

// ResolvedSource carries extra fields the wire schema rejects, and names
// the URL differently. innerPath/archiveFormat are only ever set on the
// archive-container kind; omitted otherwise.
function toDownloadSource(s: {
  downloadUrl: string;
  extractFromZip: boolean;
  innerPath?: string;
  archiveFormat?: 'zip' | '7z' | 'rar';
}): DownloadSource {
  return {
    url: s.downloadUrl,
    extractFromZip: s.extractFromZip,
    innerPath: s.innerPath,
    archiveFormat: s.archiveFormat,
  };
}

/**
 * One item per resolved ROM — multi-disc games queue every disc.
 *
 * Source order is the point: the preferred source first (the user's pick
 * via `selectedSourceIndex`, keyed `gameId/romName`, or the first match),
 * then that source's own fallback, then the other configured sources of
 * the same container kind. The downloader walks this list on network
 * failure, so the order is what makes a flaky collection survivable.
 */
export function buildDownloadItems(
  result: ResolveResponse,
  selectedSourceIndex: Map<string, number> = new Map(),
): DownloadItem[] {
  return result.results.flatMap((r) =>
    r.roms
      .filter((rom) => rom.sources.length > 0)
      .map((rom) => {
        const chosenIndex = selectedSourceIndex.get(`${r.gameId}/${rom.romName}`) ?? 0;
        const chosen: ResolvedSource = rom.sources[chosenIndex] ?? rom.sources[0]!;

        const sources: DownloadSource[] = [toDownloadSource(chosen)];
        if (chosen.fallback) {
          sources.push({
            url: chosen.fallback.downloadUrl,
            extractFromZip: chosen.fallback.extractFromZip,
          });
        }
        for (const s of rom.sources) {
          if (s === chosen || s.container !== chosen.container) continue;
          sources.push(toDownloadSource(s));
        }

        return {
          gameId: r.gameId,
          romName: rom.romName,
          expectedCrc: rom.expectedCrc,
          sources,
        };
      }),
  );
}
