import { Hono } from 'hono';
import { parseDat, addDat, getDat, listDats } from '@/services/dat/index.js';

export const datsRoute = new Hono();

datsRoute.get('/dats', (c) => {
  return c.json({ dats: listDats() });
});

datsRoute.post('/dats', async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  let body: string;

  if (contentType.includes('application/json')) {
    const json = await c.req.json<{ content?: string }>();
    body = json.content ?? '';
  } else {
    body = await c.req.text();
  }

  if (!body.trim()) {
    return c.json({ error: { code: 'EMPTY_BODY', message: 'Request body is empty' } }, 400);
  }

  let dat;
  try {
    dat = parseDat(body);
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'PARSE_ERROR',
          message: err instanceof Error ? err.message : 'Failed to parse DAT',
        },
      },
      400,
    );
  }

  const summary = addDat(dat);
  return c.json(summary, 201);
});

datsRoute.get('/dats/:id/games', (c) => {
  const id = c.req.param('id');
  const dat = getDat(id);

  if (dat == null) {
    return c.json({ error: { code: 'NOT_FOUND', message: `DAT ${id} not found` } }, 404);
  }

  return c.json({ games: dat.games });
});
