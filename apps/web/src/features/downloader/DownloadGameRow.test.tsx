import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as api from '@/lib/api.js';
import type { GameStatus } from './game-status.js';
import { DownloadGameRow } from './DownloadGameRow.js';

vi.mock('@/lib/api.js');

const GAME: GameStatus = {
  gameId: 'ff7',
  label: 'Final Fantasy VII (USA)',
  kind: 'downloading',
  progress: 42,
  bytesDownloaded: 420,
  totalBytes: 1000,
  fileCount: 2,
  files: ['ff7.cue', 'ff7.bin'],
};

function renderRow(
  game: Partial<GameStatus> = {},
  over: Partial<ComponentProps<typeof DownloadGameRow>> = {},
) {
  const onRetry = vi.fn();
  render(
    <DownloadGameRow
      jobId="job1"
      game={{ ...GAME, ...game }}
      target="server"
      rate={undefined}
      running
      onRetry={onRetry}
      {...over}
    />,
  );
  return { onRetry };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.cancelDownloadItem).mockResolvedValue(undefined);
});

describe('DownloadGameRow', () => {
  it('shows the game, its file count and its progress', () => {
    renderRow();
    expect(screen.getByText('Final Fantasy VII (USA)')).toBeInTheDocument();
    expect(screen.getByText(/2 fichiers/)).toBeInTheDocument();
    expect(screen.getByText('Téléchargement').parentElement).toHaveTextContent('42 %');
  });

  it('shows bytes so far when the total is unknown', () => {
    renderRow({ progress: -1, bytesDownloaded: 2048 });
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
  });

  it('shows the transfer rate when known', () => {
    renderRow({}, { rate: 1_048_576 });
    expect(screen.getByText('Téléchargement').parentElement).toHaveTextContent('· 1.0 MB/s');
  });

  it('cancels every file of the game', async () => {
    renderRow();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(api.cancelDownloadItem).toHaveBeenCalledTimes(2));
    expect(api.cancelDownloadItem).toHaveBeenCalledWith('job1', 'ff7', 'ff7.cue');
    expect(api.cancelDownloadItem).toHaveBeenCalledWith('job1', 'ff7', 'ff7.bin');
  });

  it('says why the cancel failed', async () => {
    vi.mocked(api.cancelDownloadItem).mockRejectedValue(new Error('Job job1 not found'));
    renderRow();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Job job1 not found');
  });

  // One file already finished answers 404; the others were still cancelled.
  it('stays quiet when only some files could not be cancelled', async () => {
    vi.mocked(api.cancelDownloadItem)
      .mockRejectedValueOnce(new Error('Item not found, already settled'))
      .mockResolvedValueOnce(undefined);
    renderRow();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(api.cancelDownloadItem).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Annuler' })).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers no cancel once the game is finished, or the job stopped', () => {
    const { unmount } = render(
      <DownloadGameRow
        jobId="job1"
        game={{ ...GAME, kind: 'done' }}
        target="server"
        rate={undefined}
        running
        onRetry={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
    unmount();
    renderRow({}, { running: false });
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
  });

  it('says where a finished game went', () => {
    const { unmount } = render(
      <DownloadGameRow
        jobId="job1"
        game={{ ...GAME, kind: 'done' }}
        target="server"
        rate={undefined}
        running={false}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText('Vérifié et rangé')).toBeInTheDocument();
    unmount();
    renderRow({ kind: 'done' }, { target: 'browser' });
    expect(screen.getByText('Envoyé à ton navigateur')).toBeInTheDocument();
  });

  it('explains a failed download and offers both retries', async () => {
    const { onRetry } = renderRow({ kind: 'failed', reason: 'CRC mismatch' });
    expect(screen.getByText('CRC mismatch')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Chercher ailleurs' }));
    expect(onRetry).toHaveBeenNthCalledWith(1, 'ff7', 'same');
    expect(onRetry).toHaveBeenNthCalledWith(2, 'ff7', 'elsewhere');
  });

  // The bytes are on disk: downloading them again wouldn't fix a conversion.
  it('offers no retry when only the CHD conversion failed', () => {
    renderRow({ kind: 'failed', reason: 'chdman exited 1', convertFailed: true });
    expect(screen.getByText('chdman exited 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
  });

  it('falls back to a generic reason', () => {
    renderRow({ kind: 'failed' });
    expect(screen.getByText('Raison inconnue')).toBeInTheDocument();
  });
});
