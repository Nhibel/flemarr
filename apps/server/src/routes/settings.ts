import { Hono } from 'hono';
import { updateSettingsSchema } from '@shared/settings.js';
import { getSettings, updateSettings, toSettingsResponse } from '@/services/settings/index.js';
import { libraryRoot } from '@/lib/library-root.js';
import { parseJsonBody } from '@/lib/http.js';

export const settingsRoute = new Hono();

settingsRoute.get('/settings', (c) => {
  return c.json(toSettingsResponse(getSettings(), libraryRoot()));
});

settingsRoute.patch('/settings', async (c) => {
  const body = await parseJsonBody(c, updateSettingsSchema);
  if (!body.ok) return body.response;

  return c.json(toSettingsResponse(updateSettings(body.data), libraryRoot()));
});
