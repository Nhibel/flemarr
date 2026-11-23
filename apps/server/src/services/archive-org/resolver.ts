import type { DatFile } from '@shared/dat.js';
import type {
  ArchiveSource,
  ConfiguredSource,
  ResolvedGame,
  ResolvedSource,
} from '@shared/archive.js';
import { getSources } from './sources.js';
import { getItemInfo, resolveDownloadUrl, resolveZipViewUrl } from './metadata.js';
import type { ArchiveItemInfo } from './metadata.js';
import { urlExists } from './url-check.js';
import { itemIndex, zipRanks } from './item-index.js';
import type { ItemIndex } from './item-index.js';
import { getZipListing } from './zip-listing.js';
import {
  baseName,
  containerFormat,
  extensionOf,
  isReencodedDump,
  stripExtension,
} from './system-name.js';
import { networkErrorReason } from '@/lib/logged-fetch.js';
import { logger } from '@/lib/logger.js';
import { mapInBatches } from '@/lib/batches.js';
import type { ArchiveFile } from '@shared/archive.js';

const NEGATIVE_TTL_MS = 15 * 60 * 1000;
// Upper bound on HEAD checks per game and per source — keeps a resolve run
// over a big monolithic-ZIP collection from stalling on dozens of requests.
const MAX_ZIP_HEAD_CHECKS = 5;
// Requests to archive.org in flight at once: item metadata before a run,
// then each ROM's lookup in every source. A few at a time stays polite to
// archive.org, which answers bursts with 429.
const ARCHIVE_CONCURRENCY = 6;

interface ResultCacheEntry {
  result: ResolvedGame;
  expiresAt: number;
}

// Keyed by game AND by the sources searched: a run limited to one source
// must never be served back to a run over all of them (it would hide what
// the other sources have), nor the other way round.
const resultCache = new Map<string, ResultCacheEntry>();

function cacheKey(datId: string, gameId: string, scope: string): string {
  return `${datId}:${gameId}:${scope}`;
}

function getCached(key: string): ResolvedGame | undefined {
  const entry = resultCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    resultCache.delete(key);
    return undefined;
  }
  return entry.result;
}

