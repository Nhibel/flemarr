import { Hono } from 'hono';
import { updateSettingsSchema } from '@shared/settings.js';
import { getSettings, updateSettings } from '@/services/settings/index.js';
import { parseJsonBody } from '@/lib/http.js';

export const settingsRoute = new Hono();

settingsRoute.get('/settings', (c) => {
  return c.json(getSettings());
});

settingsRoute.patch('/settings', async (c) => {
  const body = await parseJsonBody(c, updateSettingsSchema);
  if (!body.ok) return body.response;

  return c.json(updateSettings(body.data));
});
