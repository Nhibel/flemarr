import type { DatFile } from '@shared/dat.js';
import type { ResolvedGame, ResolvedSource } from '@shared/archive.js';
import { getSources } from './sources.js';
import { getItemInfo, resolveDownloadUrl, resolveZipViewUrl } from './metadata.js';
import type { ArchiveItemInfo } from './metadata.js';
import { urlExists } from './url-check.js';
import { getZipListing } from './zip-listing.js';
import {
  baseName,
  isReencodedDump,
  stripExtension,
  zipMatchesSystem,
  zipSystemMatch,
} from './system-name.js';
import { logger } from '@/lib/logger.js';
import type { ArchiveFile } from '@shared/archive.js';

const NEGATIVE_TTL_MS = 15 * 60 * 1000;
// Upper bound on HEAD checks per game and per source — keeps a resolve run
// over a big monolithic-ZIP collection from stalling on dozens of requests.
const MAX_ZIP_HEAD_CHECKS = 5;

interface ResultCacheEntry {
  result: ResolvedGame;
  expiresAt: number;
}

// Keyed by `${datId}:${gameId}`
const resultCache = new Map<string, ResultCacheEntry>();

function getCached(datId: string, gameId: string): ResolvedGame | undefined {
  const entry = resultCache.get(`${datId}:${gameId}`);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    resultCache.delete(`${datId}:${gameId}`);
    return undefined;
  }
  return entry.result;
}

function setCached(datId: string, gameId: string, result: ResolvedGame, ttlMs: number): void {
  resultCache.set(`${datId}:${gameId}`, { result, expiresAt: Date.now() + ttlMs });
}

export function clearResolverCache(): void {
  resultCache.clear();
}

// Match a rom against a flat list of archive files.
// Priority: CRC match (a real guarantee), then filename match (subdirectory
// paths compare by basename, extension ignored — a DAT variant's naming
// convention doesn't always match real uploads, e.g. a NES "Headerless" DAT
// names its roms "*.unh", which no archive.org upload ever uses, while the
// real file is "*.nes") — a plausible guess, not a guarantee; see the
// "Name-only matches" section of docs/archive-org-strategy.md for why this
// matters.
function findMatch(
  romName: string,
  romCrc: string,
  files: ArchiveFile[],
): { file: ArchiveFile; verified: boolean } | undefined {
  const crcLower = romCrc.toLowerCase();
  const byCrc = files.find((f) => f.crc32?.toLowerCase() === crcLower);
  if (byCrc) return { file: byCrc, verified: true };
  const romBase = stripExtension(romName);
  // A re-encode (.chd, .rvz…) carries the game but never the DAT's exact
  // bytes — matching one by name here would hand the downloader a file
  // guaranteed to fail its CRC check (see system-name.ts's isReencodedDump).
  const byName = files.find(
    (f) => !isReencodedDump(f.name) && stripExtension(baseName(f.name)) === romBase,
  );
  return byName ? { file: byName, verified: false } : undefined;
}

// For zip-collection sources, find the ZIP files in the index.
function findZipFiles(files: ArchiveFile[]): ArchiveFile[] {
  return files.filter(
    (f) => f.format?.toUpperCase() === 'ZIP' || f.name.toLowerCase().endsWith('.zip'),
  );
}

// Rank ZIPs by likelihood of containing the ROM:
// 1. named after the ROM, *or* after the game (per-game-zip uploads: a
//    multi-track Redump disc is one ".cue" plus one ".bin" per track, all
//    bundled in a single zip named after the game itself, e.g. "Bloody Roar
//    (USA).zip" — every track's own romName carries a "(Track N)" suffix
//    the zip's name never has, so only the .cue's bare name happens to
//    match romBase directly; without also checking gameName, a 2586-zip
//    collection's sort has no signal at all for the .bin tracks and the
//    right zip can land far outside the top MAX_ZIP_HEAD_CHECKS. Mirrors
//    suggest.ts's gameMatchesByName so scoring and resolution agree),
// 2. named exactly after the system (one-zip-per-system collections),
// 3. merely mentioning the system — which a longer system's ZIP does too
//    ("Game Boy Advance" mentions "Game Boy"), so it must come after 2,
// 4. everything else.
// Is this ZIP named exactly after the ROM or the game it belongs to?
function isExactZipMatch(zip: ArchiveFile, romBase: string, gameName: string): boolean {
  const zipBase = stripExtension(baseName(zip.name));
  return zipBase === romBase || zipBase === gameName;
}