function setCached(key: string, result: ResolvedGame, ttlMs: number): void {
  resultCache.set(key, { result, expiresAt: Date.now() + ttlMs });
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
  index: ItemIndex,
  siblingExtensions: Set<string>,
): { file: ArchiveFile; verified: boolean } | undefined {
  const byCrc = index.byCrc.get(romCrc.toLowerCase());
  if (byCrc) return { file: byCrc, verified: true };
  const romBase = stripExtension(romName);
  // A re-encode (.chd, .rvz…) carries the game but never the DAT's exact
  // bytes — matching one by name here would hand the downloader a file
  // guaranteed to fail its CRC check (see system-name.ts's isReencodedDump).
  // An archive container (.zip, .7z) is excluded for a different reason: it
  // might genuinely *hold* the ROM, but it isn't the ROM — a `direct`-layout
  // source is only ever supposed to list raw files, so a container showing
  // up here means the layout was mis-detected (see layout.ts's
  // detectLayout), not that this is a real match. This is what actually
  // broke "Bloody Roar II" on a rr-sony-playstation-* source: its per-game
  // .7z files weren't recognized, got the whole collection mis-detected as
  // `direct`, and then matched the compressed .7z itself as the "found" ROM
  // — fast to download (no extraction) and guaranteed to fail CRC.
  const byNameCandidates = index.rawFilesByBase.get(romBase) ?? [];
  // A disc game's own sibling files (one .cue plus N .bin tracks) often
  // share this exact stripped base — "Bloody Roar II (USA).bin" and
  // "Bloody Roar II (USA).cue" both reduce to "Bloody Roar II (USA)" for a
  // single-track game. Without preferring the exact (extension-included)
  // name first, resolving the .cue ROM could silently return the .bin file
  // instead, since both satisfy the stripped-base filter above. The
  // fallback to a mismatched-extension candidate (the genuine case: a NES
  // Headerless DAT's "*.unh" vs the real "*.nes" upload, where there's only
  // ever one real file per game) must not pick up a sibling rom's own file
  // instead — excluding any extension that belongs to one of this game's
  // *other* roms catches a disc game's .bin standing in for a missing .cue
  // (a real bug found live: rr-sony-playstation-u stores Bloody Roar II's
  // .cue under a truncated inner name, "Roar II (USA).cue" — not matching
  // the DAT's expected romBase at all — so without this check, every other
  // candidate sharing the romBase/gameName "Bloody Roar II (USA)" base, i.e.
  // the .bin, would be wrongly accepted as the .cue's download; the CRC
  // check would catch it before anything got corrupted, but only after
  // downloading hundreds of MB to find out).
  const byName =
    byNameCandidates.find((f) => baseName(f.name) === romName) ??
    byNameCandidates.find((f) => !siblingExtensions.has(extensionOf(f.name)));
  return byName ? { file: byName, verified: false } : undefined;
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

// The first `limit` containers in that order, each rank in item order —
// what a stable sort by rank gave, without sorting every container of the
// item for every ROM. `systemOnly` stops before rank 4.
function orderZipCandidates(
  index: ItemIndex,
  romName: string,
  gameName: string,
  system: string,
  { limit, systemOnly }: { limit: number; systemOnly: boolean },
): ArchiveFile[] {
  const romBase = stripExtension(romName);
  const exactPositions = new Set([
    ...(index.zipPositionsByBase.get(romBase) ?? []),
    ...(index.zipPositionsByBase.get(gameName) ?? []),
  ]);
  const ranks = zipRanks(index, system);
  const rankedGroups = [ranks.exact, ranks.loose];
  if (!systemOnly) rankedGroups.push(ranks.none);

  const ordered = [...exactPositions].sort((a, b) => a - b);
  for (const group of rankedGroups) {
    for (const position of group) {
      if (ordered.length >= limit) break;
      if (!exactPositions.has(position)) ordered.push(position);
    }
  }
  return ordered.slice(0, limit).map((position) => index.zips[position]!);
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
  siblingExtensions: Set<string>,
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
  const zips = orderZipCandidates(itemIndex(info), romName, gameName, system, {
    limit: 2,
    systemOnly: true,
  });

  for (const zip of zips) {
    const archiveFormat = isExactZipMatch(zip, romBase, gameName)
      ? containerFormat(zip.name)
      : undefined;

    let entries: string[];
    try {
      entries = await getZipListing(info.server, info.dir, zip.name);
    } catch (err) {
      logger.warn({ identifier, zipName: zip.name, err }, 'zip listing unavailable');
      // The listing fetch failed — but an exact per-game match doesn't
      // actually need it for the fast path itself (only for an optional
      // zip-view fallback below), so don't give up on it over a transient
      // listing error.
      if (archiveFormat) {
        return {
          identifier,
          downloadUrl: resolveDownloadUrl(identifier, zip.name),
          container: 'archive-container',
          extractFromZip: false,
          innerPath: romName,
          archiveFormat,
          verified: false,
        };
      }
      continue;
    }
    // Match by basename: inner is "<rom>.zip" (re-zipped), the raw ROM name,
    // or the game's own name (a multi-track disc re-zipped as one entry —
    // see orderZipCandidates). Re-encoded entries (.chd, .rvz…) are excluded
    // for the same reason as findMatch above — they'd never pass the
    // downloader's CRC check.
    const innerCandidates = entries.filter((e) => {
      if (isReencodedDump(e)) return false;
      const base = stripExtension(baseName(e));
      return base === romBase || base === gameName;
    });
    // For a single-track disc game, romBase === gameName, so a .cue and its
    // .bin both pass the filter above — prefer the entry whose extension
    // also matches this specific rom before falling back to another
    // stripped-base match, and never fall back to one whose extension
    // belongs to a *sibling* rom of this same game (see findMatch's byName
    // for the full reasoning and the real rr-sony-playstation-u case this
    // catches).
    const inner =
      innerCandidates.find((e) => baseName(e) === romName) ??
      innerCandidates.find((e) => !siblingExtensions.has(extensionOf(e)));
    const zipView: ResolvedSource | undefined = inner
      ? {
          identifier,
          downloadUrl: resolveZipViewUrl(info.server, info.dir, zip.name, inner),
          container: 'zip-view',
          // The inner entry's own name says whether view_archive's extract is
          // itself a ZIP (ni-roms-style re-zipping, "Game.zip") or already
          // the raw ROM (Redump-style per-game ZIPs, "Game (Track 1).bin")
          // — see the extractFromZip comment on resolvedSourceSchema.
          extractFromZip: inner.toLowerCase().endsWith('.zip'),
          // A datanode listing only gives names, never hashes — always a guess.
          verified: false,
        }
      : undefined;

    // Per-game archive (Redump's rr-sony-* convention: the container is
    // named exactly after this rom or its game, never a system-wide
    // bundle) — the whole container can be fetched via the plain
    // /download/ URL, which works even on a restricted item once
    // authenticated (that's what the pre-fix "fast but wrong" bug was
    // actually hitting), and extracted locally instead of going through
    // view_archive.php's slow server-side extraction on every request.
    // Deliberately scoped to the exact-match case: a system-wide bundle
    // (ni-roms, proper1g1r-collection) must never be fetched whole just to
    // pull one game out of it.
    if (archiveFormat) {
      // innerPath is romName itself, not whatever (if anything) the listing
      // matched — confirmed live that view_archive.php's own HTML listing
      // can mis-render an entry's name (rr-sony-playstation-u truncated
      // "007 - Tomorrow Never Dies (USA).cue" to "- Tomorrow Never Dies
      // (USA).cue" in the listing itself, even though the real archive's
      // internal file name is correct — downloaded and opened by hand to
      // confirm). The archive-container path extracts locally via 7z-wasm,
      // which reads the archive's own real file table, not this listing —
      // so it doesn't need the listing to be right, only the DAT's Redump
      // naming convention to hold (it does, for every per-game archive
      // checked so far). A wrong guess here just fails to find the entry
      // (caught, falls through to the next candidate) — safe, since the
      // actual bytes are still verified by CRC either way.
      return {
        identifier,
        downloadUrl: resolveDownloadUrl(identifier, zip.name),
        container: 'archive-container',
        extractFromZip: false,
        innerPath: romName,
        archiveFormat,
        fallback: zipView,
        verified: false,
      };
    }

    if (zipView) return zipView;
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
  siblingExtensions: Set<string>,
): Promise<ResolvedSource | null> {
  const index = itemIndex(info);
  if (source.layout === 'direct') {
    const match = findMatch(romName, romCrc, index, siblingExtensions);
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
    return resolveViaZipListing(
      romName,
      gameName,
      system,
      source.identifier,
      info,
      siblingExtensions,
    );
  }

  // Public zip-collection — probe candidate ZIPs (best first) and keep the
  // first one that actually contains the ROM, instead of guessing blindly.
  const candidates = orderZipCandidates(index, romName, gameName, system, {
    limit: MAX_ZIP_HEAD_CHECKS,
    systemOnly: false,
  });
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

async function resolveOneGame(
  dat: DatFile,
  gameId: string,
  sources: ArchiveSource[],
): Promise<ResolvedGame> {
  const game = dat.games.find((g) => g.id === gameId);
  if (!game) {
    return { gameId, gameName: '', roms: [] };
  }

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

    // Extensions belonging to this game's *other* roms — a fallback match
    // (see findMatch/resolveViaZipListing) must never pick up a sibling
    // rom's own file by mistake (a disc's .bin standing in for its missing
    // .cue). Own extension excluded: a multi-track disc's tracks share the
    // same extension as each other, and that's not a sibling conflict.
    const siblingExtensions = new Set(
      game.roms.filter((r) => r !== rom).map((r) => extensionOf(r.name)),
    );
    siblingExtensions.delete(extensionOf(rom.name));

    // Every source at once (a few at a time): each lookup may open zip
    // listings over the network, and one source never depends on another.
    // Results keep the configured source order, which is the order the
    // downloader falls back in.
    const romCrc = rom.crc;
    const perSource = await mapInBatches(sources, ARCHIVE_CONCURRENCY, async (source) => {
      let info: ArchiveItemInfo;
      try {
        info = await getItemInfo(source.identifier);
      } catch (err) {
        // Reported once by prefetchItemInfo; per ROM it would flood the log.
        logger.debug({ identifier: source.identifier, romName: rom.name, err }, 'source skipped');
        // Source unreachable — skip, don't fail the whole resolution
        return null;
      }
      return resolveRomInSource(
        rom.name,
        romCrc,
        game.name,
        dat.system,
        source,
        info,
        siblingExtensions,
      );
    });
    const resolvedSources = perSource.filter(
      (resolved): resolved is ResolvedSource => resolved !== null,
    );
    roms.push({ romName: rom.name, expectedCrc: rom.crc, sources: resolvedSources });
  }

  return { gameId, gameName: game.name, roms };
}

// Loads every source's file list before the first game, a few in parallel.
// Fetched one by one inside the first ROM's loop, six sources cost the sum
// of six fetches (12 s on a cold PlayStation run) instead of the slowest.
// A failure is ignored here: the per-ROM lookup tries again and skips the
// source, as it always did.
async function prefetchItemInfo(identifiers: string[]): Promise<void> {
  await mapInBatches(identifiers, ARCHIVE_CONCURRENCY, (identifier) =>
    getItemInfo(identifier).catch((err: unknown) => {
      logger.warn({ identifier, reason: networkErrorReason(err) }, 'source unreachable');
    }),
  );
}

// A game whose ROMs are all nodump (no CRC) is listed without querying any
// source — see resolveOneGame — so it must not trigger the prefetch either.
function hasSearchableRom(dat: DatFile, gameId: string): boolean {
  const game = dat.games.find((g) => g.id === gameId);
  return game?.roms.some((rom) => rom.crc !== undefined) ?? false;
}

/**
 * The system's sources a resolve looks in: the ones switched on, in
 * configured order. `scope` names that set for the result cache ('*' when
 * every source is on).
 */
export function selectSources(configured: ConfiguredSource[]): {
  sources: ConfiguredSource[];
  scope: string;
} {
  const sources = configured.filter((source) => source.searched);
  if (sources.length === configured.length) return { sources, scope: '*' };
  const scope = sources
    .map((source) => source.identifier)
    .sort()
    .join('|');
  return { sources, scope };
}

export async function resolveGames(
  dat: DatFile,
  datId: string,
  gameIds: string[],
): Promise<ResolvedGame[]> {
  const { sources, scope } = selectSources(getSources(dat.system));
  const results: ResolvedGame[] = [];
  let prefetched = false;

  for (const gameId of gameIds) {
    const key = cacheKey(datId, gameId, scope);
    const cached = getCached(key);
    if (cached) {
      results.push(cached);
      continue;
    }

    if (!prefetched && hasSearchableRom(dat, gameId)) {
      await prefetchItemInfo(sources.map((source) => source.identifier));
      prefetched = true;
    }
    const resolved = await resolveOneGame(dat, gameId, sources);
    // Fully-resolved games cached long (invalidated when sources change);
    // partial or empty results cached 15 minutes
    const complete = resolved.roms.length > 0 && resolved.roms.every((r) => r.sources.length > 0);
    const ttl = complete ? 24 * 60 * 60 * 1000 : NEGATIVE_TTL_MS;
    setCached(key, resolved, ttl);
    results.push(resolved);
  }

  const roms = results.flatMap((game) => game.roms);
  logger.info(
    {
      datId,
      games: results.length,
      roms: roms.length,
      missing: roms.filter((rom) => rom.sources.length === 0).length,
      sources: sources.length,
    },
    'games resolved',
  );
  return results;
}
