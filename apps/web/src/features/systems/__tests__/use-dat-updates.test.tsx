import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@/lib/api.js';
import type { DatUpdate } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { useDatUpdates } from '../use-dat-updates.js';

vi.mock('@/lib/api.js');

const UPDATE: DatUpdate = {
  datId: 'd1',
  preset: 'PropeR',
  path: 'daily-1g1r-dat/PropeR/x.dat',
  revision: 'aaaaaaaa-1234',
  version: '20261120-000000',
};

function renderUpdates() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useDatUpdates(), { wrapper });
  return { ...view, invalidate };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDatUpdates', () => {
  it('maps each update to its DAT', async () => {
    vi.mocked(api.fetchDatUpdates).mockResolvedValue([UPDATE]);
    const { result } = renderUpdates();
    await waitFor(() => expect(result.current.updatesByDat.get('d1')).toEqual(UPDATE));
  });

  it('shows nothing when the check fails', async () => {
    vi.mocked(api.fetchDatUpdates).mockRejectedValue(new Error('GitHub down'));
    const { result } = renderUpdates();
    await waitFor(() => expect(api.fetchDatUpdates).toHaveBeenCalled());
    expect(result.current.updatesByDat.size).toBe(0);
  });

  // The DAT keeps its id: its games cached under that id must refetch.
  it('loads the new version and drops what was cached for that DAT', async () => {
    vi.mocked(api.fetchDatUpdates).mockResolvedValue([UPDATE]);
    vi.mocked(api.fetchDatFromFresh1g1r).mockResolvedValue({
      id: 'd1',
      system: 'SNES',
      gameCount: 2,
      source: 'no-intro',
    });
    const { result, invalidate } = renderUpdates();
    await waitFor(() => expect(result.current.updatesByDat.size).toBe(1));
    act(() => result.current.applyUpdate(UPDATE));
    await waitFor(() =>
      expect(api.fetchDatFromFresh1g1r).toHaveBeenCalledWith({
        preset: 'PropeR',
        path: UPDATE.path,
        revision: UPDATE.revision,
      }),
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.games('d1') }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.datUpdates() });
  });
});
