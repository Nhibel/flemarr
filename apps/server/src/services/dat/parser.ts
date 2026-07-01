import { XMLParser } from 'fast-xml-parser';
import { datFileSchema, gameSchema, romSchema } from '@shared/dat.js';
import type { DatFile, Game, Rom } from '@shared/dat.js';
import { makeGameId } from '@/lib/game-id.js';
import { parseName } from './name-parser.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'game' || name === 'rom',
  parseAttributeValue: false,
});

function detectSource(header: Record<string, string>): 'no-intro' | 'redump' {
  const url = (header['url'] ?? header['homepage'] ?? '').toLowerCase();
  const author = (header['author'] ?? '').toLowerCase();
  if (url.includes('redump') || author.includes('redump')) return 'redump';
  return 'no-intro';
}

function parseRom(raw: Record<string, string>): Rom | null {
  const crc = (raw['@_crc'] ?? '').toLowerCase();
  const md5 = (raw['@_md5'] ?? '').toLowerCase();
  const sha1 = (raw['@_sha1'] ?? '').toLowerCase();
  const status = raw['@_status'] === 'nodump' ? 'nodump' : 'good';

  const result = romSchema.safeParse({
    name: raw['@_name'] ?? '',
    size: parseInt(raw['@_size'] ?? '0', 10),
    crc: crc || undefined,
    md5: md5 || undefined,
    sha1: sha1 || undefined,
    status,
  });

  if (!result.success) return null;
  return result.data;
}

function parseGame(raw: Record<string, unknown>): Game | null {
  const name = String(raw['@_name'] ?? '');
  const description = raw['description'] != null ? String(raw['description']) : undefined;
  const rawRoms = Array.isArray(raw['rom']) ? (raw['rom'] as Record<string, string>[]) : [];

  const roms: Rom[] = [];
  for (const r of rawRoms) {
    const rom = parseRom(r);
    if (rom !== null) roms.push(rom);
  }

  if (roms.length === 0) return null;

  const firstRom = roms[0];
  if (firstRom === undefined) return null;

  const { region, languages, category } = parseName(name);

  const result = gameSchema.safeParse({
    id: makeGameId(name, firstRom.crc),
    name,
    description,
    region,
    languages,
    category,
    roms,
  });

  if (!result.success) return null;
  return result.data;
}

export function parseDat(input: string, fallbackName = 'Unknown System'): DatFile {
  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(input) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Failed to parse DAT XML: ${err instanceof Error ? err.message : String(err)}`);
  }

  const datafile = parsed['datafile'] as Record<string, unknown> | undefined;
  if (datafile == null) {
    throw new Error('Invalid DAT: missing <datafile> root element');
  }

  const header = (datafile['header'] as Record<string, string> | undefined) ?? {};
  const source = detectSource(header);
  const system = header['name'] ?? fallbackName;
  const version = header['version'] as string | undefined;
  const date = header['date'] as string | undefined;

  const rawGames = Array.isArray(datafile['game'])
    ? (datafile['game'] as Record<string, unknown>[])
    : [];

  const games: Game[] = [];
  for (const raw of rawGames) {
    const game = parseGame(raw);
    if (game !== null) games.push(game);
  }

  return datFileSchema.parse({ source, system, version, date, games });
}
