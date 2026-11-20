import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as api from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { useDirListing } from '../use-dir-listing.js';

vi.mock('@/lib/api.js');

const ROMS_LISTING = {
  listedPath: '/roms',
  parent: '/',
  dirs: [{ path: '/roms/snes', fileCount: 3 }],
  fileCount: 0,
};

function setup(value: string, open: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useDirListing(value, open), { wrapper });
  return { client, ...hook };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listDirs).mockResolvedValue(ROMS_LISTING);
});

describe('useDirListing', () => {
  it('does not list anything while the picker is closed', async () => {
    setup('/roms', false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(api.listDirs).not.toHaveBeenCalled();
  });

  it('lists the typed folder once the picker is open', async () => {
    const { result } = setup('/roms', true);
    await waitFor(() => expect(result.current.listedPath).toBe('/roms'));
    expect(api.listDirs).toHaveBeenCalledWith('/roms');
  });

  it('creates a subfolder in the listed folder and refreshes every listing', async () => {
    vi.mocked(api.createDir).mockResolvedValue({ path: '/roms/gba' });
    const { result, client } = setup('/roms', true);
    await waitFor(() => expect(result.current.listedPath).toBe('/roms'));
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    let createdPath: string | null = null;
    await act(async () => {
      createdPath = await result.current.createFolder('  gba ');
    });

    expect(api.createDir).toHaveBeenCalledWith('/roms/gba');
    expect(createdPath).toBe('/roms/gba');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.listDirs() });
  });

  it('reports a server error and creates nothing', async () => {
    vi.mocked(api.createDir).mockRejectedValue(new Error('Permission refusée'));
    const { result } = setup('/roms', true);
    await waitFor(() => expect(result.current.listedPath).toBe('/roms'));

    let createdPath: string | null = 'unset';
    await act(async () => {
      createdPath = await result.current.createFolder('gba');
    });

    expect(createdPath).toBeNull();
    expect(result.current.createError).toBe('Permission refusée');
  });

  it('ignores a blank name', async () => {
    const { result } = setup('/roms', true);
    await waitFor(() => expect(result.current.listedPath).toBe('/roms'));

    await act(async () => {
      await result.current.createFolder('   ');
    });

    expect(api.createDir).not.toHaveBeenCalled();
  });
});
