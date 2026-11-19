import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SettingsResponse } from '@shared/settings.js';
import * as api from '@/lib/api.js';
import { PathInput } from './PathInput.js';

vi.mock('@/lib/api.js');

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

const ROMS_LISTING = {
  listedPath: '/roms',
  parent: '/',
  dirs: [
    { path: '/roms/snes', fileCount: 3 },
    { path: '/roms/empty', fileCount: 0 },
  ],
  fileCount: 0,
};

/** PathInput is controlled: this harness owns the value, as its callers do. */
function Harness({ initial, onChange }: { initial: string; onChange: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PathInput
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function renderInput(initial = '/roms') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <Harness initial={initial} onChange={onChange} />
      <button type="button">ailleurs</button>
    </QueryClientProvider>,
  );
  return { onChange, input: screen.getAllByRole('textbox')[0]! };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getSettings).mockResolvedValue(SETTINGS);
  vi.mocked(api.listDirs).mockResolvedValue(ROMS_LISTING);
  vi.mocked(api.createDir).mockResolvedValue({ path: '/roms/gba' });
});

describe('PathInput', () => {
  it('lists nothing until the field is focused', async () => {
    renderInput();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(api.listDirs).not.toHaveBeenCalled();
    expect(screen.queryByText('snes')).not.toBeInTheDocument();
  });

  it('lists the subfolders on focus, with their file count when not empty', async () => {
    const { input } = renderInput();
    await userEvent.click(input);
    expect(await screen.findByText('snes')).toBeInTheDocument();
    expect(screen.getByText('3 fichiers')).toBeInTheDocument();
    expect(screen.getByText('empty')).toBeInTheDocument();
    expect(screen.queryByText(/0 fichier/)).not.toBeInTheDocument();
  });

  it('steps into a subfolder', async () => {
    const { input, onChange } = renderInput();
    await userEvent.click(input);
    await userEvent.click(await screen.findByText('snes'));
    expect(onChange).toHaveBeenLastCalledWith('/roms/snes');
  });

  it('steps up to the parent folder', async () => {
    const { input, onChange } = renderInput();
    await userEvent.click(input);
    await userEvent.click(await screen.findByRole('button', { name: /\.\./ }));
    expect(onChange).toHaveBeenLastCalledWith('/');
  });

  it('closes once focus leaves it', async () => {
    const { input } = renderInput();
    await userEvent.click(input);
    await screen.findByText('snes');
    await userEvent.click(screen.getByRole('button', { name: 'ailleurs' }));
    expect(screen.queryByText('snes')).not.toBeInTheDocument();
  });

  it('creates a folder in the listed one and steps into it', async () => {
    const { input, onChange } = renderInput();
    await userEvent.click(input);
    await userEvent.type(await screen.findByPlaceholderText('Nouveau dossier…'), 'gba{Enter}');
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('/roms/gba'));
    expect(api.createDir).toHaveBeenCalledWith('/roms/gba');
  });

  it('refuses to create a folder with an empty name', async () => {
    const { input } = renderInput();
    await userEvent.click(input);
    await screen.findByText('snes');
    expect(screen.getByRole('button', { name: '+ Créer' })).toBeDisabled();
  });

  it('shows why a folder could not be created', async () => {
    vi.mocked(api.createDir).mockRejectedValue(new Error('Permission refusée'));
    const { input } = renderInput();
    await userEvent.click(input);
    await userEvent.type(await screen.findByPlaceholderText('Nouveau dossier…'), 'gba{Enter}');
    expect(await screen.findByText('Permission refusée')).toBeInTheDocument();
  });

  describe('with a library root', () => {
    beforeEach(() => {
      vi.mocked(api.getSettings).mockResolvedValue({ ...SETTINGS, romsRoot: '/roms' });
    });

    it('shows the path relative to the root', async () => {
      const { input } = renderInput('/roms/snes');
      await waitFor(() => expect(input).toHaveValue('/snes'));
    });

    it('turns what is typed back into an absolute path', async () => {
      const { input, onChange } = renderInput('/roms');
      await waitFor(() => expect(input).toHaveValue('/'));
      await userEvent.type(input, 'gba');
      expect(onChange).toHaveBeenLastCalledWith('/roms/gba');
    });
  });
});
