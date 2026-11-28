import { Hono } from 'hono';
import {
  fileCrcSchema,
  saveGameLinkRequestSchema,
  saveGameLinksRequestSchema,
} from '@shared/game-link.js';
import type { DatFile, Game } from '@shared/dat.js';
import { getDat } from '@/services/dat/index.js';
import {
  deleteGameLink,
  isLinkable,
  listGameLinks,
  saveGameLink,
  saveGameLinks,
} from '@/services/scanner/game-links.js';
import { errorJson, parseJsonBody } from '@/lib/http.js';
import { logger } from '@/lib/logger.js';

export const gameLinksRoute = new Hono();

type GameLookup =
  { ok: true; game: Game } | { ok: false; status: 400 | 404; code: string; message: string };

/** The game a file may stand for: one of the DAT, made of a single file. */
function findLinkableGame(dat: DatFile, gameId: string): GameLookup {
  const game = dat.games.find((candidate) => candidate.id === gameId);
  if (game === undefined) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Game not found in this DAT' };
  }
  if (!isLinkable(game)) {
    const message = 'A file cannot stand for a multi-file game';
    return { ok: false, status: 400, code: 'MULTI_FILE_GAME', message };
  }
  return { ok: true, game };
}

gameLinksRoute.get('/dats/:id/links', (c) => {
  const datId = c.req.param('id');
  const dat = getDat(datId);
  if (dat === undefined) return errorJson(c, 404, 'NOT_FOUND', `DAT ${datId} not found`);
  return c.json({ links: listGameLinks(datId, dat) });
});

gameLinksRoute.put('/dats/:id/links/:crc', async (c) => {
  const datId = c.req.param('id');
  const crc = fileCrcSchema.safeParse(c.req.param('crc'));
  if (!crc.success) return errorJson(c, 400, 'VALIDATION_ERROR', 'Invalid CRC');
  const body = await parseJsonBody(c, saveGameLinkRequestSchema);
  if (!body.ok) return body.response;

  const dat = getDat(datId);
  if (dat === undefined) return errorJson(c, 404, 'NOT_FOUND', `DAT ${datId} not found`);
  const found = findLinkableGame(dat, body.data.gameId);
  if (!found.ok) return errorJson(c, found.status, found.code, found.message);

  saveGameLink(datId, crc.data, found.game);
  logger.info({ datId, crc: crc.data, game: found.game.name }, 'file linked to game');
  return c.json({ links: listGameLinks(datId, dat) });
});

gameLinksRoute.put('/dats/:id/links', async (c) => {
  const datId = c.req.param('id');
  const body = await parseJsonBody(c, saveGameLinksRequestSchema);
  if (!body.ok) return body.response;
  const dat = getDat(datId);
  if (dat === undefined) return errorJson(c, 404, 'NOT_FOUND', `DAT ${datId} not found`);

  // Every game checked before anything is written: all saved, or none.
  const links: { fileCrc: string; game: Game }[] = [];
  for (const { fileCrc, gameId } of body.data.links) {
    const found = findLinkableGame(dat, gameId);
    if (!found.ok) return errorJson(c, found.status, found.code, `${found.message}: ${gameId}`);
    links.push({ fileCrc, game: found.game });
  }

  saveGameLinks(datId, links);
  logger.info({ datId, count: links.length }, 'files linked to games');
  return c.json({ links: listGameLinks(datId, dat) });
});

gameLinksRoute.delete('/dats/:id/links/:crc', (c) => {
  const datId = c.req.param('id');
  const crc = c.req.param('crc');
  if (!deleteGameLink(datId, crc)) return errorJson(c, 404, 'NOT_FOUND', 'Link not found');
  logger.info({ datId, crc }, 'file unlinked from game');
  return c.json({ ok: true });
});
