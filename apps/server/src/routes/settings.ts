import { Hono } from 'hono';
import { updateSettingsSchema } from '@shared/settings.js';
import { getSettings, updateSettings } from '@/services/settings/index.js';

export const settingsRoute = new Hono();

settingsRoute.get('/settings', (c) => {
  return c.json(getSettings());
});

settingsRoute.patch('/settings', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = updateSettingsSchema.safeParse(body);
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

  return c.json(updateSettings(parsed.data));
});