function orderZipCandidates(
  zips: ArchiveFile[],
  romName: string,
  gameName: string,
  system: string,
): ArchiveFile[] {
  const romBase = stripExtension(romName);
  const rank = (z: ArchiveFile): number => {
    if (isExactZipMatch(z, romBase, gameName)) return 0;
    const match = zipSystemMatch(z.name, system);
    if (match === 'exact') return 1;
    if (match === 'loose') return 2;
    return 3;
  };
  return [...zips].sort((a, b) => rank(a) - rank(b));
}

// Restricted/darked items: their /download/ path 403s, so resolve through the
// datanode's view_archive by matching the ROM against the ZIP's inner listing.
// The listing gives exact inner names (ni-roms re-zips "Game.md" as "Game.zip").
async function resolveViaZipListing(
  romName: string,
  gameName: string,
  system: string,
  identifier: string,
  info: ArchiveItemInfo,
): Promise<ResolvedSource | null> {
  if (!info.server || !info.dir) return null;

  const romBase = stripExtension(romName);
  // The system-name filter exists to avoid wasting the slice(0, 2) below on
  // unrelated zips when a *multi-system* restricted item (ni-roms,
  // proper1g1r-collection) bundles many systems' zips together. It must not
  // reject a zip that already matched by exact name: a Redump per-game zip
  // ("Bloody Roar (USA).zip") never mentions "PlayStation" in its own name,
  // while plenty of unrelated games' zips coincidentally do (a tie-in demo
  // subtitled "(PlayStation Taiou)", a magazine disc named "Essential
  // PlayStation 1 (Europe)") — filtering on system-name alone let those
  // unrelated zips take the only two candidate slots and the real match
  // never got probed at all.
  const zips = orderZipCandidates(findZipFiles(info.files), romName, gameName, system).filter(
    (z) => isExactZipMatch(z, romBase, gameName) || zipMatchesSystem(z.name, system),
  );

  for (const zip of zips.slice(0, 2)) {
    let entries: string[];
    try {
      entries = await getZipListing(info.server, info.dir, zip.name);
    } catch {
      continue;
    }
    // Match by basename: inner is "<rom>.zip" (re-zipped), the raw ROM name,
    // or the game's own name (a multi-track disc re-zipped as one entry —
    // see orderZipCandidates). Re-encoded entries (.chd, .rvz…) are excluded
    // for the same reason as findMatch above — they'd never pass the
    // downloader's CRC check.
    const inner = entries.find((e) => {
      if (isReencodedDump(e)) return false;
      const base = stripExtension(baseName(e));
      return base === romBase || base === gameName;
    });
    if (inner) {
      return {
        identifier,
        downloadUrl: resolveZipViewUrl(info.server, info.dir, zip.name, inner),
        container: 'zip-view',
        // The inner entry's own name says whether view_archive's extract is
        // itself a ZIP (ni-roms-style re-zipping, "Game.zip") or already the
        // raw ROM (Redump-style per-game ZIPs, "Game (Track 1).bin") — see
        // the extractFromZip comment on resolvedSourceSchema.
        extractFromZip: inner.toLowerCase().endsWith('.zip'),
        // A datanode listing only gives names, never hashes — always a guess.
        verified: false,
      };
    }
  }
  return null;
}

