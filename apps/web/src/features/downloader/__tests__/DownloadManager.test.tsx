import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DownloadManager } from '../DownloadManager.js';
import type { QueuedDownload } from '../job-state.js';
import type * as ApiModule from '@/lib/api.js';

vi.mock('@/lib/api.js', async (orig) => {
  const actual = await orig<typeof ApiModule>();
  return {
    ...actual,
    openDownloadEvents: vi.fn(),
    cancelDownload: vi.fn(),
    cancelDownloadItem: vi.fn(),
    startDownload: vi.fn(),
    resolveGames: vi.fn(),
  };
});

import { openDownloadEvents, startDownload, resolveGames } from '@/lib/api.js';

// A minimal stand-in for the real EventSource (not available in jsdom) —
// just enough surface for DownloadManager to attach handlers to and for
// this test to drive them directly.
class FakeEventSource {
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
}

function makeJob(jobId: string, gameId: string, romName: string): QueuedDownload {
  return {
    jobId,
    datId: 'dat-1',
    items: [
      {
        gameId,
        romName,
        expectedCrc: 'aabbccdd',
        sources: [{ url: 'https://example.invalid/a.zip', extractFromZip: false }],
      },
    ],
    target: 'server',
    destinationDir: '/roms',
  };
}

function renderManager(props: Parameters<typeof DownloadManager>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DownloadManager {...props} />
    </QueryClientProvider>,
  );
}

describe('DownloadManager — clear completed', () => {
  let sources: Map<string, FakeEventSource>;

  beforeEach(() => {
    sources = new Map();
    vi.mocked(openDownloadEvents).mockImplementation((jobId: string) => {
      const es = new FakeEventSource();
      sources.set(jobId, es);
      return es as unknown as EventSource;
    });
  });

  function emit(jobId: string, event: unknown): void {
    act(() => {
      sources.get(jobId)!.onmessage!({ data: JSON.stringify(event) });
    });
  }

  it('only enables the button once a job finishes, and clears only that job', async () => {
    const jobA = makeJob('job-a', 'g1', 'Game A.sfc');
    const jobB = makeJob('job-b', 'g2', 'Game B.sfc');
    const onClearCompleted = vi.fn();

    renderManager({ jobs: [jobA, jobB], onClearCompleted });

    const button = screen.getByRole('button', { name: /vider/i });
    expect(button).toBeDisabled();

    // job-a finishes, job-b is still running.
    emit('job-a', { type: 'complete' });
    expect(button).not.toBeDisabled();

    await userEvent.click(button);

    expect(onClearCompleted).toHaveBeenCalledWith(['job-a']);
    // job-b's own EventSource must never be touched by clearing job-a.
    expect(sources.get('job-b')!.close).not.toHaveBeenCalled();
  });

  it('stays disabled while every job is still running', () => {
    const jobA = makeJob('job-a', 'g1', 'Game A.sfc');
    renderManager({ jobs: [jobA], onClearCompleted: vi.fn() });

    expect(screen.getByRole('button', { name: /vider/i })).toBeDisabled();
  });

  it("treats a lost connection ('error') as finished, not running", () => {
    const jobA = makeJob('job-a', 'g1', 'Game A.sfc');
    renderManager({ jobs: [jobA], onClearCompleted: vi.fn() });

    act(() => {
      sources.get('job-a')!.onerror!();
    });

    expect(screen.getByRole('button', { name: /vider/i })).not.toBeDisabled();
  });

  it('keeps following a running job when another one is queued', () => {
    const jobA = makeJob('job-a', 'g1', 'Game A.sfc');
    const jobB = makeJob('job-b', 'g2', 'Game B.sfc');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <DownloadManager jobs={[jobA]} onClearCompleted={vi.fn()} />
      </QueryClientProvider>,
    );

    rerender(
      <QueryClientProvider client={client}>
        <DownloadManager jobs={[jobA, jobB]} onClearCompleted={vi.fn()} />
      </QueryClientProvider>,
    );

    // Queueing job-b used to close job-a's stream: its progress froze
    // while the server kept downloading.
    expect(sources.get('job-a')!.close).not.toHaveBeenCalled();
    emit('job-a', { type: 'complete' });
    expect(screen.getByRole('button', { name: /vider/i })).not.toBeDisabled();
  });
});

