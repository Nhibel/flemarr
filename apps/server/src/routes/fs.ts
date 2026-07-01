import { Hono } from 'hono';
import { isAbsolute } from 'node:path';
import { stat } from 'node:fs/promises';
import { validateDirRequestSchema } from '@shared/fs.js';

export const fsRoute = new Hono();

fsRoute.post('/fs/validate-dir', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = validateDirRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid body',
        },
      },
      400,
    );
  }

  const { path } = parsed.data;

  if (!isAbsolute(path)) {
    return c.json({ exists: false, isDirectory: false });
  }

  try {
    const info = await stat(path);
    return c.json({ exists: true, isDirectory: info.isDirectory() });
  } catch {
    return c.json({ exists: false, isDirectory: false });
  }
});
