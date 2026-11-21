import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@/lib/api.js';
import { DownloadHistory } from '../DownloadHistory.js';

vi.mock('@/lib/api.js');

const NAMES = new Map([
  ['g1', 'Chrono Trigger (USA)'],
  ['g2', 'Super Metroid (USA)'],
]);

function renderHistory(onSelectGames = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <DownloadHistory datId="dat1" gameNames={NAMES} onSelectGames={onSelectGames} />
    </QueryClientProvider>,
  );
  return { ...view, onSelectGames };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DownloadHistory', () => {
  it('shows nothing before any download', async () => {
    vi.mocked(api.fetchDownloadHistory).mockResolvedValue([]);
    const { container } = renderHistory();
    await vi.waitFor(() => expect(api.fetchDownloadHistory).toHaveBeenCalledWith('dat1'));
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each game by name, with its outcome and the failure reason', async () => {
    vi.mocked(api.fetchDownloadHistory).mockResolvedValue([
      {
        gameId: 'g1',
        romName: 'ct.sfc',
        destination: '<browser>',
        status: 'failed',
        errorMessage: 'CRC mismatch',
        completedAt: Date.UTC(2026, 10, 20),
      },
      {
        gameId: 'g2',
        romName: 'sm.sfc',
        destination: '/roms/snes',
        status: 'done',
        errorMessage: null,
        completedAt: Date.UTC(2026, 10, 19),
      },
    ]);
    renderHistory();
    expect(await screen.findByText('Chrono Trigger (USA)')).toBeInTheDocument();
    expect(screen.getByText('CRC mismatch')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'En échec (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Terminés (1)' })).toBeInTheDocument();
    expect(screen.getByText(/· navigateur$/)).toBeInTheDocument();
  });

  // Past jobs keep no sources: the failed games go back into the selection.
  it('puts the failed games back into the selection', async () => {
    vi.mocked(api.fetchDownloadHistory).mockResolvedValue([
      {
        gameId: 'g1',
        romName: 'ct.sfc',
        destination: '/roms',
        status: 'failed',
        errorMessage: null,
        completedAt: 1,
      },
    ]);
    const { onSelectGames } = renderHistory();
    await userEvent.click(await screen.findByRole('button', { name: 'Resélectionner 1 jeu' }));
    expect(onSelectGames).toHaveBeenCalledWith(['g1']);
  });
});
