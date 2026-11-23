import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@/lib/api.js';
import type { SettingsResponse } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { Fresh1g1rBrowser } from '../Fresh1g1rBrowser.js';

vi.mock('@/lib/api.js');

const REVISION = 'aaaaaaaa-1234';
const SNES = {
  name: 'snes.dat',
  system: 'Nintendo - SNES',
  path: 'PropeR/snes.dat',
  revision: REVISION,
};
const PSX = {
  name: 'psx.dat',
  system: 'Sony - PlayStation',
  path: 'PropeR/psx.dat',
  revision: REVISION,
};

function renderBrowser(onSuccess = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <Fresh1g1rBrowser onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess, invalidate };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The settings' preset is the default pick.
  vi.mocked(api.getSettings).mockResolvedValue({
    fresh1g1rPreset: 'McLean',
  } as SettingsResponse);
  vi.mocked(api.listDatSources).mockImplementation(async (preset) => ({
    preset,
    sources: [SNES, PSX],
  }));
});

describe('Fresh1g1rBrowser', () => {
  it('lists the systems of the preset chosen in settings', async () => {
    renderBrowser();
    expect(await screen.findByText('Nintendo - SNES')).toBeInTheDocument();
    await waitFor(() => expect(api.listDatSources).toHaveBeenLastCalledWith('McLean'));
  });

  it('switches preset', async () => {
    renderBrowser();
    await screen.findByText('Nintendo - SNES');
    await userEvent.click(screen.getByRole('button', { name: 'Hearto' }));
    await waitFor(() => expect(api.listDatSources).toHaveBeenLastCalledWith('Hearto'));
  });

  it('filters the systems, ignoring case', async () => {
    renderBrowser();
    await screen.findByText('Nintendo - SNES');
    await userEvent.type(screen.getByPlaceholderText('Filtrer par système…'), 'PLAYSTATION');
    expect(screen.queryByText('Nintendo - SNES')).not.toBeInTheDocument();
    expect(screen.getByText('Sony - PlayStation')).toBeInTheDocument();
  });

  it('says when the filter matches nothing', async () => {
    renderBrowser();
    await screen.findByText('Nintendo - SNES');
    await userEvent.type(screen.getByPlaceholderText('Filtrer par système…'), 'zzz');
    expect(screen.getByText('Aucun système trouvé.')).toBeInTheDocument();
  });

  // Loading adds the system to the home screen and marks it, without navigating.
  it('loads a system, refreshes the system list and marks it loaded', async () => {
    const dat = { id: 'd1', system: 'Nintendo - SNES', gameCount: 2, source: 'no-intro' as const };
    vi.mocked(api.fetchDatFromFresh1g1r).mockResolvedValue(dat);
    const { onSuccess, invalidate } = renderBrowser();
    await screen.findByText('Nintendo - SNES');
    await userEvent.click(screen.getAllByRole('button', { name: 'Charger' })[0]!);
    expect(await screen.findByRole('button', { name: '✓ Chargé' })).toBeInTheDocument();
    expect(api.fetchDatFromFresh1g1r).toHaveBeenCalledWith({
      preset: 'McLean',
      path: SNES.path,
      revision: REVISION,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dats() });
    expect(onSuccess).toHaveBeenCalledWith(dat);
  });

  it('shows a failed load', async () => {
    vi.mocked(api.fetchDatFromFresh1g1r).mockRejectedValue(new Error('GitHub indisponible'));
    renderBrowser();
    await screen.findByText('Nintendo - SNES');
    await userEvent.click(screen.getAllByRole('button', { name: 'Charger' })[0]!);
    expect(await screen.findByText('GitHub indisponible')).toBeInTheDocument();
  });
});