async function resolveRomInSource(
  romName: string,
  romCrc: string,
  gameName: string,
  system: string,
  source: { identifier: string; layout: 'direct' | 'zip-collection' },
  info: ArchiveItemInfo,
): Promise<ResolvedSource | null> {
  const files = info.files;
  if (source.layout === 'direct') {
    const match = findMatch(romName, romCrc, files);
    if (!match) return null;
    return {
      identifier: source.identifier,
      downloadUrl: resolveDownloadUrl(source.identifier, match.file.name),
      container: 'direct',
      extractFromZip: false,
      verified: match.verified,
    };
  }

  // Restricted items can't be HEAD-probed anonymously — go through the datanode
  // listing instead.
  if (info.restricted) {
    return resolveViaZipListing(romName, gameName, system, source.identifier, info);
  }

  // Public zip-collection — probe candidate ZIPs (best first) and keep the
  // first one that actually contains the ROM, instead of guessing blindly.
  const candidates = orderZipCandidates(findZipFiles(files), romName, gameName, system).slice(
    0,
    MAX_ZIP_HEAD_CHECKS,
  );
  for (const zip of candidates) {
    // ZIPs often prefix entries with a folder named like the archive itself
    const folderPrefix = stripExtension(baseName(zip.name));
    for (const entryPath of [romName, `${folderPrefix}/${romName}`]) {
      const downloadUrl = resolveDownloadUrl(source.identifier, entryPath, zip.name);
      if (await urlExists(downloadUrl)) {
        // A HEAD check confirms the path exists, never the content's hash.
        return {
          identifier: source.identifier,
          downloadUrl,
          container: 'zip-entry',
          extractFromZip: false,
          verified: false,
        };
      }
    }
  }
  logger.debug({ romName, identifier: source.identifier }, 'rom not found in zip candidates');
  return null;
}

async function resolveOneGame(dat: DatFile, gameId: string): Promise<ResolvedGame> {
  const game = dat.games.find((g) => g.id === gameId);
  if (!game) {
    return { gameId, gameName: '', roms: [] };
  }

  const sources = getSources(dat.system);
  const roms: ResolvedGame['roms'] = [];

  // Every ROM of the game is resolved — multi-disc games need all discs.
  for (const rom of game.roms) {
    // nodump ROMs have no CRC — nothing to search for or validate against,
    // so they're listed with no sources rather than queried (see
    // docs/dat-format.md). expectedCrc is unused here since sources stays
    // empty.
    if (rom.crc === undefined) {
      roms.push({ romName: rom.name, expectedCrc: '', sources: [] });
      continue;
    }

    const resolvedSources: ResolvedSource[] = [];
    for (const source of sources) {
      let info: ArchiveItemInfo;
      try {
        info = await getItemInfo(source.identifier);
      } catch {
        // Source unreachable — skip, don't fail the whole resolution
        continue;
      }
      const resolved = await resolveRomInSource(
        rom.name,
        rom.crc,
        game.name,
        dat.system,
        source,
        info,
      );
      if (resolved) resolvedSources.push(resolved);
    }
    roms.push({ romName: rom.name, expectedCrc: rom.crc, sources: resolvedSources });
  }

  return { gameId, gameName: game.name, roms };
}

export async function resolveGames(
  dat: DatFile,
  datId: string,
  gameIds: string[],
): Promise<ResolvedGame[]> {
  const results: ResolvedGame[] = [];

  for (const gameId of gameIds) {
    const cached = getCached(datId, gameId);
    if (cached) {
      results.push(cached);
      continue;
    }

    const resolved = await resolveOneGame(dat, gameId);
    // Fully-resolved games cached long (invalidated when sources change);
    // partial or empty results cached 15 minutes
    const complete = resolved.roms.length > 0 && resolved.roms.every((r) => r.sources.length > 0);
    const ttl = complete ? 24 * 60 * 60 * 1000 : NEGATIVE_TTL_MS;
    setCached(datId, gameId, resolved, ttl);
    results.push(resolved);
  }

  return results;
}
