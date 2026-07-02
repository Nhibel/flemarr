import type { DatFile } from '@shared/dat.js';
import type { ResolvedGame, ResolvedSource } from '@shared/archive.js';
import { getSources } from './sources.js';
import { getIndex, resolveDownloadUrl } from './metadata.js';
import { urlExists } from './url-check.js';
import { baseName, stripExtension, zipMatchesSystem } from './system-name.js';
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
// Priority: CRC match, then filename match (subdirectory paths compare by basename).
function findMatch(romName: string, romCrc: string, files: ArchiveFile[]): ArchiveFile | undefined {
  const crcLower = romCrc.toLowerCase();
  const byCrc = files.find((f) => f.crc32?.toLowerCase() === crcLower);
  if (byCrc) return byCrc;
  return files.find((f) => baseName(f.name) === romName);
}

// For zip-collection sources, find the ZIP files in the index.
function findZipFiles(files: ArchiveFile[]): ArchiveFile[] {
  return files.filter(
    (f) => f.format?.toUpperCase() === 'ZIP' || f.name.toLowerCase().endsWith('.zip'),
  );
}

// Rank ZIPs by likelihood of containing the ROM:
// 1. named after the ROM (per-game-zip uploads),
// 2. named after the system (one-zip-per-system collections),
// 3. everything else.
function orderZipCandidates(zips: ArchiveFile[], romName: string, system: string): ArchiveFile[] {
  const romBase = stripExtension(romName);
  const rank = (z: ArchiveFile): number => {
    if (stripExtension(baseName(z.name)) === romBase) return 0;
    if (zipMatchesSystem(z.name, system)) return 1;
    return 2;
  };
  return [...zips].sort((a, b) => rank(a) - rank(b));
}

async function resolveRomInSource(
  romName: string,
  romCrc: string,
  system: string,
  source: { identifier: string; layout: 'direct' | 'zip-collection' },
  files: ArchiveFile[],
): Promise<ResolvedSource | null> {
  if (source.layout === 'direct') {
    const match = findMatch(romName, romCrc, files);
    if (!match) return null;
    return {
      identifier: source.identifier,
      downloadUrl: resolveDownloadUrl(source.identifier, match.name),
      container: 'direct',
    };
  }

  // zip-collection — probe candidate ZIPs (best first) and keep the first
  // one that actually contains the ROM, instead of guessing blindly.
  const candidates = orderZipCandidates(findZipFiles(files), romName, system).slice(
    0,
    MAX_ZIP_HEAD_CHECKS,
  );
  for (const zip of candidates) {
    // ZIPs often prefix entries with a folder named like the archive itself
    const folderPrefix = stripExtension(baseName(zip.name));
    for (const entryPath of [romName, `${folderPrefix}/${romName}`]) {
      const downloadUrl = resolveDownloadUrl(source.identifier, entryPath, zip.name);
      if (await urlExists(downloadUrl)) {
        return { identifier: source.identifier, downloadUrl, container: 'zip-entry' };
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
    const resolvedSources: ResolvedSource[] = [];
    for (const source of sources) {
      let files: ArchiveFile[];
      try {
        files = await getIndex(source.identifier);
      } catch {
        // Source unreachable — skip, don't fail the whole resolution
        continue;
      }
      const resolved = await resolveRomInSource(rom.name, rom.crc, dat.system, source, files);
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
