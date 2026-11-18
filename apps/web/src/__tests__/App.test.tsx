import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../App.js';
import { getSettings, listDats } from '@/lib/api.js';
import type { SettingsResponse } from '@/lib/api.js';

vi.mock('@/lib/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api.js')>();
  return { ...actual, getSettings: vi.fn(), listDats: vi.fn() };
});

const getSettingsMock = vi.mocked(getSettings);
const listDatsMock = vi.mocked(listDats);

function settings(over: Partial<SettingsResponse> = {}): SettingsResponse {
  return {
    fresh1g1rPreset: 'PropeR',
    downloaderConcurrency: 2,
    systemPaths: {},
    archiveOrgKeysConfigured: false,
    archiveOrgSessionConfigured: false,
    downloadTarget: 'server',
    topology: null,
    autoConvertChd: false,
    romsRoot: null,
    ...over,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  getSettingsMock.mockReset();
  listDatsMock.mockReset();
  getSettingsMock.mockResolvedValue(settings());
  listDatsMock.mockResolvedValue([]);
});

describe('App', () => {
  it('renders the heading and mode toggle on initial load', async () => {
    // A fresh install answers the topology question first, so this is the
    // screen after it: the DAT loader.
    getSettingsMock.mockResolvedValue(settings({ topology: 'local' }));
    render(<App />, { wrapper });

    // With no DAT registered, the two ways to add a system render inline
    // rather than behind the "+ Ajouter un système" button — a first run
    // would otherwise be an empty screen whose only content is a button.
    expect(await screen.findByRole('button', { name: /fresh1g1r/i })).toBeInTheDocument();
    // The home title is the Flemarr wordmark since 2026-11-18, so the
    // heading's accessible name is the image's alt text. Asserting the
    // name rather than just the role is what catches a logo that ships
    // with no alt at all.
    expect(screen.getByRole('heading', { name: /flemarr/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importer un \.dat/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ajouter un système/i })).not.toBeInTheDocument();
  });

  it('asks where the games live on a never-used install', async () => {
    render(<App />, { wrapper });
    expect(await screen.findByRole('heading', { name: /où vivent tes jeux/i })).toBeInTheDocument();
  });

  // The three guards that keep an existing install out of the install flow.
  // Answering the question writes downloadTarget, so showing it to someone
  // who already has a working setup could silently move where their files
  // go. Each of these alone must be enough to skip it.
  it.each([
    ['the question was already answered', settings({ topology: 'remote' })],
    ['a system folder is configured', settings({ systemPaths: { SNES: '/roms/snes' } })],
  ])('skips the install flow when %s', async (_label, s) => {
    getSettingsMock.mockResolvedValue(s);
    render(<App />, { wrapper });

    expect(await screen.findByRole('button', { name: /fresh1g1r/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /où vivent tes jeux/i })).not.toBeInTheDocument();
  });

  it('skips the install flow when a DAT has already been loaded', async () => {
    listDatsMock.mockResolvedValue([
      { id: 'd1', system: 'SNES', gameCount: 10, source: 'no-intro' },
    ]);
    render(<App />, { wrapper });

    expect(await screen.findByRole('button', { name: /fresh1g1r/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /où vivent tes jeux/i })).not.toBeInTheDocument();
  });

  it('does not flash the install flow before the settings have loaded', async () => {
    // Both queries have to resolve before the gate can decide. Rendering
    // the question while they are pending would show it for a frame on
    // every cold load, including installs that must never see it.
    render(<App />, { wrapper });
    expect(screen.queryByRole('heading', { name: /où vivent tes jeux/i })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /où vivent tes jeux/i })).toBeInTheDocument(),
    );
  });
});

describe('App — the systems screen', () => {
  const dats = [
    { id: 'd1', system: 'Super Nintendo', gameCount: 1842, source: 'no-intro' as const },
    { id: 'd2', system: 'PlayStation', gameCount: 1304, source: 'redump' as const },
  ];

  beforeEach(() => {
    getSettingsMock.mockResolvedValue(settings({ topology: 'local' }));
    listDatsMock.mockResolvedValue(dats);
  });

  it('shows one card per registered system', async () => {
    render(<App />, { wrapper });

    expect(await screen.findByRole('button', { name: /^Super Nintendo/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^PlayStation/ })).toBeInTheDocument();
    // Removing a system is its own control, not part of the card's target.
    expect(screen.getByRole('button', { name: 'Retirer Super Nintendo' })).toBeInTheDocument();
  });

  // The console catalogue is long, and it is not what you came for when you
  // already have systems to open.
  it('keeps the catalogue behind a button once a system exists', async () => {
    render(<App />, { wrapper });

    expect(await screen.findByRole('button', { name: /ajouter un système/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fresh1g1r/i })).not.toBeInTheDocument();
  });

  it('opens the catalogue in a dialog', async () => {
    const user = userEvent.setup();
    render(<App />, { wrapper });

    await user.click(await screen.findByRole('button', { name: /ajouter un système/i }));

    const dialog = screen.getByRole('dialog', { name: /ajouter un système/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fresh1g1r/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('button', { name: /fresh1g1r/i })).not.toBeInTheDocument();
  });
});
