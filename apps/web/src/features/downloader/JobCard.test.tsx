import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@/lib/api.js';
import type { ItemState, JobState } from './job-state.js';
import { JobCard } from './JobCard.js';

vi.mock('@/lib/api.js');

function item(over: Partial<ItemState> & Pick<ItemState, 'gameId' | 'romName'>): ItemState {
  return {
    status: 'queued',
    progress: 0,
    bytesDownloaded: 0,
    totalBytes: 0,
    ...over,
  };
}

function job(over: Partial<JobState> = {}): JobState {
  return {
    jobId: 'job1',
    target: 'server',
    destinationDir: '/roms/psx',
    status: 'running',
    items: [
      item({ gameId: 'a', romName: 'Alpha.bin', status: 'done', progress: 100 }),
      item({ gameId: 'b', romName: 'Beta.bin' }),
    ],
    gameConversions: new Map(),
    ...over,
  };
}

function withQueryClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderCard(state: JobState, onRetry = vi.fn()) {
  render(withQueryClient(<JobCard state={state} onRetry={onRetry} />));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getSettings).mockResolvedValue({
    fresh1g1rPreset: 'PropeR',
    downloaderConcurrency: 2,
    systemPaths: {},
    downloadTarget: 'server',
    topology: 'local',
    autoConvertChd: false,
    archiveOrgKeysConfigured: false,
    archiveOrgSessionConfigured: false,
    romsRoot: '/roms',
  });
  vi.mocked(api.cancelDownload).mockResolvedValue(undefined);
});

describe('JobCard', () => {
  it('says where the files go, relative to the library root', async () => {
    renderCard(job());
    expect(await screen.findByText('→ /psx')).toBeInTheDocument();
  });

  it('says the browser is the destination of a browser job, and explains it', () => {
    renderCard(job({ target: 'browser', destinationDir: undefined }));
    expect(screen.getByText('→ Mon navigateur')).toBeInTheDocument();
    expect(screen.getByText(/arrivent dans les téléchargements/)).toBeInTheDocument();
  });

  it('counts progress in games, not files', () => {
    renderCard(job());
    expect(screen.getByText('1 / 2 jeux téléchargés')).toBeInTheDocument();
  });

  it('shows one row per game', () => {
    renderCard(job());
    expect(screen.getByText('Alpha.bin')).toBeInTheDocument();
    expect(screen.getByText('Beta.bin')).toBeInTheDocument();
  });

  it('cancels the whole job', async () => {
    renderCard(job());
    const cancelButtons = screen.getAllByRole('button', { name: 'Annuler' });
    // The job's own button comes first, before the per-game ones.
    await userEvent.click(cancelButtons[0]!);
    await waitFor(() => expect(api.cancelDownload).toHaveBeenCalledWith('job1'));
  });

  it('says why the job could not be cancelled', async () => {
    vi.mocked(api.cancelDownload).mockRejectedValue(new Error('Job job1 not found'));
    renderCard(job());
    await userEvent.click(screen.getAllByRole('button', { name: 'Annuler' })[0]!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Job job1 not found');
  });

  it('offers no cancel once the job is over', () => {
    renderCard(
      job({
        status: 'done',
        items: [item({ gameId: 'a', romName: 'Alpha.bin', status: 'done', progress: 100 })],
      }),
    );
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
  });

  it('explains the CHD step when a game is being converted', () => {
    renderCard(job({ gameConversions: new Map([['a', { status: 'converting' }]]) }));
    expect(screen.getByText(/regroupés en un seul fichier/)).toBeInTheDocument();
  });
});
