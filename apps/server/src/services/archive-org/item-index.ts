import type { ArchiveFile } from '@shared/archive.js';
import type { ArchiveItemInfo } from './metadata.js';
import {
  baseName,
  isArchiveContainer,
  isReencodedDump,
  stripExtension,
  zipSystemMatch,
} from './system-name.js';

/**
 * Lookups over one archive.org item's file list, built once per item
 * instead of once per ROM. A big set lists thousands of files, and the
 * resolver used to re-scan and re-sort all of them for every ROM of every
 * game against every source: ~25 ms per source per ROM, so a 20-track disc
 * game spent seconds re-doing the same work. Every lookup returns files in
 * the item's own order, which is what the scans did.
 */
export interface ItemIndex {
  /** First file carrying each CRC (lowercase). */
  byCrc: Map<string, ArchiveFile>;
  /** Raw files (no container, no re-encode) by extension-less basename. */
  rawFilesByBase: Map<string, ArchiveFile[]>;
  /** Archive containers, in item order. */
  zips: ArchiveFile[];
  /** Positions in `zips`, by the container's extension-less basename. */
  zipPositionsByBase: Map<string, number[]>;
  /** Per system: positions in `zips` grouped by system rank (exact, loose, none). */
  zipRanksBySystem: Map<string, ZipRankGroups>;
}

/** Positions in `zips`, each group in item order. */
export interface ZipRankGroups {
  exact: number[];
  loose: number[];
  none: number[];
}

// Keyed by the cached metadata object itself: the index lives exactly as
// long as the metadata it was built from, and a refetch gets a new one.
const indexes = new WeakMap<ArchiveItemInfo, ItemIndex>();

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function buildIndex(files: ArchiveFile[]): ItemIndex {
  const index: ItemIndex = {
    byCrc: new Map(),
    rawFilesByBase: new Map(),
    zips: [],
    zipPositionsByBase: new Map(),
    zipRanksBySystem: new Map(),
  };
  for (const file of files) {
    const crc = file.crc32?.toLowerCase();
    if (crc !== undefined && !index.byCrc.has(crc)) index.byCrc.set(crc, file);

    const base = stripExtension(baseName(file.name));
    if (isArchiveContainer(file)) {
      pushTo(index.zipPositionsByBase, base, index.zips.length);
      index.zips.push(file);
    } else if (!isReencodedDump(file.name)) {
      pushTo(index.rawFilesByBase, base, file);
    }
  }
  return index;
}

export function itemIndex(info: ArchiveItemInfo): ItemIndex {
  let index = indexes.get(info);
  if (!index) {
    index = buildIndex(info.files);
    indexes.set(info, index);
  }
  return index;
}

/** How each container's name relates to `system`, computed once per system. */
export function zipRanks(index: ItemIndex, system: string): ZipRankGroups {
  const known = index.zipRanksBySystem.get(system);
  if (known) return known;
  const groups: ZipRankGroups = { exact: [], loose: [], none: [] };
  index.zips.forEach((zip, position) => {
    const match = zipSystemMatch(zip.name, system);
    if (match === 'exact') groups.exact.push(position);
    else if (match === 'loose') groups.loose.push(position);
    else groups.none.push(position);
  });
  index.zipRanksBySystem.set(system, groups);
  return groups;
}
