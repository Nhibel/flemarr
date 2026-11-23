import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { DatFile, Game } from '@shared/dat.js';
import type { GameLink } from '@shared/game-link.js';
import { addDat } from '../services/dat/index.js';
import { datsRoute } from '../routes/dats.js';
import { gameLinksRoute } from '../routes/game-links.js';

const app = new Hono().route('/api', datsRoute).route('/api', gameLinksRoute);
const CRC = 'deadbeef';

function game(id: string, name: string, romCount = 1): Game {
  const roms = Array.from({ length: romCount }, (_, position) => ({
    name: `${name} ${position}.gbc`,
    size: 1,
    crc: `0000000${position}`,
    status: 'good' as const,
  }));
  return { id, name, region: [], languages: [], roms };
}

function datOf(...games: Game[]): DatFile {
  return { source: 'no-intro', system: 'Game Links Test', games };
}

let datId: string;

beforeEach(async () => {
  ({ id: datId } = addDat(datOf(game('g1', 'Catwoman (USA)'), game('g2', 'Disc (USA)', 2))));
  await app.request(`/api/dats/${datId}/links/${CRC}`, { method: 'DELETE' });
});

function link(gameId: string, crc = CRC) {
  return app.request(`/api/dats/${datId}/links/${crc}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId }),
  });
}

async function links(): Promise<GameLink[]> {
  const res = await app.request(`/api/dats/${datId}/links`);
  return ((await res.json()) as { links: GameLink[] }).links;
}

describe('game links', () => {
  it('attaches a file to a game, then detaches it', async () => {
    expect((await link('g1')).status).toBe(200);
    expect(await links()).toEqual([{ fileCrc: CRC, gameId: 'g1', gameName: 'Catwoman (USA)' }]);

    await app.request(`/api/dats/${datId}/links/${CRC}`, { method: 'DELETE' });
    expect(await links()).toEqual([]);
  });

  it('refuses an unknown game, a multi-file game and a bad CRC', async () => {
    expect((await link('nope')).status).toBe(404);
    expect((await link('g2')).status).toBe(400);
    expect((await link('g1', 'XYZ')).status).toBe(400);
    expect(await links()).toEqual([]);
  });

  it('answers 404 for an unknown DAT or link', async () => {
    expect((await app.request('/api/dats/nope/links')).status).toBe(404);
    const res = await app.request(`/api/dats/${datId}/links/${CRC}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('finds the game again by name after a DAT update changed its id', async () => {
    await link('g1');
    addDat(datOf(game('g1-new', 'Catwoman (USA)')));
    expect(await links()).toMatchObject([{ gameId: 'g1-new' }]);
  });

  it('reports a link whose game left the DAT', async () => {
    await link('g1');
    addDat(datOf(game('g9', 'Other (USA)')));
    expect(await links()).toEqual([{ fileCrc: CRC, gameId: null, gameName: 'Catwoman (USA)' }]);
  });

  it('forgets the links of a deleted DAT', async () => {
    await link('g1');
    await app.request(`/api/dats/${datId}`, { method: 'DELETE' });
    const { getDb } = await import('../lib/db.js');
    const row = getDb().prepare('SELECT 1 FROM game_links WHERE dat_id = ?').get(datId);
    expect(row).toBeUndefined();
  });
});
