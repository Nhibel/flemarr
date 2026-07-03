import { Hono } from 'hono';
import { parseDat, addDat, getDat, listDats, deleteDat } from '@/services/dat/index.js';
import { errorJson, errorMessage } from '@/lib/http.js';

export const datsRoute = new Hono();

datsRoute.get('/dats', (c) => {
  return c.json({ dats: listDats() });
});

datsRoute.delete('/dats/:id', (c) => {
  const id = c.req.param('id');
  if (!deleteDat(id)) {
    return errorJson(c, 404, 'NOT_FOUND', `DAT ${id} not found`);
  }
  return c.json({ ok: true });
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
    return errorJson(c, 400, 'EMPTY_BODY', 'Request body is empty');
  }

  let dat;
  try {
    dat = parseDat(body);
  } catch (err) {
    return errorJson(c, 400, 'PARSE_ERROR', errorMessage(err, 'Failed to parse DAT'));
  }

  const summary = addDat(dat);
  return c.json(summary, 201);
});

datsRoute.get('/dats/:id/games', (c) => {
  const id = c.req.param('id');
  const dat = getDat(id);

  if (dat == null) {
    return errorJson(c, 404, 'NOT_FOUND', `DAT ${id} not found`);
  }

  return c.json({ games: dat.games });
});
