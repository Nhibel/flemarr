import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@/lib/api.js';
import type { Game } from '@shared/dat.js';
import type { UnmatchedFile } from '@shared/scan.js';
import { UnmatchedFiles } from '../UnmatchedFiles.js';

vi.mock('@/lib/api.js');

const FILE: UnmatchedFile = { filePath: '/roms/gbc/Catwoman (Europe).gbc', crc: 'deadbeef' };
const GAME: Game = {
  id: 'g1',
  name: 'Catwoman (USA)',
  region: [],
  languages: [],
  roms: [{ name: 'Catwoman (USA).gbc', size: 1, crc: '00000001', status: 'good' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchGames).mockResolvedValue([GAME]);
  vi.mocked(api.fetchGameLinks).mockResolvedValue([]);
  vi.mocked(api.saveGameLink).mockResolvedValue(undefined);
  vi.mocked(api.deleteGameLink).mockResolvedValue(undefined);
});

function renderFiles(files: UnmatchedFile[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <UnmatchedFiles datId="d1" files={files} />
    </QueryClientProvider>,
  );
}

const attachButton = () =>
  screen.findByRole('button', { name: /^Rattacher Catwoman/, hidden: true });
const confirmButton = () => screen.getByRole('button', { name: 'Rattacher', hidden: true });

describe('UnmatchedFiles', () => {
  it('attaches a file to the suggested game, only once confirmed', async () => {
    const user = userEvent.setup();
    renderFiles([FILE]);
    await user.click(await attachButton());
    expect(confirmButton()).toBeDisabled();

    await user.click(screen.getByLabelText('Catwoman (USA)'));
    expect(api.saveGameLink).not.toHaveBeenCalled();
    await user.click(confirmButton());
    expect(api.saveGameLink).toHaveBeenCalledWith('d1', 'deadbeef', 'g1');
    await waitFor(() => expect(api.fetchGameLinks).toHaveBeenCalledTimes(2));
  });

  it('keeps the dialog open and says why when saving fails', async () => {
    vi.mocked(api.saveGameLink).mockRejectedValue(new Error('refusé'));
    const user = userEvent.setup();
    renderFiles([FILE]);
    await user.click(await attachButton());
    await user.click(screen.getByLabelText('Catwoman (USA)'));
    await user.click(confirmButton());
    expect(await screen.findByText('refusé')).toBeInTheDocument();
  });

  it('shows an attached file with its game, and detaches it', async () => {
    vi.mocked(api.fetchGameLinks).mockResolvedValue([
      { fileCrc: 'deadbeef', gameId: 'g1', gameName: 'Catwoman (USA)' },
    ]);
    const user = userEvent.setup();
    renderFiles([FILE]);
    await user.click(await screen.findByRole('button', { name: /^Détacher/ }));
    expect(screen.getByText('1 fichier rattaché')).toBeInTheDocument();
    expect(api.deleteGameLink).toHaveBeenCalledWith('d1', 'deadbeef');
  });

  it('offers nothing for a file with no CRC', async () => {
    renderFiles([{ filePath: '/roms/psx/x.chd' }]);
    await waitFor(() => expect(api.fetchGames).toHaveBeenCalled());
    expect(screen.queryByRole('button', { hidden: true })).not.toBeInTheDocument();
  });

  it('offers nothing in a DAT of multi-file games', async () => {
    const rom = GAME.roms[0]!;
    vi.mocked(api.fetchGames).mockResolvedValue([{ ...GAME, roms: [rom, rom] }]);
    renderFiles([FILE]);
    await waitFor(() => expect(api.fetchGames).toHaveBeenCalled());
    expect(screen.queryByRole('button', { hidden: true })).not.toBeInTheDocument();
  });
});
