import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SettingsResponse } from '@shared/settings.js';
import type { LastScan } from '@shared/scan.js';
import * as api from '@/lib/api.js';
import { useLastScan } from '../use-last-scan.js';

vi.mock('@/lib/api.js');

const SNES = 'Nintendo - SNES';

const STORED: LastScan = {
  directory: '/roms/snes',
  scannedAt: Date.UTC(2026, 10, 19, 14, 30),
  result: { matched: [], wrongName: [], unmatched: [] },
};

function renderLastScan(folder: string) {
  vi.mocked(api.getSettings).mockResolvedValue({
    systemPaths: { [SNES]: folder },
  } as unknown as SettingsResponse);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useLastScan('dat1', SNES), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useLastScan', () => {
  it('restores the stored scan of the current folder', async () => {
    vi.mocked(api.fetchLastScan).mockResolvedValue(STORED);
    const { result } = renderLastScan('/roms/snes');
    await waitFor(() => expect(result.current.lastScan).toEqual(STORED.result));
    expect(result.current.lastScanAt).toEqual(new Date(STORED.scannedAt));
  });

  // A scan of another folder says nothing about the current one.
  it('ignores a scan of a folder no longer set for the system', async () => {
    vi.mocked(api.fetchLastScan).mockResolvedValue(STORED);
    const { result } = renderLastScan('/mnt/nas/snes');
    await waitFor(() => expect(api.fetchLastScan).toHaveBeenCalled());
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());
    expect(result.current.lastScan).toBeNull();
    expect(result.current.lastScanAt).toBeNull();
  });

  it('has nothing before a first scan', async () => {
    vi.mocked(api.fetchLastScan).mockResolvedValue(null);
    const { result } = renderLastScan('/roms/snes');
    await waitFor(() => expect(api.fetchLastScan).toHaveBeenCalled());
    expect(result.current.lastScan).toBeNull();
  });

  it('refetches once a scan is done', async () => {
    vi.mocked(api.fetchLastScan).mockResolvedValue(null);
    const { result } = renderLastScan('/roms/snes');
    await waitFor(() => expect(api.fetchLastScan).toHaveBeenCalledTimes(1));
    vi.mocked(api.fetchLastScan).mockResolvedValue(STORED);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.lastScan).toEqual(STORED.result));
  });
});
