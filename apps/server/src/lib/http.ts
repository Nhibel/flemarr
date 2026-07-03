import type { Context } from 'hono';
import type { z } from 'zod';

type ErrorStatus = 400 | 401 | 404 | 409 | 500 | 502;

/** Uniform error envelope (see ARCHITECTURE.md): { error: { code, message, details? } }. */
export function errorJson(
  c: Context,
  status: ErrorStatus,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return c.json({ error: { code, message, ...(details !== undefined && { details }) } }, status);
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * Read and validate a JSON request body. On failure returns the 400 response
 * to send back (INVALID_JSON or VALIDATION_ERROR):
 *
 *   const body = await parseJsonBody(c, someRequestSchema);
 *   if (!body.ok) return body.response;
 *   // body.data is typed and trusted
 */
export async function parseJsonBody<T>(
  c: Context,
  // Input type left free: schemas with .default() accept less than they output
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<ParsedBody<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, response: errorJson(c, 400, 'INVALID_JSON', 'Invalid JSON body') };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid body';
    return { ok: false, response: errorJson(c, 400, 'VALIDATION_ERROR', message) };
  }

  return { ok: true, data: parsed.data };
}
