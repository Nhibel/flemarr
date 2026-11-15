import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

    expect(await screen.findByRole('button', { name: /fresh1g1r/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /rom-curator/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manuel/i })).toBeInTheDocument();
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
