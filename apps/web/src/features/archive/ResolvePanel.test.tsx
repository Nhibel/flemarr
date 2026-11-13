import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResolvePanel } from './ResolvePanel.js';
import * as api from '@/lib/api.js';

vi.mock('@/lib/api.js');

const SYSTEM = 'Nintendo - Super Nintendo Entertainment System';
const SOURCE = { identifier: 'ni-roms', layout: 'zip-collection' as const, note: '' };

const RESOLVED: api.ResolveResponse = {
  results: [
    {
      gameId: 'smw',
      gameName: 'Super Mario World (USA)',
      roms: [
        {
          romName: 'Super Mario World (USA).sfc',
          expectedCrc: 'b19ed489',
          sources: [
            {
              identifier: 'ni-roms',
              container: 'zip-view',
              extractFromZip: true,
              downloadUrl: 'https://archive.org/view_archive.php?archive=x&file=y',
              verified: true,
            },
          ],
        },
      ],
    },
  ],
};

let client: QueryClient;

function renderPanel(onQueueDownload = vi.fn()) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ResolvePanel
        datId="dat1"
        system={SYSTEM}
        selectedGameIds={['smw']}
        missingGameIds={null}
        onQueueDownload={onQueueDownload}
      />
    </QueryClientProvider>,
  );
  return { onQueueDownload };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchSources).mockResolvedValue({ system: SYSTEM, sources: [SOURCE] });
  vi.mocked(api.getSettings).mockResolvedValue({
    fresh1g1rPreset: 'PropeR',
    downloaderConcurrency: 2,
    systemPaths: {},
    // Browser target: no library folder needed, so the panel never gates the
    // download button on a missing destination.
    downloadTarget: 'browser',
    autoConvertChd: false,
    archiveOrgKeysConfigured: false,
    archiveOrgSessionConfigured: false,
    romsRoot: null,
  });
  vi.mocked(api.resolveGames).mockResolvedValue(RESOLVED);
  vi.mocked(api.startDownload).mockResolvedValue('job1');
});

async function resolveOnce() {
  await userEvent.click(await screen.findByRole('button', { name: /chercher les sources/i }));
  return screen.findByRole('button', { name: /télécharger/i });
}

describe('ResolvePanel — results vs. source changes', () => {
  it('queues a download from a fresh resolve', async () => {
    const { onQueueDownload } = renderPanel();
    await userEvent.click(await resolveOnce());
    await waitFor(() => expect(onQueueDownload).toHaveBeenCalled());
  });

  // The server drops its resolver cache when sources change, but these results
  // are client state: queueing them would download from a source just removed.
  it('blocks the download and warns once the sources changed', async () => {
    const { onQueueDownload } = renderPanel();
    const downloadBtn = await resolveOnce();

    vi.mocked(api.fetchSources).mockResolvedValue({ system: SYSTEM, sources: [] });
    await client.invalidateQueries({ queryKey: ['archive-sources', SYSTEM] });

    expect(await screen.findByText(/les sources ont changé/i)).toBeInTheDocument();
    await waitFor(() => expect(downloadBtn).toBeDisabled());
    expect(onQueueDownload).not.toHaveBeenCalled();
  });

  it('treats a corrected layout as a change too', async () => {
    renderPanel();
    await resolveOnce();

    vi.mocked(api.fetchSources).mockResolvedValue({
      system: SYSTEM,
      sources: [{ ...SOURCE, layout: 'direct' }],
    });
    await client.invalidateQueries({ queryKey: ['archive-sources', SYSTEM] });

    expect(await screen.findByText(/les sources ont changé/i)).toBeInTheDocument();
  });

  it('clears the warning after re-resolving', async () => {
    renderPanel();
    await resolveOnce();

    vi.mocked(api.fetchSources).mockResolvedValue({ system: SYSTEM, sources: [] });
    await client.invalidateQueries({ queryKey: ['archive-sources', SYSTEM] });
    expect(await screen.findByText(/les sources ont changé/i)).toBeInTheDocument();

    vi.mocked(api.fetchSources).mockResolvedValue({ system: SYSTEM, sources: [SOURCE] });
    await client.invalidateQueries({ queryKey: ['archive-sources', SYSTEM] });
    await userEvent.click(await screen.findByRole('button', { name: /chercher les sources/i }));

    await waitFor(() =>
      expect(screen.queryByText(/les sources ont changé/i)).not.toBeInTheDocument(),
    );
  });
});
