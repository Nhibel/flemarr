import { Hono } from 'hono';
import { isAbsolute, dirname, join } from 'node:path';
import { stat, readdir, mkdir } from 'node:fs/promises';
import { validateDirRequestSchema } from '@shared/fs.js';
import { parseJsonBody, errorJson, errorMessage } from '@/lib/http.js';
import { libraryRoot, libraryRoots } from '@/lib/library-root.js';
import {
  assertWithinConfiguredRoots,
  isWithinRoot,
  PathTraversalError,
  NoRootsConfiguredError,
} from '@/lib/fs-safety.js';

export const fsRoute = new Hono();

fsRoute.get('/fs/list-dirs', async (c) => {
  const root = libraryRoot();
  const rawPath = (c.req.query('path') ?? '').trim();

  async function tryList(p: string) {
    try {
      const info = await stat(p);
      if (!info.isDirectory()) return null;
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
      const parentPath = dirname(p);
      let parent: string | null = parentPath === p ? null : parentPath;
      // Confined to the library root: never expose a parent above it.
      if (root !== null && parent !== null && !isWithinRoot(parent, root)) {
        parent = null;
      }
      return { listedPath: p, parent, dirs };
    } catch {
      return null;
    }
  }

  if (root !== null) {
    // Start at the root unless the request points somewhere inside it.
    const target = rawPath && isAbsolute(rawPath) && isWithinRoot(rawPath, root) ? rawPath : root;
    const result = await tryList(target);
    if (!result) return c.json({ listedPath: '', parent: null, dirs: [] });
    return c.json(result);
  }

  // No configured root (local dev): browse anywhere, as before.
  if (!rawPath || !isAbsolute(rawPath)) {
    return c.json({ listedPath: '', parent: null, dirs: [] });
  }
  const result = (await tryList(rawPath)) ?? (await tryList(dirname(rawPath)));
  if (!result) return c.json({ listedPath: '', parent: null, dirs: [] });
  return c.json(result);
});

fsRoute.post('/fs/validate-dir', async (c) => {
  const body = await parseJsonBody(c, validateDirRequestSchema);
  if (!body.ok) return body.response;

  const { path } = body.data;

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

// Create a directory (recursively) within the configured roots. Lets the user
// pick a subfolder that doesn't exist yet and have it created on the spot.
fsRoute.post('/fs/create-dir', async (c) => {
  const body = await parseJsonBody(c, validateDirRequestSchema);
  if (!body.ok) return body.response;

  const { path } = body.data;
  if (!isAbsolute(path)) {
    return errorJson(c, 400, 'INVALID_PATH', 'Path must be absolute');
  }

  try {
    assertWithinConfiguredRoots(path, libraryRoots());
  } catch (err) {
    if (err instanceof NoRootsConfiguredError) {
      return errorJson(c, 400, 'NO_ROOTS_CONFIGURED', err.message);
    }
    if (err instanceof PathTraversalError) {
      return errorJson(c, 400, 'PATH_TRAVERSAL', err.message);
    }
    throw err;
  }

  try {
    await mkdir(path, { recursive: true });
  } catch (err) {
    return errorJson(c, 500, 'MKDIR_ERROR', errorMessage(err, 'Failed to create directory'));
  }

  return c.json({ path });
});
