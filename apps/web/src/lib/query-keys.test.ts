import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys.js';

describe('queryKeys', () => {
  it('makes listDirs() a prefix of every listDirs(path), so one invalidation covers all', async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.listDirs('/roms'), { dirs: [] });
    client.setQueryData(queryKeys.listDirs('/roms/snes'), { dirs: [] });

    await client.invalidateQueries({ queryKey: queryKeys.listDirs() });

    expect(client.getQueryState(queryKeys.listDirs('/roms'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.listDirs('/roms/snes'))?.isInvalidated).toBe(true);
  });

  it('scopes archive sources per system', async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.archiveSources('SNES'), []);
    client.setQueryData(queryKeys.archiveSources('NES'), []);

    await client.invalidateQueries({ queryKey: queryKeys.archiveSources('SNES') });

    expect(client.getQueryState(queryKeys.archiveSources('SNES'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.archiveSources('NES'))?.isInvalidated).toBe(false);
  });

  it('gives the same key to the same sorted set of systems', () => {
    expect(queryKeys.systemIcons(['NES', 'SNES'])).toEqual(queryKeys.systemIcons(['NES', 'SNES']));
    expect(queryKeys.systemIcons(['NES', 'SNES'])).not.toEqual(queryKeys.systemIcons(['NES']));
  });
});
