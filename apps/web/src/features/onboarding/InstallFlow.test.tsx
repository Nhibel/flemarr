import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InstallFlow } from './InstallFlow.js';
import { getSettings } from '@/lib/api.js';
import type { SettingsResponse } from '@/lib/api.js';

vi.mock('@/lib/api.js', async (orig) => {
  const actual = await orig<typeof import('@/lib/api.js')>();
  return {
    ...actual,
    getSettings: vi.fn(),
    listDatSources: vi.fn().mockResolvedValue({ preset: 'PropeR', sources: [] }),
    fetchSources: vi.fn().mockResolvedValue({ sources: [] }),
  };
});

function settings(over: Partial<SettingsResponse> = {}): SettingsResponse {
  return {
    fresh1g1rPreset: 'PropeR',
    downloaderConcurrency: 2,
    systemPaths: {},
    archiveOrgKeysConfigured: false,
    archiveOrgSessionConfigured: false,
    downloadTarget: 'server',
    topology: 'local',
    autoConvertChd: false,
    romsRoot: null,
    ...over,
  };
}

function renderFlow(startAt: 'topology' | 'console') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InstallFlow startAt={startAt} onDone={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(getSettings).mockReset();
});

describe('InstallFlow', () => {
  it('numbers the steps over the whole sequence when a folder is involved', async () => {
    vi.mocked(getSettings).mockResolvedValue(settings({ topology: 'local' }));
    renderFlow('topology');

    expect(await screen.findByText(/Étape 1 sur 4/)).toBeInTheDocument();
    expect(screen.getByText('Dossier')).toBeInTheDocument();
  });

  // The server cannot read the collection in remote mode, so there is no
  // folder to ask for — and the count has to say 3, not 4 with a step
  // nobody can reach.
  it('leaves the folder step out entirely in remote mode', async () => {
    vi.mocked(getSettings).mockResolvedValue(settings({ topology: 'remote' }));
    renderFlow('topology');

    expect(await screen.findByText(/Étape 1 sur 3/)).toBeInTheDocument();
    expect(screen.queryByText('Dossier')).not.toBeInTheDocument();
  });

  it('starts at the console, without a topology step, when adding one', async () => {
    vi.mocked(getSettings).mockResolvedValue(settings({ topology: 'local' }));
    renderFlow('console');

    expect(await screen.findByText(/Étape 1 sur 3/)).toBeInTheDocument();
    expect(screen.queryByText('Machine')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /quelle console veux-tu collectionner/i }),
    ).toBeInTheDocument();
  });

  // What "back from the sources lands on the console" looks like from
  // outside: the rendered sequence is Console then Sources, with nothing in
  // between. The navigation itself is covered by install-steps' own tests,
  // which can reach the sources step without a loaded DAT.
  it('renders the sequence with no gap where the folder step would be', async () => {
    vi.mocked(getSettings).mockResolvedValue(settings({ topology: 'remote' }));
    renderFlow('console');

    // Waiting on the count first, because the sequence starts at its
    // longest and shrinks once the topology answer arrives — asserting
    // immediately would catch the pre-settings render.
    await screen.findByText(/Étape 1 sur 2/);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['1Console', '2Sources']);
  });

  it('has no Retour on the first step', async () => {
    vi.mocked(getSettings).mockResolvedValue(settings({ topology: 'local' }));
    renderFlow('topology');

    await screen.findByText(/Étape 1 sur 4/);
    expect(screen.queryByRole('button', { name: /retour/i })).not.toBeInTheDocument();
  });

  it('cannot continue before a console is chosen', async () => {
    vi.mocked(getSettings).mockResolvedValue(settings({ topology: 'local' }));
    renderFlow('console');

    expect(await screen.findByRole('button', { name: /continuer/i })).toBeDisabled();
  });
});
