import { Hono } from 'hono';
import { fileCrcSchema, saveGameLinkRequestSchema } from '@shared/game-link.js';
import { getDat } from '@/services/dat/index.js';
import {
  deleteGameLink,
  isLinkable,
  listGameLinks,
  saveGameLink,
} from '@/services/scanner/game-links.js';
import { errorJson, parseJsonBody } from '@/lib/http.js';
import { logger } from '@/lib/logger.js';

export const gameLinksRoute = new Hono();

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
  const game = dat.games.find((candidate) => candidate.id === body.data.gameId);
  if (game === undefined) return errorJson(c, 404, 'NOT_FOUND', 'Game not found in this DAT');
  if (!isLinkable(game)) {
    return errorJson(c, 400, 'MULTI_FILE_GAME', 'A file cannot stand for a multi-file game');
  }

  saveGameLink(datId, crc.data, game);
  logger.info({ datId, crc: crc.data, game: game.name }, 'file linked to game');
  return c.json({ links: listGameLinks(datId, dat) });
});

gameLinksRoute.delete('/dats/:id/links/:crc', (c) => {
  const datId = c.req.param('id');
  const crc = c.req.param('crc');
  if (!deleteGameLink(datId, crc)) return errorJson(c, 404, 'NOT_FOUND', 'Link not found');
  logger.info({ datId, crc }, 'file unlinked from game');
  return c.json({ ok: true });
});
