import type { DatFile } from '@shared/dat.js';
import type { ResolvedGame, ResolvedSource } from '@shared/archive.js';
import { getSources } from './sources.js';
import { getIndex, resolveDownloadUrl } from './metadata.js';
import { urlExists } from './url-check.js';
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
// Priority: CRC match, then exact filename match.
function findMatch(romName: string, romCrc: string, files: ArchiveFile[]): ArchiveFile | undefined {
  const crcLower = romCrc.toLowerCase();
  const byCrc = files.find((f) => f.crc32?.toLowerCase() === crcLower);
  if (byCrc) return byCrc;
  return files.find((f) => f.name === romName);
}

// For zip-collection sources, find the ZIP files in the index.
function findZipFiles(files: ArchiveFile[]): ArchiveFile[] {
  return files.filter(
    (f) => f.format?.toUpperCase() === 'ZIP' || f.name.toLowerCase().endsWith('.zip'),
  );
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

// Per-game-zip uploads name each ZIP after the ROM it contains — a basename
// match is almost certainly the right archive, so it goes first in line.
function orderZipCandidates(zips: ArchiveFile[], romName: string): ArchiveFile[] {
  const romBase = stripExtension(romName);
  return [
    ...zips.filter((z) => stripExtension(z.name) === romBase),
    ...zips.filter((z) => stripExtension(z.name) !== romBase),
  ];
}

async function resolveOneGame(dat: DatFile, gameId: string): Promise<ResolvedGame> {
  const game = dat.games.find((g) => g.id === gameId);
  if (!game) {
    return { gameId, romName: '', expectedCrc: '', sources: [] };
  }

  // Use the first ROM as the canonical one (multi-disc games have multiple ROMs but
  // the first is the most relevant for matching purposes).
  const rom = game.roms[0];
  if (!rom) {
    return { gameId, romName: '', expectedCrc: '', sources: [] };
  }

  const sources = getSources(dat.system);
  const resolvedSources: ResolvedSource[] = [];

  for (const source of sources) {
    let files: ArchiveFile[];
    try {
      files = await getIndex(source.identifier);
    } catch {
      // Source unreachable — skip, don't fail the whole resolution
      continue;
    }

    if (source.layout === 'direct') {
      const match = findMatch(rom.name, rom.crc, files);
      if (match) {
        resolvedSources.push({
          identifier: source.identifier,
          downloadUrl: resolveDownloadUrl(source.identifier, match.name),
          container: 'direct',
        });
      }
    } else {
      // zip-collection — probe candidate ZIPs (best first) and keep the first
      // one that actually contains the ROM, instead of guessing blindly.
      const candidates = orderZipCandidates(findZipFiles(files), rom.name).slice(
        0,
        MAX_ZIP_HEAD_CHECKS,
      );
      for (const zip of candidates) {
        const downloadUrl = resolveDownloadUrl(source.identifier, rom.name, zip.name);
        if (await urlExists(downloadUrl)) {
          resolvedSources.push({
            identifier: source.identifier,
            downloadUrl,
            container: 'zip-entry',
          });
          break;
        }
      }
    }
  }

  return {
    gameId,
    romName: rom.name,
    expectedCrc: rom.crc,
    sources: resolvedSources,
  };
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
    // Positive results cached for the session (no TTL limit — invalidated by adding/removing sources)
    // Negative results cached for 15 minutes
    const ttl = resolved.sources.length > 0 ? 24 * 60 * 60 * 1000 : NEGATIVE_TTL_MS;
    setCached(datId, gameId, resolved, ttl);
    results.push(resolved);
  }

  return results;
}