describe('DownloadManager — one row per game', () => {
  let sources: Map<string, FakeEventSource>;

  beforeEach(() => {
    sources = new Map();
    vi.mocked(openDownloadEvents).mockImplementation((jobId: string) => {
      const es = new FakeEventSource();
      sources.set(jobId, es);
      return es as unknown as EventSource;
    });
    vi.mocked(startDownload).mockReset().mockResolvedValue('job-retry');
    vi.mocked(resolveGames).mockReset();
  });

  function emit(jobId: string, event: unknown) {
    act(() => sources.get(jobId)?.onmessage?.({ data: JSON.stringify(event) }));
  }

  /** A three-disc game: three items, one gameId. */
  function discGame(): QueuedDownload {
    return {
      jobId: 'j1',
      datId: 'dat-1',
      target: 'server',
      destinationDir: '/roms',
      items: ['d1.bin', 'd2.bin', 'g.cue'].map((romName) => ({
        gameId: 'g1',
        romName,
        expectedCrc: 'aabbccdd',
        sources: [{ url: 'https://example.invalid/a.zip', extractFromZip: false }],
      })),
    };
  }

  // The whole point of the rework: three files used to be three rows, with
  // the conversion step a fourth entry somewhere else on screen.
  it('shows a three-disc game as a single row', () => {
    renderManager({ jobs: [discGame()] });
    emit('j1', {
      type: 'progress',
      gameId: 'g1',
      romName: 'd1.bin',
      bytesDownloaded: 500,
      totalBytes: 1000,
    });

    expect(screen.getAllByText(/3 fichiers/)).toHaveLength(1);
    expect(screen.getByText('g')).toBeInTheDocument();
  });

  it('offers both recovery actions on a failure, with the reason', () => {
    renderManager({ jobs: [discGame()] });
    emit('j1', {
      type: 'file-failed',
      gameId: 'g1',
      romName: 'd1.bin',
      reason: 'Source indisponible',
    });

    expect(screen.getByText('Source indisponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chercher ailleurs' })).toBeInTheDocument();
  });

  it('retrying reuses the sources the game already had, without resolving', async () => {
    const user = userEvent.setup();
    const onQueueRetry = vi.fn();
    renderManager({ jobs: [discGame()], onQueueRetry });
    emit('j1', { type: 'file-failed', gameId: 'g1', romName: 'd1.bin', reason: 'boom' });

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(resolveGames).not.toHaveBeenCalled();
    expect(startDownload).toHaveBeenCalledWith(
      expect.objectContaining({ datId: 'dat-1', target: 'server', destinationDir: '/roms' }),
    );
    // Every file of the game goes back in, not just the one that failed:
    // the others were cancelled when it died.
    expect(vi.mocked(startDownload).mock.calls[0]?.[0].items).toHaveLength(3);
    expect(onQueueRetry).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-retry' }));
  });

  it('"Chercher ailleurs" resolves again before queueing', async () => {
    const user = userEvent.setup();
    vi.mocked(resolveGames).mockResolvedValue({
      results: [
        {
          gameId: 'g1',
          roms: [
            {
              romName: 'd1.bin',
              expectedCrc: 'aabbccdd',
              sources: [
                {
                  downloadUrl: 'https://other.invalid/d1.bin',
                  extractFromZip: false,
                  identifier: 'other',
                  container: 'direct',
                  verified: true,
                },
              ],
            },
          ],
        },
      ],
    } as unknown as Awaited<ReturnType<typeof resolveGames>>);

    renderManager({ jobs: [discGame()], onQueueRetry: vi.fn() });
    emit('j1', { type: 'file-failed', gameId: 'g1', romName: 'd1.bin', reason: 'boom' });

    await user.click(screen.getByRole('button', { name: 'Chercher ailleurs' }));

    expect(resolveGames).toHaveBeenCalledWith('dat-1', ['g1']);
    expect(vi.mocked(startDownload).mock.calls[0]?.[0].items[0]?.sources[0]?.url).toBe(
      'https://other.invalid/d1.bin',
    );
  });

  it('says so when no other source has the game', async () => {
    const user = userEvent.setup();
    vi.mocked(resolveGames).mockResolvedValue({
      results: [{ gameId: 'g1', roms: [{ romName: 'd1.bin', expectedCrc: 'aa', sources: [] }] }],
    } as unknown as Awaited<ReturnType<typeof resolveGames>>);

    renderManager({ jobs: [discGame()], onQueueRetry: vi.fn() });
    emit('j1', { type: 'file-failed', gameId: 'g1', romName: 'd1.bin', reason: 'boom' });
    await user.click(screen.getByRole('button', { name: 'Chercher ailleurs' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/aucune autre source/i);
    expect(startDownload).not.toHaveBeenCalled();
  });

  // The bytes are already on disk; re-downloading them is not the fix.
  it('offers no retry when it was the conversion that failed', () => {
    renderManager({ jobs: [discGame()] });
    for (const romName of ['d1.bin', 'd2.bin', 'g.cue']) {
      emit('j1', { type: 'file-done', gameId: 'g1', romName });
    }
    emit('j1', { type: 'game-convert-failed', gameId: 'g1', reason: 'chdman a échoué' });

    expect(screen.getByText('chdman a échoué')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
  });
});

describe('DownloadManager — the card counts one unit throughout', () => {
  let sources: Map<string, FakeEventSource>;

  beforeEach(() => {
    sources = new Map();
    vi.mocked(openDownloadEvents).mockImplementation((jobId: string) => {
      const es = new FakeEventSource();
      sources.set(jobId, es);
      return es as unknown as EventSource;
    });
  });

  // Camille caught this in the browser: the header counted files while the
  // summary line and the rows counted games, so two two-disc games read as
  // "0 / 4 téléchargés" above "2 en cours" above two rows.
  it('reports games in the header, not files', () => {
    const twoDiscGames: QueuedDownload = {
      jobId: 'j1',
      datId: 'dat-1',
      target: 'browser',
      items: [
        ['g1', 'a-d1.bin'],
        ['g1', 'a-d2.bin'],
        ['g2', 'b-d1.bin'],
        ['g2', 'b-d2.bin'],
      ].map(([gameId, romName]) => ({
        gameId: gameId!,
        romName: romName!,
        expectedCrc: 'aabbccdd',
        sources: [{ url: 'https://example.invalid/a.zip', extractFromZip: false }],
      })),
    };

    renderManager({ jobs: [twoDiscGames] });
    act(() =>
      sources.get('j1')?.onmessage?.({
        data: JSON.stringify({
          type: 'progress',
          gameId: 'g1',
          romName: 'a-d1.bin',
          bytesDownloaded: 100,
          totalBytes: 1000,
        }),
      }),
    );

    expect(screen.getByText('0 / 2 jeux téléchargés')).toBeInTheDocument();
    expect(screen.queryByText(/\/ 4/)).not.toBeInTheDocument();
    // Four files, two rows.
    expect(screen.getAllByText(/2 fichiers/)).toHaveLength(2);
  });
});
