import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SettingsResponse } from '@shared/settings.js';
import * as api from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { SystemFolderBar } from '../SystemFolderBar.js';

vi.mock('@/lib/api.js');

const SNES = 'Nintendo - SNES';

const SETTINGS: SettingsResponse = {
  fresh1g1rPreset: 'PropeR',
  downloaderConcurrency: 2,
  systemPaths: {},
  downloadTarget: 'server',
  topology: 'local',
  autoConvertChd: false,
  archiveOrgKeysConfigured: false,
  archiveOrgSessionConfigured: false,
  romsRoot: null,
};

function renderBar(settings: Partial<SettingsResponse> = {}) {
  vi.mocked(api.getSettings).mockResolvedValue({ ...SETTINGS, ...settings });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SystemFolderBar system={SNES} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

async function startEditing(label: string) {
  await userEvent.click(await screen.findByRole('button', { name: label }));
  return screen.getByPlaceholderText('Choisir ou créer un dossier');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchSystemIcons).mockResolvedValue({ icons: [] });
  vi.mocked(api.listDirs).mockResolvedValue({
    listedPath: '/',
    parent: null,
    dirs: [],
    fileCount: 0,
  });
});

describe('SystemFolderBar', () => {
  // Server downloads land in this folder too, so it is needed for both.
  it('says what an unset folder blocks, by download target', async () => {
    renderBar();
    expect(
      await screen.findByText(/requis pour le scanner et les téléchargements/),
    ).toBeInTheDocument();
  });

  it('only needs the folder for the scanner with browser downloads', async () => {
    renderBar({ downloadTarget: 'browser' });
    expect(await screen.findByText('non défini — requis pour le scanner')).toBeInTheDocument();
  });

  it('shows the folder set, and offers to change it', async () => {
    renderBar({ systemPaths: { [SNES]: '/roms/snes' } });
    expect(await screen.findByText('/roms/snes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
  });

  it('saves an existing folder and puts the new settings in the cache', async () => {
    vi.mocked(api.validateDir).mockResolvedValue({ exists: true, isDirectory: true });
    const updated = { ...SETTINGS, systemPaths: { [SNES]: '/roms/snes' } };
    vi.mocked(api.updateSettings).mockResolvedValue(updated);
    const { queryClient } = renderBar();
    const input = await startEditing('Choisir…');
    await userEvent.type(input, ' /roms/snes ');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith({ systemPaths: { [SNES]: '/roms/snes' } }),
    );
    expect(queryClient.getQueryData(queryKeys.settings())).toEqual(updated);
    expect(await screen.findByRole('button', { name: 'Modifier' })).toBeInTheDocument();
  });

  it('refuses a path that does not exist', async () => {
    vi.mocked(api.validateDir).mockResolvedValue({ exists: false, isDirectory: false });
    renderBar();
    const input = await startEditing('Choisir…');
    await userEvent.type(input, '/nope');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Chemin introuvable')).toBeInTheDocument();
    expect(api.updateSettings).not.toHaveBeenCalled();
  });

  it('refuses a file', async () => {
    vi.mocked(api.validateDir).mockResolvedValue({ exists: true, isDirectory: false });
    renderBar();
    const input = await startEditing('Choisir…');
    await userEvent.type(input, '/roms/readme.txt');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(
      await screen.findByText("Ce chemin existe mais n'est pas un dossier"),
    ).toBeInTheDocument();
  });

  it('leaves the folder as it was on cancel', async () => {
    renderBar({ systemPaths: { [SNES]: '/roms/snes' } });
    const input = await startEditing('Modifier');
    expect(input).toHaveValue('/roms/snes');
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('/roms/snes')).toBeInTheDocument();
    expect(api.updateSettings).not.toHaveBeenCalled();
  });
});
