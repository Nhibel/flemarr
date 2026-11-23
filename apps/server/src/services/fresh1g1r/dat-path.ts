import { fresh1g1rPresetSchema } from '@shared/fresh1g1r.js';
import type { Fresh1g1rPreset } from '@shared/fresh1g1r.js';

// DATs are identified by the path they had in the Fresh1G1R repository before
// its releases. The path no longer exists upstream, but it is stored with every
// loaded DAT: keeping it lets those still find their updates.
const ROOT = 'daily-1g1r-dat';

const ASSET_LABELS = { 'no-intro': 'No-Intro', redump: 'Redump' } as const;
export type Collection = keyof typeof ASSET_LABELS;
export const COLLECTIONS: readonly Collection[] = ['no-intro', 'redump'];

export interface DatLocation {
  asset: string;
  name: string;
}

export function assetName(preset: Fresh1g1rPreset, collection: Collection): string {
  return `Fresh1G1R-${preset}-${ASSET_LABELS[collection]}.zip`;
}

export function datPath(preset: Fresh1g1rPreset, collection: Collection, name: string): string {
  return `${ROOT}/${preset}/${collection}/${name}`;
}

/** The release asset and entry behind a DAT path. Throws on any other path. */
export function locateDat(path: string): DatLocation {
  const [root, rawPreset, folder, name, ...rest] = path.split('/');
  const preset = fresh1g1rPresetSchema.safeParse(rawPreset);
  const collection = COLLECTIONS.find((candidate) => candidate === folder);
  const isKnownShape = root === ROOT && rest.length === 0;
  if (!isKnownShape || !preset.success || collection === undefined || !name) {
    throw new Error(`Unknown Fresh1G1R path: ${path}`);
  }
  return { asset: assetName(preset.data, collection), name };
}
