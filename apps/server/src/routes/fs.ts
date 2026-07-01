import { Hono } from 'hono';
import { isAbsolute, dirname, join } from 'node:path';
import { stat, readdir } from 'node:fs/promises';
import { validateDirRequestSchema } from '@shared/fs.js';

export const fsRoute = new Hono();

fsRoute.get('/fs/list-dirs', async (c) => {
  const rawPath = c.req.query('path') ?? '';

  if (!rawPath || !isAbsolute(rawPath)) {
    return c.json({ listedPath: '', parent: null, dirs: [] });
  }

  async function tryList(p: string) {
    try {
      const info = await stat(p);
      if (!info.isDirectory()) return null;
      const parentPath = dirname(p);
      const entries = await readdir(p);
      const dirs: string[] = [];
      for (const name of entries) {
        const full = join(p, name);
        try {
          const s = await stat(full);
          if (s.isDirectory()) dirs.push(full);
        } catch {
          /* inaccessible — skip */
        }
      }
      dirs.sort();
      return { listedPath: p, parent: parentPath === p ? null : parentPath, dirs };
    } catch {
      return null;
    }
  }

  const result = (await tryList(rawPath)) ?? (await tryList(dirname(rawPath)));
  if (!result) return c.json({ listedPath: '', parent: null, dirs: [] });
  return c.json(result);
});

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
