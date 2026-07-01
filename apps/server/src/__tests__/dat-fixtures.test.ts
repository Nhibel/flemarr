import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDat } from '../services/dat/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

describe('No-Intro SNES fixture', () => {
  const dat = parseDat(readFileSync(join(fixturesDir, 'no-intro-snes.dat'), 'utf8'));

  it('detects no-intro source', () => {
    expect(dat.source).toBe('no-intro');
  });

  it('has correct system name', () => {
    expect(dat.system).toBe('Nintendo - Super Nintendo Entertainment System');
  });

  it('parses all 3 games', () => {
    expect(dat.games).toHaveLength(3);
  });

  it('all games have stable ids', () => {
    const ids = dat.games.map((g) => g.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('extracts correct region', () => {
    expect(dat.games[0]?.region).toEqual(['USA']);
  });

  it('extracts languages from Final Fantasy VI', () => {
    const ff6 = dat.games.find((g) => g.name.includes('Final Fantasy'));
    expect(ff6?.languages).toEqual(['En', 'Es']);
  });

  it('CRC is lowercase 8 hex chars', () => {
    for (const game of dat.games) {
      for (const rom of game.roms) {
        expect(rom.crc).toMatch(/^[0-9a-f]{8}$/);
      }
    }
  });
});

describe('Redump PS1 fixture', () => {
  const dat = parseDat(readFileSync(join(fixturesDir, 'redump-ps1.dat'), 'utf8'));

  it('detects redump source', () => {
    expect(dat.source).toBe('redump');
  });

  it('parses 2 games', () => {
    expect(dat.games).toHaveLength(2);
  });

  it('FF7 Disc 1 has 2 ROMs (cue + bin)', () => {
    const ff7 = dat.games.find((g) => g.name.includes('Final Fantasy'));
    expect(ff7?.roms).toHaveLength(2);
  });

  it('nodump ROM has status nodump', () => {
    const castlevania = dat.games.find((g) => g.name.includes('Castlevania'));
    expect(castlevania?.roms[0]?.status).toBe('nodump');
  });
});
