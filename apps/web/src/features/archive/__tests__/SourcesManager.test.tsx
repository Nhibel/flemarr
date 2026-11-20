import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SourcesManager } from '../SourcesManager.js';
import * as api from '@/lib/api.js';

vi.mock('@/lib/api.js');

const SYSTEM = 'Nintendo - Super Nintendo Entertainment System';

function renderManager() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SourcesManager datId="dat1" system={SYSTEM} source="no-intro" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchSources).mockResolvedValue({
    system: SYSTEM,
    sources: [
      {
        identifier: 'ni-roms',
        layout: 'zip-collection',
        note: 'No-Intro full sets',
        searched: true,
      },
    ],
  });
});

describe('SourcesManager — remove', () => {
  it('deletes scoped to the open system', async () => {
    vi.mocked(api.deleteSource).mockResolvedValue(undefined);
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: /supprimer/i }));

    await waitFor(() =>
      expect(vi.mocked(api.deleteSource)).toHaveBeenCalledWith('ni-roms', SYSTEM),
    );
  });

  // A failed delete used to leave no trace at all: the row stayed, nothing
  // was said, and the user had no way to tell it had not worked.
  it('reports a failed delete on the row', async () => {
    vi.mocked(api.deleteSource).mockRejectedValue(new Error('HTTP 500'));
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: /supprimer/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500');
    expect(screen.getByText('ni-roms')).toBeInTheDocument();
  });

  it('disables the button while the delete is in flight', async () => {
    let release: () => void = () => undefined;
    vi.mocked(api.deleteSource).mockImplementation(
      () => new Promise((resolve) => (release = () => resolve(undefined))),
    );
    renderManager();

    const btn = await screen.findByRole('button', { name: /supprimer/i });
    await userEvent.click(btn);

    await waitFor(() => expect(btn).toBeDisabled());
    await userEvent.click(btn);
    expect(vi.mocked(api.deleteSource)).toHaveBeenCalledTimes(1);

    release();
  });
});

describe('SourcesManager — suggestions', () => {
  const SUGGESTION = {
    identifier: 'ni-roms',
    title: 'No-Intro full sets',
    layout: 'zip-collection' as const,
    fileCount: 120,
    coverage: 0.9,
    crcCoverage: 0.85,
    sampleSize: 50,
  };

  it('marks a suggestion already configured for this system', async () => {
    vi.mocked(api.suggestSources).mockResolvedValue({ suggestions: [SUGGESTION] });
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: /suggérer des sources/i }));

    expect(await screen.findByText(/déjà ajoutée/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /adopter/i })).not.toBeInTheDocument();
  });

  // Filtering adopted rows out of the list is what made the panel announce
  // "nothing found" once the last suggestion had been taken.
  it('keeps an adopted suggestion listed instead of claiming nothing was found', async () => {
    vi.mocked(api.fetchSources).mockResolvedValue({ system: SYSTEM, sources: [] });
    vi.mocked(api.suggestSources).mockResolvedValue({ suggestions: [SUGGESTION] });
    vi.mocked(api.addSource).mockResolvedValue(undefined);
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: /suggérer des sources/i }));
    const adopt = await screen.findByRole('button', { name: /adopter/i });

    vi.mocked(api.fetchSources).mockResolvedValue({
      system: SYSTEM,
      sources: [
        {
          identifier: 'ni-roms',
          layout: 'zip-collection',
          note: 'No-Intro full sets',
          searched: true,
        },
      ],
    });
    await userEvent.click(adopt);

    expect(await screen.findByText(/déjà ajoutée/i)).toBeInTheDocument();
    expect(screen.queryByText(/aucune collection candidate/i)).not.toBeInTheDocument();
  });

  it('still reports a genuinely empty suggestion run', async () => {
    vi.mocked(api.suggestSources).mockResolvedValue({ suggestions: [] });
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: /suggérer des sources/i }));

    expect(await screen.findByText(/aucune collection candidate/i)).toBeInTheDocument();
  });
});

describe('SourcesManager — switching sources on and off', () => {
  const NI = { identifier: 'ni-roms', layout: 'zip-collection' as const, note: '', searched: true };
  const SET = { identifier: 'snes-set', layout: 'direct' as const, note: '', searched: true };

  beforeEach(() => {
    vi.mocked(api.fetchSources).mockResolvedValue({ system: SYSTEM, sources: [NI, SET] });
    vi.mocked(api.setSourceSearched).mockResolvedValue(undefined);
  });

  it('shows every source as stored, and says what will be searched', async () => {
    vi.mocked(api.fetchSources).mockResolvedValue({
      system: SYSTEM,
      sources: [NI, { ...SET, searched: false }],
    });
    renderManager();
    expect(await screen.findByRole('switch', { name: 'Chercher dans ni-roms' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Chercher dans snes-set' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByText('La recherche portera sur 1 source sur 2.')).toBeInTheDocument();
  });

  it('stores the new state and refreshes the list', async () => {
    renderManager();
    await userEvent.click(await screen.findByRole('switch', { name: 'Chercher dans ni-roms' }));
    await waitFor(() =>
      expect(api.setSourceSearched).toHaveBeenCalledWith('ni-roms', SYSTEM, false),
    );
    await waitFor(() => expect(api.fetchSources).toHaveBeenCalledTimes(2));
  });

  it('says everything is searched while all are on', async () => {
    renderManager();
    expect(
      await screen.findByText('La recherche portera sur toutes les sources.'),
    ).toBeInTheDocument();
  });

  it('offers no choice with a single source', async () => {
    vi.mocked(api.fetchSources).mockResolvedValue({ system: SYSTEM, sources: [NI] });
    renderManager();
    expect(await screen.findByText('ni-roms')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
